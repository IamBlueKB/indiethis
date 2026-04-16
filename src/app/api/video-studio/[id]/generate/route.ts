/**
 * POST /api/video-studio/[id]/generate
 *
 * Manually triggers the generation pipeline for a video.
 * Used for:
 *   - Retrying a FAILED video
 *   - Director Mode: triggering generation after shot list approval
 *
 * Fires an Inngest event and returns immediately (< 1s).
 * All heavy work (FLUX keyframes, Kling i2v, Remotion stitch) runs in Inngest steps.
 *
 * Returns: { started: true }
 */

import { auth }        from "@/lib/auth";
import { db }          from "@/lib/db";
import { inngest }     from "@/inngest/client";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Route only fires Inngest events — no long work here

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }  = await params;
    const session = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: {
        id:                true,
        status:            true,
        userId:            true,
        shotList:          true,
        referenceImageUrl: true,
        thumbnailUrl:      true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only allow triggering from these states
    const triggerableStates = ["PENDING", "PLANNING", "FAILED", "STORYBOARD", "GENERATING"];
    if (!triggerableStates.includes(video.status)) {
      return NextResponse.json({
        error: `Cannot trigger generation from status ${video.status}`,
      }, { status: 400 });
    }

    // If stuck in GENERATING, reset to FAILED first so the pipeline re-runs cleanly
    if (video.status === "GENERATING") {
      await db.musicVideo.update({
        where: { id: video.id },
        data:  { status: "FAILED", progress: 0, currentStep: "Restarting…" },
      });
    }

    // Clear any stale FalSceneJobs from previous failed attempts
    await db.falSceneJob.deleteMany({ where: { musicVideoId: id } });

    const artistImageUrl = video.referenceImageUrl ?? video.thumbnailUrl ?? "";

    if (video.status === "STORYBOARD") {
      // Keyframes are already done. User is approving storyboard → start Kling i2v.
      await inngest.send({
        name: "video/scenes.approved",
        data: { videoId: id },
      });
      console.log(`[generate] Fired scenes.approved for ${id} (STORYBOARD retry)`);
    } else {
      // Full pipeline — keyframes first, then Kling, then stitch.
      const shotList = (video.shotList as Record<string, unknown>[]) ?? [];

      await inngest.send({
        name: "video/generate.requested",
        data: {
          videoId:        id,
          scenes:         shotList,
          artistImageUrl,
        },
      });
      console.log(`[generate] Fired generate.requested for ${id} — ${shotList.length} scenes`);
    }

    return NextResponse.json({ started: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
