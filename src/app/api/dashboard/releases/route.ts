/**
 * GET  /api/dashboard/releases  — list all releases for the authenticated user
 * POST /api/dashboard/releases  — create a new release
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

// ─── GET — list all releases ──────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const releases = await db.release.findMany({
    where:   { userId },
    orderBy: { updatedAt: "desc" },
  });

  // Enrich each release with linked asset details
  const enriched = await Promise.all(releases.map(async (release) => {
    const trackIds = (release.trackIds as string[]) ?? [];

    // Tracks
    const tracks = await db.track.findMany({
      where:  { id: { in: trackIds }, artistId: userId },
      select: { id: true, title: true, coverArtUrl: true, fileUrl: true, canvasVideoUrl: true },
    });

    // Linked creative assets
    const [coverArtJob, musicVideo, lyricVideo] = await Promise.all([
      release.coverArtJobId
        ? db.coverArtJob.findUnique({ where: { id: release.coverArtJobId }, select: { id: true, status: true, selectedUrl: true } })
        : null,
      release.musicVideoId
        ? db.musicVideo.findUnique({ where: { id: release.musicVideoId }, select: { id: true, status: true, finalVideoUrl: true, thumbnailUrl: true } })
        : null,
      release.lyricVideoId
        ? db.lyricVideo.findUnique({ where: { id: release.lyricVideoId }, select: { id: true, status: true, finalVideoUrl: true } })
        : null,
    ]);

    // Canvas video — from the canvasVideoId track
    const canvasTrack = release.canvasVideoId
      ? tracks.find(t => t.id === release.canvasVideoId) ?? null
      : null;

    return {
      ...release,
      tracks,
      coverArtJob,
      musicVideo,
      lyricVideo,
      canvasVideoUrl: canvasTrack?.canvasVideoUrl ?? null,
    };
  }));

  return NextResponse.json({ releases: enriched });
}

// ─── POST — create a new release ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { title, trackIds } = body as { title?: string; trackIds?: string[] };

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return NextResponse.json({ error: "trackIds must be a non-empty array" }, { status: 400 });
  }

  // Validate all tracks belong to this user
  const ownedTracks = await db.track.findMany({
    where: { id: { in: trackIds }, artistId: userId },
    select: { id: true },
  });
  if (ownedTracks.length !== trackIds.length) {
    return NextResponse.json({ error: "One or more track IDs are invalid" }, { status: 400 });
  }

  const release = await db.release.create({
    data: {
      userId,
      title:    title.trim(),
      trackIds: trackIds,
    },
  });

  return NextResponse.json({ release }, { status: 201 });
}
