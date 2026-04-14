/**
 * POST /api/internal/trigger/audio-features
 *
 * Isolated trigger for full audio analysis on track upload:
 *   1. BPM / key / energy  — via detectAudioFeatures (node-web-audio-api + essentia.js)
 *   2. EffNet-Discogs ML   — genre / mood / instruments / danceability / voice
 *
 * Kept in its own route so Vercel nft bundles node-web-audio-api, essentia.js,
 * onnxruntime-web, and the ONNX model files only here — not in the webhook or
 * tracks upload function.
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trackId, audioUrl } = (await req.json()) as { trackId: string; audioUrl: string };
  if (!trackId || !audioUrl)
    return NextResponse.json({ error: "trackId and audioUrl required" }, { status: 400 });

  // Fire and forget — caller doesn't wait for this
  void runFullAnalysis(trackId, audioUrl).catch((err) =>
    console.error("[trigger/audio-features] Unhandled error:", err),
  );

  return NextResponse.json({ ok: true });
}

async function runFullAnalysis(trackId: string, audioUrl: string): Promise<void> {
  console.log(`[trigger/audio-features] Starting full analysis for track ${trackId}`);

  // ── 1. BPM / key / energy ─────────────────────────────────────────────────
  try {
    const { detectAudioFeatures } = await import("@/lib/audio-analysis");
    const features = await detectAudioFeatures(audioUrl);

    console.log(`[trigger/audio-features] BPM=${features.bpm} key=${features.musicalKey} energy=${features.energy}`);

    if (features.bpm !== null || features.musicalKey !== null || features.energy !== null) {
      // Write bpm + musicalKey to Track
      await db.track.update({
        where: { id: trackId },
        data: {
          ...(features.bpm        !== null ? { bpm:        features.bpm }        : {}),
          ...(features.musicalKey !== null ? { musicalKey: features.musicalKey } : {}),
        },
      });

      // Write energy to AudioFeatures (upsert — may not exist yet)
      if (features.energy !== null) {
        await db.audioFeatures.upsert({
          where:  { trackId },
          create: { trackId, energy: features.energy },
          update: { energy: features.energy },
        });
      }
    }
  } catch (err) {
    console.error(`[trigger/audio-features] BPM/key/energy failed for ${trackId}:`, err);
  }

  // ── 2. EffNet-Discogs ML ──────────────────────────────────────────────────
  try {
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "analyzing" },
    });

    const { analyzeUrlWithEffnet } = await import("@/lib/audio/effnet-discogs");
    const result = await analyzeUrlWithEffnet(audioUrl);

    if (!result) throw new Error("EffNet returned null");

    const findMood = (label: string): number | null =>
      result.moods.find(m => m.label === label)?.score ?? null;

    await db.track.update({
      where: { id: trackId },
      data: {
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

    console.log(
      `[trigger/audio-features] EffNet done for ${trackId}:`,
      `genre=${result.genres[0]?.label ?? "?"}`,
      `mood=${result.moods[0]?.label ?? "?"}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[trigger/audio-features] EffNet failed for ${trackId}:`, msg);
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "failed", analysisError: msg },
    }).catch(() => {});
  }
}
