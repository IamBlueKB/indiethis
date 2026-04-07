/**
 * POST /api/video-studio/director/[id]/scene-regen
 *
 * Regenerates a single scene in a video and (for standard regens) re-stitches.
 *
 * Two modes:
 *   Standard regen  — body: { sceneIndex }
 *                     Requires video COMPLETE + one free regen token (sceneRegenUsed).
 *
 *   Manual rejection — body: { sceneIndex, redirectNote: string }
 *                      Allows GENERATING or COMPLETE status.
 *                      Capped at one rejection per scene (manualRejected flag on scene).
 *                      Does NOT consume the free regen token.
 *
 * Returns: { success, isFree }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { regenerateScene }       from "@/lib/video-studio/generate";
import { DEFAULT_VIDEO_PRICES }  from "@/lib/video-studio/model-router";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }                  = await params;
    const { sceneIndex, redirectNote } = await req.json() as { sceneIndex: number; redirectNote?: string };
    const isManualReject          = !!redirectNote?.trim();
    const session                 = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, status: true, userId: true, sceneRegenUsed: true, scenes: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (isManualReject) {
      // Manual rejection: allowed during GENERATING or COMPLETE
      if (video.status !== "GENERATING" && video.status !== "COMPLETE") {
        return NextResponse.json({ error: "Video is not in a rejectable state" }, { status: 400 });
      }

      // Verify the specific clip is complete (we need a video to reject)
      type RawScene = { sceneIndex?: number; videoUrl?: string | null; manualRejected?: boolean };
      const scenes    = Array.isArray(video.scenes) ? (video.scenes as RawScene[]) : [];
      const clipScene = scenes.find(s => s.sceneIndex === sceneIndex);
      if (!clipScene?.videoUrl) {
        return NextResponse.json({ error: "Scene clip is not yet complete" }, { status: 400 });
      }
      if (clipScene.manualRejected) {
        return NextResponse.json({ error: "Scene has already been manually rejected" }, { status: 409 });
      }

      await regenerateScene(id, sceneIndex, redirectNote!.trim());
      return NextResponse.json({ success: true, isManualReject: true });
    }

    // Standard regen — requires COMPLETE status and free token
    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Video must be complete to regenerate scenes" }, { status: 400 });
    }

    const isFree = !video.sceneRegenUsed;
    if (!isFree) {
      return NextResponse.json({
        error:           "Paid scene regeneration coming soon",
        cost:            DEFAULT_VIDEO_PRICES.SCENE_REGEN,
        requiresPayment: true,
      }, { status: 402 });
    }

    // Run regeneration pipeline (re-generates clip + re-stitches full video)
    await regenerateScene(id, sceneIndex);

    return NextResponse.json({ success: true, isFree: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/scene-regen]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
