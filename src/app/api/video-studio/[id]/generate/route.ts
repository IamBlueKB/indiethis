/**
 * POST /api/video-studio/[id]/generate
 *
 * Manually triggers the generation pipeline for a video.
 * Used for:
 *   - Retrying a FAILED video
 *   - Director Mode: triggering generation after shot list approval
 *
 * Requires the video to be owned by the requesting user (or guest with no userId).
 * Fires generation in background and returns immediately.
 *
 * Returns: { started: true }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { startGeneration }       from "@/lib/video-studio/generate";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }  = await params;
    const session = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, status: true, userId: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only allow triggering from these states
    // STORYBOARD = Director Mode awaiting approval; artist clicked "Accept All"
    const triggerableStates = ["PENDING", "PLANNING", "FAILED", "STORYBOARD"];
    if (!triggerableStates.includes(video.status)) {
      return NextResponse.json({
        error: `Cannot trigger generation from status ${video.status}`,
      }, { status: 400 });
    }

    // Clear any stale FalSceneJobs from previous failed attempts so
    // the webhook scene-count check isn't corrupted by old records.
    await db.falSceneJob.deleteMany({ where: { musicVideoId: id } });

    await startGeneration(id);

    return NextResponse.json({ started: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
