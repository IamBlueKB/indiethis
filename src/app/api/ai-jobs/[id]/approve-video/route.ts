/**
 * POST /api/ai-jobs/[id]/approve-video
 *
 * Triggered when the artist watches the 10-second Phase 1 preview clip and
 * clicks "Approve Full Render". Kicks off Phase 2 (full video generation)
 * in the background so the response returns immediately.
 *
 * Auth: the requesting user must own the job or be a PLATFORM_ADMIN.
 * Job must be type VIDEO, status PROCESSING, and have previewReady: true.
 */

import { NextResponse }           from "next/server";
import { auth }                   from "@/lib/auth";
import { db }                     from "@/lib/db";
import { continueVideoPhase2 }    from "@/lib/ai-job-processor";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  // ── Load & guard ──────────────────────────────────────────────────────────
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Ownership: job must belong to the requesting user or a platform admin
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
      { error: `Job is ${job.status} — Phase 2 can only start from PROCESSING` },
      { status: 400 },
    );
  }

  const output = (job.outputData ?? {}) as Record<string, unknown>;
  if (!output.previewReady) {
    return NextResponse.json(
      { error: "Phase 1 preview not yet ready — cannot approve" },
      { status: 400 },
    );
  }

  if (output.phase === 2 || output.finalVideoUrl) {
    return NextResponse.json(
      { error: "Phase 2 already running or complete" },
      { status: 409 },
    );
  }

  // ── Kick off Phase 2 async — do NOT await ─────────────────────────────────
  // Response returns immediately so the client can show a "rendering…" state.
  void continueVideoPhase2(jobId).catch((err: unknown) => {
    console.error(`[approve-video] Phase 2 uncaught error for job ${jobId}:`, err);
  });

  return NextResponse.json({
    success:   true,
    jobId,
    message:   "Phase 2 full render started — poll job status for completion",
    phase:     2,
    provider:  output.provider ?? "kling",
  });
}
