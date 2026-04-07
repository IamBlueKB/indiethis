/**
 * GET /api/video-studio/[id]/download?format=16:9
 *
 * Returns the download URL for a completed music video.
 * Optionally accepts a format query param to select from finalVideoUrls.
 * Public — anyone with the video ID can download.
 */

import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await params;
    const format   = req.nextUrl.searchParams.get("format") ?? null;

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: {
        id:            true,
        status:        true,
        trackTitle:    true,
        finalVideoUrl: true,
        finalVideoUrls: true,
        aspectRatio:   true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Video not ready" }, { status: 400 });
    }

    // Resolve URL: prefer matching format → primary URL
    const urls = (video.finalVideoUrls as Record<string, string> | null) ?? {};
    const requestedFormat = format ?? video.aspectRatio ?? "16:9";
    const downloadUrl = urls[requestedFormat] ?? video.finalVideoUrl ?? null;

    if (!downloadUrl) {
      return NextResponse.json({ error: "No download URL available" }, { status: 404 });
    }

    const fileName = `${video.trackTitle.replace(/\s+/g, "-").toLowerCase()}-music-video.mp4`;

    return NextResponse.json({ url: downloadUrl, fileName, format: requestedFormat });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
