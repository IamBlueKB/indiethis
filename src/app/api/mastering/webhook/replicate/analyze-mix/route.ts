/**
 * POST /api/mastering/webhook/replicate/analyze-mix
 *
 * Replicate calls this when "analyze" on the mixdown completes (MIX_AND_MASTER).
 * Claude decides the mastering chain, then fires the "master" action.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import { decideMasterParameters, getVersionTargets, buildEssentiaHints } from "@/lib/mastering/decisions";
import { getPresetNameForGenre } from "@/lib/mastering/pipeline";
import type { AudioAnalysis } from "@/lib/mastering/engine";
import type { EssentiaHints } from "@/lib/mastering/decisions";

export const maxDuration = 60;

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
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
    output: string;
    error?: string;
    input:  { job_id: string; audio_url: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Mix analysis failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const mixAnalysis  = JSON.parse(body.output) as AudioAnalysis;
    const job          = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });
    const analysisData = job.analysisData as Record<string, unknown> | null;
    const mixdownUrl   = analysisData?.mixdownUrl as string;

    if (!mixdownUrl) throw new Error("mixdownUrl not found in analysisData");

    const genre         = job.genre ?? "POP";
    const mood          = job.mood ?? "CLEAN";
    const presetName    = getPresetNameForGenre(genre);
    const essentiaHints = await getEssentiaHints(job.trackId ?? null);

    const masterDecision = await decideMasterParameters({
      analysis:              mixAnalysis,
      genre,
      mood,
      naturalLanguagePrompt: null,
      presetName,
      essentiaHints,
    });

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { masterParameters: { ...masterDecision.params, reasoning: masterDecision.reasoning } as any },
    });

    const versionTargets = getVersionTargets(genre);
    const platforms      = (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"];

    await startMasteringAction("master", {
      audio_url:          mixdownUrl,
      reference_url:      job.referenceTrackUrl ?? "",
      master_params_json: JSON.stringify({
        audioUrl:     mixdownUrl,
        ...masterDecision.params,
        versions:     versionTargets,
        referenceUrl: job.referenceTrackUrl ?? null,
        platforms,
      }),
      job_id: jobId,
    }, "/api/mastering/webhook/replicate/master");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Analyze-mix webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
