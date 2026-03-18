/**
 * GET /api/ai-jobs/[id]
 *
 * Polling endpoint for AI job status. Used by the frontend after submitting
 * a job via POST /api/dashboard/ai/[toolType].
 *
 * Returns a clean, client-ready shape regardless of job type:
 *
 *   {
 *     jobId, type, status, priceCharged, createdAt, completedAt,
 *     errorMessage?,
 *
 *     // Surfaced from outputData for convenience:
 *     phase?,           // 1 | 2 — VIDEO + LYRIC_VIDEO
 *     previewReady?,    // true when VIDEO Phase 1 is done
 *     previewUrl?,      // VIDEO Phase 1 preview clip
 *     finalVideoUrl?,   // VIDEO Phase 2 complete / LYRIC_VIDEO complete
 *     transcriptionReady?, // LYRIC_VIDEO Phase 1 done
 *     clips?,           // { total, succeeded, failed, generating } — VIDEO Phase 2
 *     words?,           // WhisperWord[] — LYRIC_VIDEO (only when PROCESSING+transcriptionReady)
 *     segments?,        // WhisperSegment[] — LYRIC_VIDEO
 *
 *     outputData,       // full outputData — only when COMPLETE
 *   }
 *
 * Auth: job owner or PLATFORM_ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

// ─── Types matching ai-job-processor internals ─────────────────────────────────

type VideoClipSummary = {
  total:      number;
  succeeded:  number;
  failed:     number;
  generating: number;
  pending:    number;
};

type RawClip = { status: string };

function summariseClips(clips: RawClip[]): VideoClipSummary {
  return clips.reduce(
    (acc, c) => {
      acc.total++;
      if      (c.status === "success")    acc.succeeded++;
      else if (c.status === "failed")     acc.failed++;
      else if (c.status === "generating") acc.generating++;
      else                                acc.pending++;
      return acc;
    },
    { total: 0, succeeded: 0, failed: 0, generating: 0, pending: 0 },
  );
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req:   NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // ── Ownership guard ───────────────────────────────────────────────────────
  if (
    job.triggeredById !== session.user.id &&
    session.user.role !== "PLATFORM_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const output = (job.outputData ?? {}) as Record<string, unknown>;

  // ── Build a clean client payload ──────────────────────────────────────────
  // Always included:
  const base = {
    jobId:        job.id,
    type:         job.type,
    status:       job.status,
    priceCharged: job.priceCharged,
    createdAt:    job.createdAt,
    completedAt:  job.completedAt ?? null,
    errorMessage: job.status === "FAILED" ? (job.errorMessage ?? null) : null,
  };

  // Conditionally include fields from outputData based on type + status
  const extra: Record<string, unknown> = {};

  // ── VIDEO ─────────────────────────────────────────────────────────────────
  if (job.type === "VIDEO") {
    extra.phase        = output.phase ?? 1;
    extra.durationTier = output.durationTier ?? null;
    extra.provider     = output.provider ?? null;

    if (output.previewReady) {
      extra.previewReady = true;
      extra.previewUrl   = output.previewUrl ?? null;
    }

    if (output.phase === 2 && Array.isArray(output.clips)) {
      extra.clips = summariseClips(output.clips as RawClip[]);
      extra.stitching = output.stitching ?? false;
    }

    if (output.finalVideoUrl) {
      extra.finalVideoUrl = output.finalVideoUrl;
    }
  }

  // ── LYRIC_VIDEO ───────────────────────────────────────────────────────────
  if (job.type === "LYRIC_VIDEO") {
    extra.phase = output.transcriptionReady ? (output.finalVideoUrl ? 2 : 1) : 0;

    if (output.transcriptionReady && !output.finalVideoUrl) {
      // Phase 1 done — expose transcript so client can render the review UI
      extra.transcriptionReady = true;
      extra.words              = output.words    ?? [];
      extra.segments           = output.segments ?? [];
      extra.text               = output.text     ?? "";
      extra.duration           = output.duration ?? null;
    }

    if (output.finalVideoUrl) {
      extra.finalVideoUrl = output.finalVideoUrl;
    }
  }

  // ── COVER_ART ─────────────────────────────────────────────────────────────
  if (job.type === "COVER_ART" && job.status === "COMPLETE") {
    extra.imageUrls    = output.imageUrls    ?? null;
    extra.selectedUrl  = output.selectedUrl  ?? null;
  }

  // ── MASTERING ─────────────────────────────────────────────────────────────
  if (job.type === "MASTERING" && job.status === "COMPLETE") {
    extra.masteredUrl  = output.masteredUrl  ?? null;
    extra.loudnessLUFS = output.loudnessLUFS ?? null;
  }

  // ── AR_REPORT / PRESS_KIT — full outputData only when COMPLETE ────────────
  const outputData =
    job.status === "COMPLETE"
      ? output
      : job.status === "FAILED"
      ? { errorDetail: job.errorMessage }
      : null;

  return NextResponse.json({
    ...base,
    ...extra,
    outputData,
  });
}
