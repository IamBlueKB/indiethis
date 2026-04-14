/**
 * POST /api/internal/trigger/audio-features
 *
 * Full audio analysis via Replicate:
 *   - BPM, musical key, energy
 *   - EffNet genre, mood, instruments, danceability, voice, tonal
 *
 * Replaces node-web-audio-api + essentia.js which require libasound.so.2
 * (Linux ALSA) — not available in Vercel serverless functions.
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeAudioOnReplicate } from "@/lib/audio/replicate-analysis";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trackId, audioUrl } = (await req.json()) as { trackId: string; audioUrl: string };
  if (!trackId || !audioUrl)
    return NextResponse.json({ error: "trackId and audioUrl required" }, { status: 400 });

  void runFullAnalysis(trackId, audioUrl).catch((err) =>
    console.error("[trigger/audio-features] Unhandled error:", err),
  );

  return NextResponse.json({ ok: true });
}

async function runFullAnalysis(trackId: string, audioUrl: string): Promise<void> {
  console.log(`[trigger/audio-features] Starting Replicate analysis for track ${trackId}`);

  try {
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "analyzing" },
    });

    const result = await analyzeAudioOnReplicate(audioUrl);

    if (!result) {
      await db.track.update({
        where: { id: trackId },
        data:  { analysisStatus: "failed", analysisError: "Replicate analysis returned null" },
      }).catch(() => {});
      return;
    }

    const findMood = (label: string) =>
      result.moods.find((m) => m.label === label)?.score ?? null;

    // Write all results to DB
    await db.track.update({
      where: { id: trackId },
      data: {
        bpm:                  result.bpm,
        musicalKey:           result.musicalKey,
        analysisStatus:       "completed",
        analyzedAt:           new Date(),
        effnetGenre:          result.genres,
        effnetMood:           result.moods,
        effnetInstruments:    result.instruments,
        effnetDanceability:   result.danceability,
        effnetVoice:          { isVocal: result.isVocal, gender: null },
        effnetMoodAggressive: findMood("aggressive"),
        effnetMoodHappy:      findMood("happy"),
        effnetMoodSad:        findMood("sad"),
        effnetMoodRelaxed:    findMood("relaxed"),
        effnetTonal:          result.isTonal,
        essentiaGenres:       result.genres,
        essentiaMoods:        result.moods,
        essentiaInstruments:  result.instruments,
        essentiaDanceability: result.danceability,
        essentiaVoice:        result.isVocal ? "vocal" : "instrumental",
        essentiaAnalyzedAt:   new Date(),
      },
    });

    // Energy goes to the AudioFeatures relation
    await db.audioFeatures.upsert({
      where:  { trackId },
      create: { trackId, energy: result.energy },
      update: { energy: result.energy },
    });

    console.log(
      `[trigger/audio-features] Done for track ${trackId}:`,
      `BPM=${result.bpm} key=${result.musicalKey} energy=${result.energy.toFixed(2)}`,
      `genre=${result.genres[0]?.label ?? "?"} mood=${result.moods[0]?.label ?? "?"}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[trigger/audio-features] Failed for track ${trackId}:`, msg);
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "failed", analysisError: msg },
    }).catch(() => {});
  }
}
