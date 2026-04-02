import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/explore/new-releases?genre=Hip-Hop
 * "New Releases" — tracks published in the last 14 days, newest first.
 * Qualifying: must have cover art.
 * Cold start: if < 5 qualifying, relaxes cover art requirement and extends to 30 days.
 */
export async function GET(req: NextRequest) {
  const genre       = req.nextUrl.searchParams.get("genre");
  const genreFilter = genre ? { genre } : {};

  const since = new Date();
  since.setDate(since.getDate() - 14);

  // Primary: last 14 days, cover art required
  const tracks = await db.track.findMany({
    where: {
      status:      "PUBLISHED",
      createdAt:   { gte: since },
      coverArtUrl: { not: null },
      ...genreFilter,
    },
    select: {
      id: true, title: true, coverArtUrl: true, canvasVideoUrl: true,
      plays: true, genre: true, fileUrl: true, createdAt: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    20,
  });

  if (tracks.length >= 5) {
    return NextResponse.json({ tracks, source: "quality" });
  }

  // Cold start fallback: relax cover art, extend window to 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fallback = await db.track.findMany({
    where: {
      status:    "PUBLISHED",
      createdAt: { gte: thirtyDaysAgo },
      ...genreFilter,
    },
    select: {
      id: true, title: true, coverArtUrl: true, canvasVideoUrl: true,
      plays: true, genre: true, fileUrl: true, createdAt: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
    },
    orderBy: [{ qualityScore: "desc" }, { createdAt: "desc" }],
    take:    20,
  });

  return NextResponse.json({ tracks: fallback, source: "cold_start" });
}
