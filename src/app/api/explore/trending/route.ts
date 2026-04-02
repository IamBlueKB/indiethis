import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const TRACK_SELECT = {
  id: true, title: true, coverArtUrl: true, canvasVideoUrl: true,
  plays: true, genre: true, fileUrl: true, qualityScore: true,
  artist: {
    select: {
      id: true, name: true, photo: true, artistSlug: true,
      artistSite: { select: { isPublished: true } },
    },
  },
} as const;

/**
 * GET /api/explore/trending?genre=Hip-Hop
 * "Trending This Week" — ranked by pre-computed qualityScore (velocity-based).
 * Qualifying: at least 5 total plays.
 * Cold start: if < 5 qualifying tracks, falls back to profile completeness + recency.
 */
export async function GET(req: NextRequest) {
  const genre       = req.nextUrl.searchParams.get("genre");
  const genreFilter = genre ? { genre } : {};

  // Primary: qualityScore-ranked, minimum 5 plays
  const tracks = await db.track.findMany({
    where: {
      status:       "PUBLISHED",
      plays:        { gte: 5 },
      qualityScore: { gt: 0 },
      ...genreFilter,
    },
    select:  TRACK_SELECT,
    orderBy: { qualityScore: "desc" },
    take:    20,
  });

  if (tracks.length >= 5) {
    return NextResponse.json({ tracks, source: "quality" });
  }

  // Cold start fallback: cover art + recency ordering
  const fallback = await db.track.findMany({
    where: {
      status:      "PUBLISHED",
      coverArtUrl: { not: null },
      ...genreFilter,
    },
    select:  TRACK_SELECT,
    orderBy: [{ qualityScore: "desc" }, { createdAt: "desc" }],
    take:    20,
  });

  return NextResponse.json({ tracks: fallback, source: "cold_start" });
}
