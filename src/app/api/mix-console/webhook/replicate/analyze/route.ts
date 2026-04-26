/**
 * POST /api/mix-console/webhook/replicate/analyze
 *
 * Replicate calls this when the "analyze-mix" action completes.
 * Stores analysis results, calls Claude for recommendation + mix parameters in parallel,
 * then marks the job AWAITING_DIRECTION so the artist can review and approve.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db as prisma } from "@/lib/db";
import { decideMixParameters, generateMixRecommendation } from "@/lib/mix-console/decisions";
import { runMixEngineSync } from "@/lib/mix-console/engine";
import type { MixAnalysisResult, InputFile } from "@/lib/mix-console/engine";
import { captureUserReference } from "@/lib/reference-library/capture-user-reference";

export const maxDuration = 300;

// Statuses where the analyze step has already produced its outputs.
// Duplicate Replicate webhook deliveries that hit one of these are ignored
// rather than re-running Claude (which is non-deterministic and would
// overwrite a perfectly good direction recommendation).
const DOWNSTREAM_STATUSES = new Set([
  "AWAITING_DIRECTION",
  "MIXING",
  "PREVIEWING",
  "COMPLETE",
  "REVISING",
]);

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

  // Guard #1 (pre-response): if this job has already progressed past analyze
  // (mix files exist, or status is downstream — AWAITING_DIRECTION through
  // COMPLETE/REVISING), or a directionRecommendation is already set, do NOT
  // reprocess. Replicate retries webhooks at-least-once; without this guard
  // duplicate deliveries re-run Claude and overwrite perfectly good output.
  const progress = await prisma.mixJob.findUnique({
    where:  { id: jobId },
    select: { status: true, cleanFilePath: true, directionRecommendation: true },
  });
  if (progress?.cleanFilePath) {
    console.log(`analyze webhook: job ${jobId} already has mix files — ignoring duplicate webhook`);
    return NextResponse.json({ ok: true, ignored: "mix already rendered" });
  }
  if (progress?.status && DOWNSTREAM_STATUSES.has(progress.status)) {
    console.log(`analyze webhook: job ${jobId} status=${progress.status} — ignoring duplicate webhook`);
    return NextResponse.json({ ok: true, ignored: "status downstream" });
  }
  if (progress?.directionRecommendation) {
    console.log(`analyze webhook: job ${jobId} already has directionRecommendation — ignoring duplicate webhook`);
    return NextResponse.json({ ok: true, ignored: "recommendation exists" });
  }

  if (body.status !== "succeeded") {
    const errMsg = body.error ?? "";
    // "PA" = Prediction Aborted (cold start / Replicate infrastructure fluke) — auto-requeue once
    const isRetryable = errMsg.includes("retry") || errMsg.includes("PA") || errMsg.includes("interrupted");
    if (isRetryable) {
      // Schedule the requeue post-response so Replicate gets its 200 quickly
      // and doesn't fire its own retry while we're still re-firing the action.
      after(async () => {
        try {
          const { startMixAction } = await import("@/lib/mix-console/engine");
          const job = await prisma.mixJob.findUnique({ where: { id: jobId }, select: { inputFiles: true } });
          const inputFiles = (job?.inputFiles ?? []) as { url: string; label: string }[];
          await startMixAction(
            "analyze-mix",
            { stems_json: JSON.stringify(inputFiles.map((f) => f.url)), job_id: jobId },
            "/api/mix-console/webhook/replicate/analyze",
          );
        } catch {
          await prisma.mixJob.update({ where: { id: jobId }, data: { status: "FAILED" } });
        }
      });
      return NextResponse.json({ ok: true });
    }
    console.error(`analyze webhook: prediction failed for job ${jobId}:`, errMsg);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── Respond 200 immediately, run all heavy work asynchronously ─────────
  // Replicate webhook timeout is short (~10s); Claude calls + reference
  // analysis can easily exceed that. Doing the work synchronously caused
  // Replicate to retry the webhook mid-processing, which spawned 2–3
  // concurrent Claude invocations and overwrote each other's output. By
  // ack'ing 200 first we eliminate the retries entirely. Guard #1 above
  // serves as the safety net if a retry races us anyway.
  after(async () => {
    try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    // Sanitize non-standard JSON floats Python may emit (Infinity, -Infinity, NaN)
    const sanitized = raw
      .replace(/-Infinity/g, "-99")
      .replace(/\bInfinity\b/g, "999")
      .replace(/\bNaN\b/g, "0");
    const parsed = JSON.parse(sanitized) as Record<string, unknown>;

    // Load job to get user preferences for Claude decisions
    const job = await prisma.mixJob.findUniqueOrThrow({ where: { id: jobId } });

    const inputFiles = job.inputFiles as unknown as InputFile[];

    // Analyze reference track if provided — get LUFS + frequency balance for Claude
    let referenceAnalysis: {
      lufs: number; bpm: number; key: string;
      balance: { sub: number; low: number; mid: number; high: number };
      fileName: string;
    } | null = null;

    if (job.referenceTrackUrl) {
      try {
        const refParsed = await runMixEngineSync("analyze", {
          audio_url: job.referenceTrackUrl,
        });
        referenceAnalysis = {
          lufs:     (refParsed.lufs    as number)  ?? -14,
          bpm:      (refParsed.bpm     as number)  ?? 120,
          key:      (refParsed.key     as string)  ?? "unknown",
          balance:  (refParsed.balance as { sub: number; low: number; mid: number; high: number }) ?? { sub: 0, low: 0, mid: 0, high: 0 },
          fileName: job.referenceFileName ?? "reference track",
        };
        console.log(`Reference track analyzed for job ${jobId}:`, referenceAnalysis);
      } catch (refErr) {
        console.error(`Reference track analysis failed for job ${jobId}:`, refErr);
      }
    }

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
        referenceAnalysis,
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
        referenceNotes:         decision.referenceNotes                 ?? null,
      },
    });

    // ─── Reference-library capture (fire-and-forget) ─────────────────────
    // If the artist supplied a reference track, run the deep `analyze-reference`
    // pipeline asynchronously and store it as a user-reference profile.
    // Never blocks the webhook response or fails it.
    if (job.referenceTrackUrl && job.genre) {
      void captureUserReference({
        jobId,
        audioUrl: job.referenceTrackUrl,
        genre:    job.genre,
        fileName: job.referenceFileName ?? undefined,
      });
    }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`analyze webhook async failed for job ${jobId}:`, message);
      await prisma.mixJob.update({
        where: { id: jobId },
        data:  { status: "FAILED" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
