/**
 * POST /api/ai-jobs/[id]/approve-lyrics
 *
 * Triggered when the artist reviews the Whisper transcript (from Phase 1 of a
 * LYRIC_VIDEO job) and clicks "Start Render".  The artist may optionally submit
 * corrected word timestamps alongside their approval.
 *
 * When called:
 *  1. Validates the job (LYRIC_VIDEO, PROCESSING, transcriptionReady: true).
 *  2. Kicks off continueLyricVideoRender() asynchronously so the response
 *     returns immediately — the client polls job status for completion.
 *
 * Body (all optional):
 *  {
 *    words?: Array<{ word: string; start: number; end: number }>
 *  }
 *
 * Auth: job owner or PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse }                         from "next/server";
import { auth }                                              from "@/lib/auth";
import { db }                                               from "@/lib/db";
import { continueLyricVideoRender, type WhisperWord }        from "@/lib/ai-job-processor";

export async function POST(
  req:    NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  // ── Parse optional body ───────────────────────────────────────────────────
  let correctedWords: WhisperWord[] | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      words?: unknown;
    };

    if (body.words !== undefined) {
      if (!Array.isArray(body.words)) {
        return NextResponse.json(
          { error: "words must be an array of { word, start, end } objects" },
          { status: 400 },
        );
      }
      // Light validation — each entry must have word + numeric start/end
      for (const w of body.words as unknown[]) {
        const entry = w as Record<string, unknown>;
        if (
          typeof entry.word  !== "string" ||
          typeof entry.start !== "number" ||
          typeof entry.end   !== "number"
        ) {
          return NextResponse.json(
            { error: "Each word entry must have { word: string, start: number, end: number }" },
            { status: 400 },
          );
        }
      }
      correctedWords = body.words as WhisperWord[];
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

  if (job.type !== "LYRIC_VIDEO") {
    return NextResponse.json({ error: "Job is not a LYRIC_VIDEO job" }, { status: 400 });
  }

  if (job.status !== "PROCESSING") {
    return NextResponse.json(
      { error: `Job is ${job.status} — lyrics approval only valid while PROCESSING` },
      { status: 400 },
    );
  }

  const output = (job.outputData ?? {}) as Record<string, unknown>;

  if (!output.transcriptionReady) {
    return NextResponse.json(
      { error: "Transcription not yet ready — cannot approve lyrics" },
      { status: 400 },
    );
  }

  if (output.finalVideoUrl || output.renderStartedAt) {
    return NextResponse.json(
      { error: "Render already started or complete for this job" },
      { status: 409 },
    );
  }

  // ── Kick off Phase 2 async — returns immediately ──────────────────────────
  void continueLyricVideoRender(jobId, correctedWords).catch((err: unknown) => {
    console.error(
      `[approve-lyrics] uncaught error for job ${jobId}:`,
      err,
    );
  });

  return NextResponse.json({
    success:        true,
    jobId,
    wordsProvided:  correctedWords ? correctedWords.length : null,
    message:        "Lyric video render started — poll job status for completion.",
  });
}
