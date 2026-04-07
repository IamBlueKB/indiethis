/**
 * POST /api/video-studio/[id]/regenerate
 *
 * Re-stitches a completed video without re-generating scene clips.
 * Used when the user modifies shot list metadata or timing after completion.
 *
 * Different from scene-regen (which re-generates a specific clip).
 * This re-runs only the Remotion Lambda stitching step using existing scene URLs.
 *
 * Returns: { started: true }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { generateMultiFormatVideos } from "@/lib/video-studio/generator";
import type { GeneratedSceneOutput } from "@/lib/video-studio/generator";
import { NextRequest, NextResponse } from "next/server";

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
        id:            true,
        status:        true,
        userId:        true,
        scenes:        true,
        audioUrl:      true,
        aspectRatio:   true,
        trackDuration: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Video must be complete to re-stitch" }, { status: 400 });
    }

    const scenes = (video.scenes as GeneratedSceneOutput[] | null) ?? [];
    const validScenes = scenes.filter(s => s.videoUrl);
    if (validScenes.length === 0) {
      return NextResponse.json({ error: "No valid scene clips to stitch" }, { status: 400 });
    }

    // Re-stitch in background
    void (async () => {
      try {
        await db.musicVideo.update({
          where: { id },
          data:  { status: "STITCHING", progress: 80, currentStep: "Re-stitching your video…" },
        });

        const durationMs      = Math.round(video.trackDuration * 1000);
        const finalVideoUrls  = await generateMultiFormatVideos(
          id,
          validScenes,
          video.audioUrl,
          [video.aspectRatio],
          durationMs,
        );

        const finalVideoUrl = finalVideoUrls[video.aspectRatio] ?? Object.values(finalVideoUrls)[0] ?? null;

        await db.musicVideo.update({
          where: { id },
          data:  {
            status:         "COMPLETE",
            progress:       100,
            currentStep:    "Complete!",
            finalVideoUrl:  finalVideoUrl ?? undefined,
            finalVideoUrls: (Object.keys(finalVideoUrls).length > 0 ? finalVideoUrls : null) as object | undefined,
          },
        });
      } catch (err) {
        console.error(`[regenerate] re-stitch failed for ${id}:`, err);
        await db.musicVideo.update({
          where: { id },
          data:  { status: "COMPLETE", progress: 100, currentStep: "Complete!" }, // revert on failure
        }).catch(() => {});
      }
    })();

    return NextResponse.json({ started: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
