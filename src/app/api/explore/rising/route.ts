import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 3600;

/**
 * GET /api/explore/rising
 * Artists ranked by combined traction this week:
 * page views + track plays (last 7 days).
 */
export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  // Get artists who have published tracks
  const artists = await db.user.findMany({
    where: {
      role: "ARTIST",
      tracks: { some: { status: "PUBLISHED" } },
    },
    select: {
      id: true,
      name: true,
      photo: true,
      artistSlug: true,
      _count: {
        select: {
          artistPageViews: true,
        },
      },
      tracks: {
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          coverArtUrl: true,
          fileUrl: true,
          plays: true,
          genre: true,
        },
        orderBy: { plays: "desc" },
        take: 1,
      },
    },
    take: 20,
  });

  // Score: page views + total plays on top track (simple proxy for traction)
  const scored = artists
    .filter((a) => a.tracks.length > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      photo: a.photo,
      slug: a.artistSlug,
      topTrack: a.tracks[0] ?? null,
      genre: a.tracks[0]?.genre ?? null,
      score: a._count.artistPageViews + (a.tracks[0]?.plays ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return NextResponse.json({ artists: scored });
}
