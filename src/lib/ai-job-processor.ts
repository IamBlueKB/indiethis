/**
 * ai-job-processor.ts — Unified AI job processor / router
 *
 * processAIJob(jobId):
 *   1. Loads the AIJob from the database.
 *   2. Sets status → PROCESSING.
 *   3. Routes to the correct handler based on job.type.
 *   4. On success  → sets status COMPLETE + stores outputData + completedAt.
 *   5. On failure  → sets status FAILED + stores errorMessage.
 *
 * Handler functions are stubs here — provider integrations are wired in
 * steps 4–9. Each handler receives the full job record and returns outputData.
 */

import { db } from "@/lib/db";
import { AIJobStatus, type AIJob } from "@prisma/client";

// ─── Handler result type ──────────────────────────────────────────────────────

type HandlerResult = {
  outputData: Record<string, unknown>;
  costToUs?: number; // actual provider cost in dollars
};

// ─── Stub handlers (replaced in later steps) ─────────────────────────────────

async function handleVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing VIDEO job ${job.id} via ${job.provider}`);
  // Step 4: wire Runway Gen-3 here
  return { outputData: { stub: true, type: "VIDEO" } };
}

async function handleCoverArt(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing COVER_ART job ${job.id} via ${job.provider}`);
  // Step 5: wire Replicate (SDXL / Flux) here
  return { outputData: { stub: true, type: "COVER_ART" } };
}

async function handleMastering(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing MASTERING job ${job.id} via ${job.provider}`);
  // Step 6: wire Dolby.io mastering here
  return { outputData: { stub: true, type: "MASTERING" } };
}

async function handleLyricVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing LYRIC_VIDEO job ${job.id} via ${job.provider}`);
  // Step 7: wire Remotion Lambda here
  return { outputData: { stub: true, type: "LYRIC_VIDEO" } };
}

async function handleARReport(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing AR_REPORT job ${job.id} via ${job.provider}`);
  // Step 8: wire Claude (Anthropic) here
  return { outputData: { stub: true, type: "AR_REPORT" } };
}

async function handlePressKit(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing PRESS_KIT job ${job.id} via ${job.provider}`);
  // Step 9: wire Claude (Anthropic) here
  return { outputData: { stub: true, type: "PRESS_KIT" } };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function processAIJob(jobId: string): Promise<void> {
  // 1. Load job
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    console.error(`[ai-jobs] job ${jobId} not found`);
    return;
  }

  if (job.status !== AIJobStatus.QUEUED) {
    console.warn(`[ai-jobs] job ${jobId} is ${job.status} — skipping`);
    return;
  }

  // 2. Mark PROCESSING
  await db.aIJob.update({
    where: { id: jobId },
    data: { status: AIJobStatus.PROCESSING },
  });

  // 3. Route to handler
  try {
    let result: HandlerResult;

    switch (job.type) {
      case "VIDEO":
        result = await handleVideo(job);
        break;
      case "COVER_ART":
        result = await handleCoverArt(job);
        break;
      case "MASTERING":
        result = await handleMastering(job);
        break;
      case "LYRIC_VIDEO":
        result = await handleLyricVideo(job);
        break;
      case "AR_REPORT":
        result = await handleARReport(job);
        break;
      case "PRESS_KIT":
        result = await handlePressKit(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // 4. Mark COMPLETE
    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status:      AIJobStatus.COMPLETE,
        outputData:  result.outputData as import("@prisma/client").Prisma.InputJsonValue,
        costToUs:    result.costToUs ?? null,
        completedAt: new Date(),
      },
    });

    console.log(`[ai-jobs] job ${jobId} (${job.type}) COMPLETE`);

  } catch (err: unknown) {
    // 5. Mark FAILED
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-jobs] job ${jobId} FAILED: ${message}`);

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status:       AIJobStatus.FAILED,
        errorMessage: message,
        completedAt:  new Date(),
      },
    });
  }
}
