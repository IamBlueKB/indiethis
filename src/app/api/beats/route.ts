import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q          = searchParams.get("q")?.trim() ?? "";
  const genre      = searchParams.get("genre") ?? "";
  const key        = searchParams.get("key") ?? "";
  const bpmMin     = parseInt(searchParams.get("bpmMin") ?? "0", 10);
  const bpmMax     = parseInt(searchParams.get("bpmMax") ?? "9999", 10);
  const priceMax   = parseFloat(searchParams.get("priceMax") ?? "99999");
  const priceMin   = parseFloat(searchParams.get("priceMin") ?? "0");
  const leaseOnly  = searchParams.get("leaseOnly") === "1";
  const sort       = searchParams.get("sort") ?? "newest";
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const where: Prisma.TrackWhereInput = {
    status: "PUBLISHED",
    OR: [
      { beatLeaseSettings: { isNot: null } },
      { beatLicenses: { some: {} } },
    ],
    ...(q ? {
      AND: [{
        OR: [
          { title:  { contains: q, mode: "insensitive" } },
          { genre:  { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      }],
    } : {}),
    ...(genre ? { genre: { equals: genre, mode: "insensitive" } } : {}),
    ...(key   ? { musicalKey: { contains: key, mode: "insensitive" } } : {}),
    ...(bpmMin > 0 || bpmMax < 9999 ? { bpm: { gte: bpmMin, lte: bpmMax } } : {}),
    ...(priceMin > 0 || priceMax < 99999 ? { price: { gte: priceMin, lte: priceMax } } : {}),
    ...(leaseOnly ? { beatLeaseSettings: { streamLeaseEnabled: true } } : {}),
  };

  const orderBy: Prisma.TrackOrderByWithRelationInput =
    sort === "popular"   ? { plays: "desc" }   :
    sort === "price-asc" ? { price: "asc" }    :
    sort === "price-desc"? { price: "desc" }   :
    sort === "bpm-asc"   ? { bpm: "asc" }      :
                           { createdAt: "desc" };

  const [beats, total] = await Promise.all([
    db.track.findMany({
      where,
      select: {
        id:          true,
        title:       true,
        coverArtUrl: true,
        fileUrl:     true,
        bpm:         true,
        musicalKey:  true,
        price:       true,
        genre:       true,
        plays:       true,
        artist: {
          select: { id: true, name: true, artistSlug: true, photo: true },
        },
        beatLeaseSettings: {
          select: { streamLeaseEnabled: true },
        },
        beatLicenses:  { select: { id: true } },
        streamLeases:  { select: { id: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.track.count({ where }),
  ]);

  const result = beats.map((b) => ({
    ...b,
    _count: {
      beatLicenses: b.beatLicenses.length,
      streamLeases: b.streamLeases.length,
    },
    beatLicenses:  undefined,
    streamLeases:  undefined,
  }));

  return NextResponse.json({
    beats: result,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
