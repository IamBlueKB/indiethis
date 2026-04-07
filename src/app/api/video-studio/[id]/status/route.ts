/**
 * GET /api/video-studio/[id]/status
 *
 * Polling endpoint for the generating screen.
 * Returns status, progress, and output URLs.
 * Public — access is by knowing the ID (no auth check).
 */

import { db }            from "@/lib/db";
import { NextResponse }  from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await db.musicVideo.findUnique({
    where:  { id },
    select: {
      id:             true,
      status:         true,
      progress:       true,
      currentStep:    true,
      mode:           true,
      videoLength:    true,
      aspectRatio:    true,
      trackTitle:     true,
      bpm:            true,
      musicalKey:     true,
      energy:         true,
      finalVideoUrl:  true,
      finalVideoUrls: true,
      thumbnailUrl:   true,
      scenes:         true,
      errorMessage:   true,
      amount:         true,
      createdAt:      true,
    },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id:             video.id,
    status:         video.status,
    progress:       video.progress,
    currentStep:    video.currentStep,
    mode:           video.mode,
    videoLength:    video.videoLength,
    aspectRatio:    video.aspectRatio,
    trackTitle:     video.trackTitle,
    bpm:            video.bpm,
    musicalKey:     video.musicalKey,
    energy:         video.energy,
    finalVideoUrl:  video.finalVideoUrl,
    finalVideoUrls: video.finalVideoUrls,
    thumbnailUrl:   video.thumbnailUrl,
    sceneCount:     Array.isArray(video.scenes) ? video.scenes.length : 0,
    errorMessage:   video.errorMessage,
    amount:         video.amount,
    createdAt:      video.createdAt.toISOString(),
  });
}
