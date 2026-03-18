/**
 * POST /api/ai-jobs/[id]/regenerate-clip
 *
 * Re-generates a single failed clip in a VIDEO job's Phase 2 render.
 * The artist can retry any failed clip up to MAX_CLIP_RETRIES (3) times.
 * If the regeneration makes all clips successful, stitching is triggered
 * automatically and the job moves to COMPLETE.
 *
 * Body: { clipIndex: number }
 *
 * Auth: job owner or PLATFORM_ADMIN only.
 * Preconditions: job must be VIDEO + PROCESSING + clips array must exist.
 */

import { NextRequest, NextResponse }               from "next/server";
import { auth }                                     from "@/lib/auth";
import { db }                                       from "@/lib/db";
import { regenerateVideoClip, MAX_CLIP_RETRIES }    from "@/lib/ai-job-processor";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  // ── Parse body ────────────────────────────────────────────────────────────
  let clipIndex: number;
  try {
    const body = (await req.json()) as { clipIndex?: unknown };
    clipIndex = Number(body.clipIndex);
    if (!Number.isFinite(clipIndex) || clipIndex < 0) {
      return NextResponse.json(
        { error: "clipIndex must be a non-negative integer" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Load & guard ──────────────────────────────────────────────────────────
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (
    job.triggeredById !== session.user.id &&
    session.user.role !== "PLATFORM_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.type !== "VIDEO") {
    return NextResponse.json({ error: "Job is not a VIDEO job" }, { status: 400 });
  }

  if (job.status !== "PROCESSING") {
    return NextResponse.json(
      { error: `Job is ${job.status} — regeneration only valid while PROCESSING` },
      { status: 400 },
    );
  }

  // Validate clip exists and retry count
  const output = (job.outputData ?? {}) as Record<string, unknown>;
  const clips  = (output.clips ?? []) as Array<{ index: number; retries: number; status: string }>;

  if (clipIndex >= clips.length) {
    return NextResponse.json(
      { error: `Clip index ${clipIndex} out of range (job has ${clips.length} clips)` },
      { status: 400 },
    );
  }

  const clip = clips[clipIndex];

  if (clip.retries >= MAX_CLIP_RETRIES) {
    return NextResponse.json(
      {
        error:      `Clip ${clipIndex} has reached the maximum of ${MAX_CLIP_RETRIES} retries`,
        retries:    clip.retries,
        maxRetries: MAX_CLIP_RETRIES,
      },
      { status: 409 },
    );
  }

  if (clip.status === "generating") {
    return NextResponse.json(
      { error: `Clip ${clipIndex} is already being generated` },
      { status: 409 },
    );
  }

  if (clip.status === "success") {
    return NextResponse.json(
      { error: `Clip ${clipIndex} already succeeded — no regeneration needed` },
      { status: 409 },
    );
  }

  // ── Kick off regeneration async — returns immediately ────────────────────
  void regenerateVideoClip(jobId, clipIndex).catch((err: unknown) => {
    console.error(
      `[regenerate-clip] uncaught error for job ${jobId} clip ${clipIndex}:`,
      err,
    );
  });

  return NextResponse.json({
    success:         true,
    jobId,
    clipIndex,
    retriesRemaining: MAX_CLIP_RETRIES - (clip.retries + 1),
    message:
      `Clip ${clipIndex} regeneration started. Poll job status for completion.`,
  });
}
