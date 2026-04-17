/**
 * POST /api/video-studio/[id]/generate
 *
 * Manually triggers the generation pipeline for a video.
 * Used for:
 *   - Retrying a FAILED video
 *   - Director Mode: triggering generation after shot list approval
 *
 * No Inngest — submits fal.ai jobs directly and returns immediately.
 * All heavy work runs via fal.ai webhooks:
 *   /webhook/keyframe → keyframe images
 *   /webhook/fal      → scene clips + stitch
 *
 * Returns: { started: true }
 */

import { auth }          from "@/lib/auth";
import { db }            from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  startKeyframeGeneration,
  startSceneGeneration,
} from "@/lib/video-studio/pipeline";

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

    // If stuck in GENERATING, reset so the pipeline re-runs cleanly
    if (video.status === "GENERATING") {
      await db.musicVideo.update({
        where: { id: video.id },
        data:  { status: "FAILED", progress: 0, currentStep: "Restarting…" },
      });
    }

    const artistImageUrl = video.referenceImageUrl ?? video.thumbnailUrl ?? "";

    if (video.status === "STORYBOARD") {
      // Keyframes are already done. User approved storyboard → start Kling i2v.
      await startSceneGeneration(id);
      console.log(`[generate] Started scene generation for ${id} (STORYBOARD retry)`);
    } else {
      // Full pipeline — keyframes first, then Kling, then stitch.
      const shotList = (video.shotList as Record<string, unknown>[]) ?? [];
      await startKeyframeGeneration(id, shotList, artistImageUrl);
      console.log(`[generate] Started keyframe generation for ${id} — ${shotList.length} scenes`);
    }

    return NextResponse.json({ started: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
