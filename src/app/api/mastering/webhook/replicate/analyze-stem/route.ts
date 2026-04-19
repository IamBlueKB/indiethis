/**
 * POST /api/mastering/webhook/replicate/analyze-stem
 *
 * Replicate calls this when "analyze" on the first stem completes (MIX_AND_MASTER).
 * Claude decides the mix chain, then fires the "mix" action.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import { decideMixParameters, detectGenre, buildEssentiaHints } from "@/lib/mastering/decisions";
import { getPresetNameForGenre } from "@/lib/mastering/pipeline";
import type { AudioAnalysis, ClassifiedStem } from "@/lib/mastering/engine";
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
      data:  { status: "FAILED", reportData: { error: body.error ?? "Stem analysis failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const analysis = JSON.parse(body.output) as AudioAnalysis;
    const job      = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    const analysisData    = job.analysisData as { classifiedStems?: ClassifiedStem[] } | null;
    const classifiedStems = analysisData?.classifiedStems ?? [];

    const genre         = job.genre ?? await detectGenre(analysis);
    const mood          = job.mood ?? "CLEAN";
    const presetName    = getPresetNameForGenre(genre);
    const essentiaHints = await getEssentiaHints(job.trackId ?? null);
    const nlPrompt      = (job.mixParameters as { naturalLanguagePrompt?: string } | null)?.naturalLanguagePrompt ?? null;

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        genre,
        status:       "MIXING",
        analysisData: { ...analysisData, firstStemAnalysis: analysis } as any,
      },
    });

    // Claude decides mix chain
    const mixDecision = await decideMixParameters({
      stems:                 classifiedStems,
      analysis,
      genre,
      mood,
      naturalLanguagePrompt: nlPrompt,
      referenceUrl:          job.referenceTrackUrl ?? null,
      presetName,
      essentiaHints,
    });

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        mixParameters: {
          chains:    mixDecision.chains as any[],
          reasoning: mixDecision.reasoning,
          naturalLanguagePrompt: nlPrompt,
        } as any,
      },
    });

    // Build stems dict for mix action
    const stemsDict: Record<string, string> = {};
    for (const chain of mixDecision.chains) {
      stemsDict[chain.stemType] = chain.stemUrl;
    }

    await startMasteringAction("mix", {
      stems_json:      JSON.stringify(stemsDict),
      mix_params_json: JSON.stringify({
        stems:        mixDecision.chains,
        sections:     analysis.sections,
        bpm:          analysis.bpm,
        referenceUrl: job.referenceTrackUrl ?? null,
      }),
      job_id: jobId,
    }, "/api/mastering/webhook/replicate/mix");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Analyze-stem webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
