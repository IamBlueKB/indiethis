/**
 * POST /api/video-studio/director/[id]/scene-regen
 *
 * Regenerates a single scene in a completed video.
 * Each video gets ONE free regeneration; subsequent ones charge SCENE_REGEN ($2.99).
 *
 * Body: { sceneIndex: number }
 * Returns: { videoUrl, estimatedCost, isFree }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { fal }                   from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_VIDEO_PRICES }  from "@/lib/video-studio/model-router";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }       = await params;
    const { sceneIndex } = await req.json() as { sceneIndex: number };
    const session      = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, status: true, shotList: true, scenes: true, userId: true, aspectRatio: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.status !== "COMPLETE" && video.status !== "FAILED") {
      return NextResponse.json({ error: "Video must be complete to regenerate scenes" }, { status: 400 });
    }

    // Check ownership
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shotList = (video.shotList as any[]) ?? [];
    const scene    = shotList[sceneIndex];
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    // Check if free regen is available (one per video)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingScenes = (video.scenes as any[]) ?? [];
    const regenCount     = existingScenes.filter((s: { regenCount?: number }) => (s.regenCount ?? 0) > 0).length;
    const isFree         = regenCount === 0;
    const cost           = isFree ? 0 : DEFAULT_VIDEO_PRICES.SCENE_REGEN;

    // TODO: implement Stripe charge for paid regens
    // For now: allow free regen only
    if (!isFree) {
      return NextResponse.json({
        error:         "Paid scene regeneration coming soon",
        cost,
        requiresPayment: true,
      }, { status: 402 });
    }

    // Generate the scene
    const falKey = process.env.FAL_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
    fal.config({ credentials: falKey });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe(scene.model as any, {
      input: {
        prompt:       scene.prompt,
        duration:     Math.round(scene.duration ?? 5),
        aspect_ratio: video.aspectRatio === "9:16" ? "9:16"
                    : video.aspectRatio === "1:1"  ? "1:1" : "16:9",
      },
      pollInterval: 4000,
      logs:         false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output   = (result as any).data ?? result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoUrl = (output as any)?.video?.url ?? (output as any)?.url ?? "";

    if (!videoUrl) return NextResponse.json({ error: "Generation produced no output" }, { status: 500 });

    // Update scene in the scenes array
    const updatedScenes = existingScenes.map((s: { sceneIndex?: number; regenCount?: number }, i: number) =>
      i === sceneIndex
        ? { ...s, videoUrl, regenCount: (s.regenCount ?? 0) + 1 }
        : s
    );

    await db.musicVideo.update({
      where: { id },
      data:  { scenes: updatedScenes },
    });

    return NextResponse.json({ videoUrl, isFree, cost });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/scene-regen]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
