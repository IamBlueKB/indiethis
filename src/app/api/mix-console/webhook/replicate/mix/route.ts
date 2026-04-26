/**
 * POST /api/mix-console/webhook/replicate/mix
 *
 * Replicate calls this when the "mix-full" action completes (initial mix pass).
 * Stores file paths + waveform data, then fires preview-mix.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const maxDuration = 300;

// Statuses where the mix step has already produced its outputs.
// Duplicate Replicate webhook deliveries that hit one of these are ignored.
const DOWNSTREAM_STATUSES = new Set([
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
  console.error("mix webhook body:", JSON.stringify(body).slice(0, 500));

  // Guard #1 (pre-response): if this job has already progressed past mix
  // (preview files exist, or status is downstream), do NOT reprocess.
  // Replicate retries webhooks at-least-once.
  const progress = await prisma.mixJob.findUnique({
    where:  { id: jobId },
    select: { status: true, cleanFilePath: true, previewFilePaths: true },
  });
  if (progress?.previewFilePaths) {
    console.log(`mix webhook: job ${jobId} already has previewFilePaths — ignoring duplicate webhook`);
    return NextResponse.json({ ok: true, ignored: "preview already rendered" });
  }
  if (progress?.status && DOWNSTREAM_STATUSES.has(progress.status)) {
    console.log(`mix webhook: job ${jobId} status=${progress.status} — ignoring duplicate webhook`);
    return NextResponse.json({ ok: true, ignored: "status downstream" });
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
          // Rebuild the same mix_params_json payload that confirm-direction sends.
          const job = await prisma.mixJob.findUnique({
            where: { id: jobId },
            select: {
              inputFiles: true, genre: true, mixParameters: true, analysisData: true,
              pitchCorrection: true, breathEditing: true, fadeOut: true,
              mixVibe: true, reverbStyle: true, delayStyle: true,
              beatPolish: true, referenceNotes: true,
            },
          });
          if (!job) return;
          const inputFiles = (job.inputFiles ?? []) as { url: string; label: string }[];
          const stemsUrlsObj: Record<string, string> = {};
          for (const f of inputFiles) stemsUrlsObj[f.label] = f.url;
          const analysisData = (job.analysisData as Record<string, unknown>) ?? {};
          const mixParams = {
            ...(job.mixParameters as Record<string, unknown> ?? {}),
            stems_urls:      stemsUrlsObj,
            genre:           job.genre           ?? "HIP_HOP",
            pitchCorrection: job.pitchCorrection  ?? "OFF",
            breathEditing:   job.breathEditing    ?? "SUBTLE",
            fadeOut:         job.fadeOut          ?? "AUTO",
            mixVibe:         job.mixVibe          ?? "CLEAN",
            reverbStyle:     job.reverbStyle      ?? "ROOM",
            delayStyle:      job.delayStyle       ?? "STANDARD",
            beatPolish:      job.beatPolish       ?? false,
            referenceNotes:  job.referenceNotes   ?? null,
            roomReverb:      (analysisData.room_reverb as number) ?? 0,
            bpm:             (analysisData.bpm          as number) ?? 120,
            sections:        (analysisData.sections     as unknown[]) ?? [],
          };
          await startMixAction(
            "mix-full",
            { job_id: jobId, mix_params_json: JSON.stringify(mixParams) },
            "/api/mix-console/webhook/replicate/mix",
          );
        } catch {
          await prisma.mixJob.update({ where: { id: jobId }, data: { status: "FAILED" } });
        }
      });
      return NextResponse.json({ ok: true });
    }
    console.error(`mix webhook: prediction failed for job ${jobId}:`, errMsg);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── Respond 200 immediately, run all heavy work asynchronously ─────────
  // Replicate webhook timeout is short (~10s). The chained startMixAction
  // call to fire preview-mix can hit 429s and stall well past that. By
  // ack'ing 200 first we eliminate webhook retries. Guard #1 above is the
  // safety net if a retry races us anyway.
  after(async () => {
    try {
      const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      // Python returns:
      // file_paths: { clean, polished, aggressive, mix }
      // waveforms: { clean, polished, aggressive, mix }
      // original_waveform: [...]
      // preview_file_paths: { clean, polished, aggressive, mix, original }
      // applied_parameters: {}
      const filePaths     = (parsed.file_paths         as Record<string, string>) ?? {};
      const waveforms     = (parsed.waveforms           as Record<string, number[]>) ?? {};
      const originalWave  = (parsed.original_waveform   as number[]) ?? null;
      const previewPaths  = (parsed.preview_file_paths  as Record<string, string>) ?? null;
      const qaResults     = (parsed.qa_results          as Record<string, unknown>) ?? null;

      await prisma.mixJob.update({
        where: { id: jobId },
        data:  {
          cleanFilePath:           filePaths["clean"]      ?? null,
          polishedFilePath:        filePaths["polished"]   ?? null,
          aggressiveFilePath:      filePaths["aggressive"] ?? null,
          mixFilePath:             filePaths["mix"]        ?? null,
          previewWaveformMixed:    waveforms               as any,
          previewWaveformOriginal: originalWave            as any,
          previewFilePaths:        previewPaths            as any,
          qaCheckResults:          qaResults               as any,
          status:                  "PREVIEWING",
        },
      });

      // Fire preview-mix
      await startMixAction(
        "preview-mix",
        { job_id: jobId },
        "/api/mix-console/webhook/replicate/preview",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`mix webhook async failed for job ${jobId}:`, message);
      await prisma.mixJob.update({
        where: { id: jobId },
        data:  { status: "FAILED" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
