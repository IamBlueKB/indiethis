/**
 * POST /api/video-studio/director/[id]/scene-regen
 *
 * Regenerates a single scene in a completed video and re-stitches.
 * Each video gets ONE free regeneration via sceneRegenUsed flag.
 * Subsequent regens return 402 (paid regen coming soon).
 *
 * Body: { sceneIndex: number }
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
    const { id }         = await params;
    const { sceneIndex } = await req.json() as { sceneIndex: number };
    const session        = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, status: true, userId: true, sceneRegenUsed: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Video must be complete to regenerate scenes" }, { status: 400 });
    }

    // Ownership check
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
