import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/explore/studios?city=Atlanta&state=GA&q=
 * Returns published studios, optionally filtered by city/state or text search.
 * No caching — location-specific.
 */
export async function GET(req: NextRequest) {
  const city  = req.nextUrl.searchParams.get("city")?.trim();
  const state = req.nextUrl.searchParams.get("state")?.trim();
  const q     = req.nextUrl.searchParams.get("q")?.trim();

  const studios = await db.studio.findMany({
    where: {
      isPublished: true,
      moderationStatus: "CLEAN",
      ...(city  ? { city:  { contains: city,  mode: "insensitive" } } : {}),
      ...(state ? { state: { contains: state, mode: "insensitive" } } : {}),
      ...(q     ? {
        OR: [
          { name:    { contains: q, mode: "insensitive" } },
          { city:    { contains: q, mode: "insensitive" } },
          { tagline: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      tagline: true,
      logoUrl: true,
      heroImage: true,
      photos: true,
    },
    orderBy: { name: "asc" },
    take: 6,
  });

  return NextResponse.json({ studios });
}
