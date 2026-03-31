import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 3600; // 1 hour

/**
 * GET /api/explore/trending?genre=Hip-Hop
 * Tracks ranked by total plays (with genre filter support).
 */
export async function GET(req: NextRequest) {
  const genre = req.nextUrl.searchParams.get("genre");

  const tracks = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      ...(genre ? { genre } : {}),
    },
    select: {
      id: true,
      title: true,
      coverArtUrl: true,
      canvasVideoUrl: true,
      plays: true,
      genre: true,
      fileUrl: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
    },
    orderBy: { plays: "desc" },
    take: 12,
  });

  return NextResponse.json({ tracks });
}
