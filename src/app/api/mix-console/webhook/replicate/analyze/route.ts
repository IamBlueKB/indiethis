/**
 * POST /api/mix-console/webhook/replicate/analyze
 *
 * Replicate calls this when the "analyze-mix" action completes.
 * Stores analysis results, calls Claude for recommendation + mix parameters in parallel,
 * then marks the job AWAITING_DIRECTION so the artist can review and approve.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { decideMixParameters, generateMixRecommendation } from "@/lib/mix-console/decisions";
import type { MixAnalysisResult, InputFile } from "@/lib/mix-console/engine";

export const maxDuration = 60;

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    id:     string;
    status: string;
    output: string | string[];
    error?: string;
    input:  { job_id: string; [key: string]: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });
  console.error("analyze webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Load job to get user preferences for Claude decisions
    const job = await prisma.mixJob.findUniqueOrThrow({ where: { id: jobId } });

    const inputFiles = job.inputFiles as unknown as InputFile[];

    // Shape analysis into the typed structure Claude functions expect
    const analysis: MixAnalysisResult = {
      bpm:                 (parsed.bpm               as number)  ?? 120,
      key:                 (parsed.key               as string)  ?? "C major",
      sections:            (parsed.sections           as any[])  ?? [],
      stemAnalysis:        (parsed.stem_analysis      as any[])  ?? [],
      vocalClassification: (parsed.vocal_classification as any[]) ?? [],
      lyrics:              (parsed.lyrics             as string)  ?? "",
      wordTimestamps:      (parsed.word_timestamps    as any[])  ?? [],
      roomReverb:          (parsed.room_reverb        as number)  ?? 0,
      pitchDeviation:      (parsed.pitch_deviation    as number)  ?? 0,
    };

    // Run Claude recommendation + parameter decision in parallel
    const [recommendation, decision] = await Promise.all([
      generateMixRecommendation({
        analysis,
        genre:           job.genre           ?? "",
        tier:            job.tier,
        customDirection: job.customDirection  ?? undefined,
        inputFiles,
      }),
      decideMixParameters({
        analysis,
        genre:             job.genre             ?? "",
        tier:              job.tier,
        mixVibe:           job.mixVibe            ?? "CLEAN",
        vocalStylePreset:  (job as any).vocalStylePreset ?? "AUTO",
        reverbStyle:       job.reverbStyle        ?? "ROOM",
        delayStyle:        job.delayStyle         ?? "STANDARD",
        breathEditing:     job.breathEditing      ?? "SUBTLE",
        pitchCorrection:   job.pitchCorrection    ?? "SUBTLE",
        fadeOut:           job.fadeOut            ?? "AUTO",
        customDirection:   job.customDirection    ?? undefined,
        inputFiles,
      }),
    ]);

    await prisma.mixJob.update({
      where: { id: jobId },
      data:  {
        status:                 "AWAITING_DIRECTION",
        analysisData:           parsed                                  as any,
        lyrics:                 (parsed.lyrics               as string) ?? null,
        wordTimestamps:         (parsed.word_timestamps      as any)    ?? null,
        vocalClassification:    (parsed.vocal_classification as any)    ?? null,
        directionRecommendation: recommendation,
        mixParameters:          decision                                as any,
        sectionMap:             (decision.sectionMap         as any)    ?? null,
        delayThrows:            (decision.delayThrows        as any)    ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`analyze webhook failed for job ${jobId}:`, message);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }
}
