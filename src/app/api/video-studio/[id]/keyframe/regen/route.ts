/**
 * POST /api/video-studio/[id]/keyframe/regen
 *
 * Regenerates a single FLUX keyframe for one shot during storyboard approval.
 *
 * Body: { sceneIndex: number }
 *
 * Rules:
 *   - Video must be in STORYBOARD status
 *   - Shot must have redoCount < 3 (max 3 regenerations per shot)
 *   - Increments redoCount, replaces keyframeUrl on the shot
 *
 * Returns: { keyframeUrl: string, redoCount: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { fal }                       from "@fal-ai/client";
import { generateSceneKeyframe }     from "@/lib/video-studio/generator";

export const maxDuration = 130; // FLUX Kontext Pro can take up to 120s; give it headroom

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }        = await params;
    const { sceneIndex } = await req.json() as { sceneIndex: number };

    if (typeof sceneIndex !== "number") {
      return NextResponse.json({ error: "sceneIndex required" }, { status: 400 });
    }

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { status: true, shotList: true, referenceImageUrl: true, thumbnailUrl: true, aspectRatio: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (video.status !== "STORYBOARD") {
      return NextResponse.json(
        { error: `Cannot regenerate keyframe from status ${video.status}` },
        { status: 400 },
      );
    }

    type ShotItem = {
      index?:          number;
      description?:    string;
      cameraDirection?: string;
      filmLook?:       string;
      keyframeUrl?:    string;
      redoCount?:      number;
      [key: string]:   unknown;
    };

    const shotList: ShotItem[] = Array.isArray(video.shotList)
      ? (video.shotList as ShotItem[])
      : [];

    const shot = shotList[sceneIndex];
    if (!shot) {
      return NextResponse.json({ error: `Shot ${sceneIndex} not found` }, { status: 404 });
    }

    const currentRedoCount = shot.redoCount ?? 0;
    if (currentRedoCount >= 3) {
      return NextResponse.json(
        { error: "Maximum regenerations reached for this shot (3/3)" },
        { status: 400 },
      );
    }

    const referencePhotoUrl = video.referenceImageUrl ?? video.thumbnailUrl ?? null;
    if (!referencePhotoUrl) {
      return NextResponse.json({ error: "No reference photo available" }, { status: 400 });
    }

    // Configure fal.ai
    const falKey = process.env.FAL_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    fal.config({ credentials: falKey });

    // Generate new keyframe
    const newKeyframeUrl = await generateSceneKeyframe(
      referencePhotoUrl,
      shot.description ?? "music video scene",
      shot.cameraDirection,
      shot.filmLook,
      video.aspectRatio ?? "16:9",
    );

    // Update the shot in the shot list
    const newRedoCount = currentRedoCount + 1;
    const updatedShotList = shotList.map((s, i) =>
      i === sceneIndex
        ? { ...s, keyframeUrl: newKeyframeUrl, redoCount: newRedoCount }
        : s
    );

    await db.musicVideo.update({
      where: { id },
      data:  { shotList: updatedShotList as object[] },
    });

    return NextResponse.json({ keyframeUrl: newKeyframeUrl, redoCount: newRedoCount });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[keyframe/regen] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
