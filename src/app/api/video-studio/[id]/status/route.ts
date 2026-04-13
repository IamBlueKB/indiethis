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
      trackDuration:  true,
      bpm:            true,
      musicalKey:     true,
      energy:         true,
      finalVideoUrl:  true,
      finalVideoUrls: true,
      thumbnailUrl:   true,
      scenes:         true,
      shotList:       true,
      songStructure:  true,
      creativeBrief:  true,
      errorMessage:   true,
      amount:         true,
      createdAt:      true,
    },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build per-scene clip status from the scenes JSON
  type RawScene = { sceneIndex?: number; videoUrl?: string | null; thumbnailUrl?: string | null; manualRejected?: boolean };
  const rawScenes  = Array.isArray(video.scenes) ? (video.scenes as RawScene[]) : [];
  const clips = rawScenes.map(s => ({
    sceneIndex:     s.sceneIndex ?? 0,
    videoUrl:       s.videoUrl ?? null,
    thumbnailUrl:   s.thumbnailUrl ?? null,
    status:         s.videoUrl
      ? "complete"
      : (video.status === "GENERATING" ? "generating" : "pending"),
    manualRejected: s.manualRejected ?? false,
  }));

  // Song sections from analysis
  type Analysis = { sections?: Array<{ type: string; startTime: number; endTime: number; energy: number }> };
  const analysis     = video.songStructure as Analysis | null;
  const songSections = analysis?.sections ?? [];

  return NextResponse.json({
    id:             video.id,
    status:         video.status,
    progress:       video.progress,
    currentStep:    video.currentStep,
    mode:           video.mode,
    videoLength:    video.videoLength,
    aspectRatio:    video.aspectRatio,
    trackTitle:     video.trackTitle,
    trackDuration:  video.trackDuration,
    bpm:            video.bpm,
    musicalKey:     video.musicalKey,
    energy:         video.energy,
    finalVideoUrl:  video.finalVideoUrl,
    finalVideoUrls: video.finalVideoUrls,
    thumbnailUrl:   video.thumbnailUrl,
    sceneCount:     rawScenes.length > 0 ? rawScenes.length : (Array.isArray(video.shotList) ? (video.shotList as unknown[]).length : 0),
    shotList:       Array.isArray(video.shotList) ? video.shotList : [],
    clips,
    songSections,
    brief:          video.creativeBrief ?? null,
    analysisReady:  !!video.songStructure,
    errorMessage:   video.errorMessage,
    amount:         video.amount,
    createdAt:      video.createdAt.toISOString(),
  });
}
