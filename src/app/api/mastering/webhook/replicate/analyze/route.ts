/**
 * POST /api/mastering/webhook/replicate/analyze
 *
 * Replicate calls this when the "analyze" action completes (MASTER_ONLY mode).
 * Receives the AudioAnalysis result, asks Claude for a mastering direction recommendation,
 * stores analysis fields, then sets status to AWAITING_DIRECTION so the artist can
 * accept / modify / skip before mastering begins.
 *
 * Each handler runs in < 15 seconds — no blocking waits.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { decideMasterParameters, detectGenre, getVersionTargets, generateDirectionRecommendation } from "@/lib/mastering/decisions";
import { getPresetNameForGenre } from "@/lib/mastering/pipeline";
import { buildEssentiaHints } from "@/lib/mastering/decisions";
import type { AudioAnalysis } from "@/lib/mastering/engine";
import type { EssentiaHints } from "@/lib/mastering/decisions";

export const maxDuration = 60;

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

async function getEssentiaHints(trackId: string | null): Promise<EssentiaHints | null> {
  if (!trackId) return null;
  const track = await prisma.track.findUnique({
    where:  { id: trackId },
    select: { essentiaInstruments: true, essentiaVoice: true, essentiaTimbre: true },
  });
  if (!track) return null;
  return buildEssentiaHints(
    track.essentiaInstruments as { label: string; score: number }[] | null,
    track.essentiaVoice,
    track.essentiaTimbre,
  );
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    id:     string;
    status: string;
    output: string | string[];
    error?: string;
    input:  { job_id: string; audio_url: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });
  console.error("Webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Analysis failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const rawAnalysis = JSON.parse(raw) as Record<string, unknown>;

    // Original track waveform — 200-point peak envelope returned by analyze step
    const originalWaveform = Array.isArray(rawAnalysis.waveform)
      ? (rawAnalysis.waveform as number[])
      : null;

    // Normalize Python output → AudioAnalysis shape
    // Python returns: { bpm, key, lufs, balance: {sub,low,mid,high}, beat_count, duration }
    // TypeScript expects: { bpm, key, lufs, frequencyBalance: FrequencyBand[], sections: DetectedSection[], durationSec, ... }
    const balance = (rawAnalysis.balance ?? {}) as Record<string, number>;
    const totalEnergy = Math.max(
      (balance.sub ?? 0) + (balance.low ?? 0) + (balance.mid ?? 0) + (balance.high ?? 0),
      0.0001
    );
    const analysis: AudioAnalysis = {
      bpm:              (rawAnalysis.bpm as number) ?? 120,
      key:              (rawAnalysis.key as string) ?? "C major",
      lufs:             (rawAnalysis.lufs as number) ?? -14,
      truePeak:         0,
      dynamicRange:     0,
      stereoWidth:      0,
      spectralCentroid: 0,
      durationSec:      (rawAnalysis.duration as number) ?? 0,
      frequencyBalance: [
        { band: "sub",  hzLow: 0,    hzHigh: 60,   energy: (balance.sub  ?? 0) / totalEnergy },
        { band: "low",  hzLow: 60,   hzHigh: 250,  energy: (balance.low  ?? 0) / totalEnergy },
        { band: "mid",  hzLow: 250,  hzHigh: 2000, energy: (balance.mid  ?? 0) / totalEnergy },
        { band: "high", hzLow: 2000, hzHigh: 20000,energy: (balance.high ?? 0) / totalEnergy },
      ],
      sections: [],  // Python analyze doesn't detect sections; Claude works from BPM/key/lufs/balance
    };

    const job = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    const genre         = job.genre ?? await detectGenre(analysis);
    const mood          = job.mood ?? "CLEAN";
    const presetName    = getPresetNameForGenre(genre);
    const essentiaHints = await getEssentiaHints(job.trackId ?? null);

    // Read NLP direction from mixParameters if artist provided one before payment
    const mixParams = job.mixParameters as Record<string, unknown> | null;
    const naturalLanguagePrompt = (mixParams?.naturalLanguagePrompt as string | null) ?? null;

    // Claude decides mastering chain
    const masterDecision = await decideMasterParameters({
      analysis,
      genre,
      mood,
      naturalLanguagePrompt,
      presetName,
      essentiaHints,
    });

    // Generate AI direction recommendation (Claude Haiku — cheap, fast)
    let directionRecommendation: string | null = null;
    try {
      directionRecommendation = await generateDirectionRecommendation(analysis, genre);
    } catch (recErr) {
      console.error("Direction recommendation failed (non-fatal):", recErr);
    }

    // Store input analysis fields + direction recommendation
    // Set AWAITING_DIRECTION so frontend shows the recommendation step
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        genre,
        analysisData:  { ...analysis, directionRecommendation } as any,
        status:        "AWAITING_DIRECTION",
        inputLufs:     analysis.lufs,
        inputBpm:      analysis.bpm,
        inputKey:      analysis.key,
        inputBalance:  {
          sub:  (balance.sub  ?? 0) / totalEnergy,
          low:  (balance.low  ?? 0) / totalEnergy,
          mid:  (balance.mid  ?? 0) / totalEnergy,
          high: (balance.high ?? 0) / totalEnergy,
        },
        masterParameters: { ...masterDecision.params, reasoning: masterDecision.reasoning } as any,
        // Store original track waveform immediately — available on compare screen
        ...(originalWaveform ? { previewWaveform: originalWaveform as any } : {}),
      },
    });

    // Do NOT fire master action yet — wait for artist to confirm/skip direction
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Analyze webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
