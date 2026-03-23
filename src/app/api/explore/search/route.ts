import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/explore/search?q=
 * Universal search across artists, tracks, studios.
 * Returns top 3 per category.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ artists: [], tracks: [], studios: [] });

  const [artists, tracks, studios] = await Promise.all([
    db.user.findMany({
      where: {
        role: "ARTIST",
        name: { contains: q, mode: "insensitive" },
        tracks: { some: { status: "PUBLISHED" } },
      },
      select: { id: true, name: true, photo: true },
      take: 3,
    }),

    db.track.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
          { genre: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        coverArtUrl: true,
        fileUrl: true,
        genre: true,
        artist: { select: { id: true, name: true } },
      },
      take: 3,
    }),

    db.studio.findMany({
      where: {
        isPublished: true,
        moderationStatus: "CLEAN",
        OR: [
          { name:    { contains: q, mode: "insensitive" } },
          { city:    { contains: q, mode: "insensitive" } },
          { tagline: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, city: true, state: true, logoUrl: true },
      take: 3,
    }),
  ]);

  return NextResponse.json({ artists, tracks, studios });
}
