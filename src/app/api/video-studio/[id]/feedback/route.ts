/**
 * POST /api/video-studio/[id]/feedback
 *
 * Record artist feedback on a generated music video or individual scene.
 * Used by the learning agent to improve future prompt generation.
 *
 * Body: {
 *   sceneIndex?: number   // omit or -1 for overall video rating
 *   rating?:     number   // 1–5 stars
 *   liked?:      boolean  // thumbs up/down
 *   notes?:      string   // optional comment
 * }
 *
 * Auth: anyone who knows the video ID (guest-accessible).
 * Ownership is enforced loosely — we don't block anonymous ratings since
 * guest videos have no session. The video must exist and be COMPLETE.
 */

import { NextRequest, NextResponse }            from "next/server";
import { db }                                   from "@/lib/db";
import { submitFeedback, analyzePromptPatterns } from "@/lib/video-studio/feedback";

export async function POST(
  req:      NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Verify video exists and is complete
    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, status: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Video not complete yet" }, { status: 400 });
    }

    // Parse body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as Record<string, any>;
    const { sceneIndex, rating, liked, notes } = body;

    // Basic validation
    if (rating != null && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
    }
    if (liked != null && typeof liked !== "boolean") {
      return NextResponse.json({ error: "liked must be boolean" }, { status: 400 });
    }
    if (rating == null && liked == null) {
      return NextResponse.json({ error: "Provide rating or liked" }, { status: 400 });
    }

    // Store feedback
    await submitFeedback(id, { sceneIndex, rating, liked, notes });

    // Trigger pattern analysis in background — fire and forget
    analyzePromptPatterns().catch(err =>
      console.error("[feedback API] analyzePromptPatterns:", err)
    );

    return NextResponse.json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[feedback API]", msg);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
