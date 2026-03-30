import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/explore/djs — public DJ directory
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get("genre");
  const city = searchParams.get("city");
  const sort = searchParams.get("sort") ?? "crates";

  const djs = await db.dJProfile.findMany({
    where: {
      // Only DJs who have activated DJ mode
      user: { djMode: true },
      // Genre filter — check if genres array contains the genre
      ...(genre ? { genres: { has: genre } } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      slug: true,
      genres: true,
      city: true,
      profilePhotoUrl: true,
      isVerified: true,
      user: {
        select: {
          name: true,
          artistName: true,
          photo: true,
        },
      },
      crates: {
        where: { isPublic: true },
        select: {
          _count: { select: { items: true } },
        },
      },
    },
    take: 60,
  });

  // Compute total crate items per DJ
  const djsWithCounts = djs.map(dj => ({
    id: dj.id,
    slug: dj.slug,
    genres: dj.genres,
    city: dj.city,
    profilePhotoUrl: dj.profilePhotoUrl,
    isVerified: dj.isVerified,
    user: dj.user,
    totalCrateItems: dj.crates.reduce((sum, c) => sum + c._count.items, 0),
  }));

  // Sort
  if (sort === "crates") {
    djsWithCounts.sort((a, b) => b.totalCrateItems - a.totalCrateItems);
  }

  // Rising DJs — top 6 by crate items
  const rising = [...djsWithCounts]
    .sort((a, b) => b.totalCrateItems - a.totalCrateItems)
    .slice(0, 6);

  return NextResponse.json({ djs: djsWithCounts, rising });
}
