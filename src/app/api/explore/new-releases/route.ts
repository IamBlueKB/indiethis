import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 1800; // 30 minutes

/**
 * GET /api/explore/new-releases?genre=Hip-Hop
 * Tracks published in the last 14 days, newest first.
 */
export async function GET(req: NextRequest) {
  const genre = req.nextUrl.searchParams.get("genre");
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const tracks = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      createdAt: { gte: since },
      ...(genre ? { genre } : {}),
    },
    select: {
      id: true,
      title: true,
      coverArtUrl: true,
      plays: true,
      genre: true,
      fileUrl: true,
      createdAt: true,
      artist: {
        select: { id: true, name: true, photo: true, artistSlug: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return NextResponse.json({ tracks });
}
