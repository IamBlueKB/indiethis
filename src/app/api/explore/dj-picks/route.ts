import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/explore/dj-picks
 * "Top DJ Picks" — tracks with the most DJ crate adds in the last 30 days.
 * Cold start: if < 5 results, falls back to all-time crate count then qualityScore.
 */
export async function GET() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Step 1: find trackIds with most crate adds in last 30 days
  const recentCrates = await db.crateItem.groupBy({
    by:      ["trackId"],
    where:   { addedAt: { gte: thirtyDaysAgo } },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    20,
  });

  if (recentCrates.length >= 5) {
    // Step 2: fetch track details for those IDs, preserve ranking order
    const trackIds   = recentCrates.map(c => c.trackId);
    const crateMap   = new Map(recentCrates.map(c => [c.trackId, c._count.id]));

    const tracks = await db.track.findMany({
      where:  { id: { in: trackIds }, status: "PUBLISHED" },
      select: {
        id: true, title: true, coverArtUrl: true, canvasVideoUrl: true,
        plays: true, genre: true, fileUrl: true,
        artist: {
          select: {
            id: true, name: true, photo: true, artistSlug: true,
            artistSite: { select: { isPublished: true } },
          },
        },
      },
    });

    // Re-sort by crate count (Prisma doesn't preserve IN order)
    const sorted = tracks
      .map(t => ({ ...t, crateAdds: crateMap.get(t.id) ?? 0 }))
      .sort((a, b) => b.crateAdds - a.crateAdds);

    return NextResponse.json({ tracks: sorted, source: "quality" });
  }

  // Cold start fallback: all-time crate count ordered, then qualityScore
  const fallback = await db.track.findMany({
    where:  { status: "PUBLISHED" },
    select: {
      id: true, title: true, coverArtUrl: true, canvasVideoUrl: true,
      plays: true, genre: true, fileUrl: true, qualityScore: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
      _count: { select: { crateItems: true } },
    },
    orderBy: [{ crateItems: { _count: "desc" } }, { qualityScore: "desc" }],
    take:    20,
  });

  return NextResponse.json({ tracks: fallback, source: "cold_start" });
}
