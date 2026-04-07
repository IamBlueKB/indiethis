/**
 * GET    /api/dashboard/releases/[id]  — get single release with all asset details
 * PUT    /api/dashboard/releases/[id]  — update release (tracks, linked assets, title, date)
 * DELETE /api/dashboard/releases/[id]  — delete release grouping (assets untouched)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// ─── Shared enrichment helper ─────────────────────────────────────────────────

async function enrichRelease(releaseId: string, userId: string) {
  const release = await db.release.findUnique({ where: { id: releaseId } });
  if (!release || release.userId !== userId) return null;

  const trackIds = (release.trackIds as string[]) ?? [];

  const tracks = await db.track.findMany({
    where:  { id: { in: trackIds }, artistId: userId },
    select: { id: true, title: true, coverArtUrl: true, fileUrl: true, canvasVideoUrl: true },
  });

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
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const release = await enrichRelease(id, session.user.id);
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ release });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const existing = await db.release.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    title?:           string;
    trackIds?:        string[];
    coverArtJobId?:   string | null;
    musicVideoId?:    string | null;
    lyricVideoId?:    string | null;
    canvasVideoId?:   string | null;
    masteredTrackId?: string | null;
    releaseDate?:     string | null;
  };

  // Validate new trackIds if provided
  if (body.trackIds !== undefined) {
    if (!Array.isArray(body.trackIds) || body.trackIds.length === 0) {
      return NextResponse.json({ error: "trackIds must be a non-empty array" }, { status: 400 });
    }
    const owned = await db.track.findMany({
      where:  { id: { in: body.trackIds }, artistId: userId },
      select: { id: true },
    });
    if (owned.length !== body.trackIds.length) {
      return NextResponse.json({ error: "One or more track IDs are invalid" }, { status: 400 });
    }
  }

  const updated = await db.release.update({
    where: { id },
    data: {
      ...(body.title          !== undefined ? { title:           body.title?.trim() }   : {}),
      ...(body.trackIds       !== undefined ? { trackIds:        body.trackIds }         : {}),
      ...(body.coverArtJobId  !== undefined ? { coverArtJobId:   body.coverArtJobId }    : {}),
      ...(body.musicVideoId   !== undefined ? { musicVideoId:    body.musicVideoId }     : {}),
      ...(body.lyricVideoId   !== undefined ? { lyricVideoId:    body.lyricVideoId }     : {}),
      ...(body.canvasVideoId  !== undefined ? { canvasVideoId:   body.canvasVideoId }    : {}),
      ...(body.masteredTrackId !== undefined ? { masteredTrackId: body.masteredTrackId } : {}),
      ...(body.releaseDate    !== undefined ? { releaseDate:     body.releaseDate ? new Date(body.releaseDate) : null } : {}),
    },
  });

  return NextResponse.json({ release: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const existing = await db.release.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.release.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
