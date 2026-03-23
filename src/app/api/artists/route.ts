import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q    = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "all";   // all | artist | producer
  const genre = searchParams.get("genre") ?? "";
  const city  = searchParams.get("city")?.trim() ?? "";
  const sort  = searchParams.get("sort") ?? "trending";
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const skip = (page - 1) * PAGE_SIZE;

  // ── Common search filter ─────────────────────────────────────────────────
  const searchFilter: Prisma.UserWhereInput = q ? {
    OR: [
      { name:       { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
      { city:       { contains: q, mode: "insensitive" } },
      { genres:     { has: q } },
    ],
  } : {};

  const cityFilter: Prisma.UserWhereInput = city
    ? { city: { contains: city, mode: "insensitive" } }
    : {};

  const genreFilter: Prisma.UserWhereInput = genre
    ? { genres: { has: genre } }
    : {};

  const baseFilter: Prisma.UserWhereInput = {
    isSuspended: false,
    ...searchFilter,
    ...cityFilter,
    ...genreFilter,
  };

  // ── Order by ─────────────────────────────────────────────────────────────
  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "az"       ? { name: "asc" }       :
    sort === "newest"   ? { createdAt: "desc" } :
    sort === "mostfans" ? { fanContacts: { _count: "desc" } } :
    /* trending */        { artistPageViews: { _count: "desc" } };

  // ── Shared select ─────────────────────────────────────────────────────────
  const userSelect = {
    id:         true,
    name:       true,
    artistName: true,
    photo:      true,
    city:       true,
    genres:     true,
    artistSlug: true,
    createdAt:  true,
    _count: {
      select: { fanContacts: true },
    },
  } satisfies Prisma.UserSelect;

  // ── Artists query ─────────────────────────────────────────────────────────
  const artistFilter: Prisma.UserWhereInput = {
    ...baseFilter,
    artistSlug: { not: null },
    tracks: { some: { status: "PUBLISHED" } },
  };

  // ── Producers query ───────────────────────────────────────────────────────
  const producerFilter: Prisma.UserWhereInput = {
    ...baseFilter,
    tracks: {
      some: {
        status: "PUBLISHED",
        beatLeaseSettings: { isNot: null },
      },
    },
  };

  if (type === "artist") {
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: artistFilter,
        select: {
          ...userSelect,
          tracks: {
            where: { status: "PUBLISHED" },
            select: { id: true, title: true, fileUrl: true, coverArtUrl: true, plays: true, genre: true },
            orderBy: { plays: "desc" },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: PAGE_SIZE,
      }),
      db.user.count({ where: artistFilter }),
    ]);

    return NextResponse.json({
      artists: users.map((u) => ({
        ...u,
        type:     "artist" as const,
        topTrack: u.tracks[0] ?? null,
        tracks:   undefined,
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  }

  if (type === "producer") {
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: producerFilter,
        select: {
          ...userSelect,
          producerProfile: {
            select: {
              displayName:              true,
              defaultLeasePrice:        true,
              defaultNonExclusivePrice: true,
            },
          },
          tracks: {
            where: { status: "PUBLISHED", beatLeaseSettings: { isNot: null } },
            select: {
              id:          true,
              title:       true,
              fileUrl:     true,
              coverArtUrl: true,
              plays:       true,
              price:       true,
              beatLeaseSettings: { select: { streamLeaseEnabled: true } },
            },
            orderBy: { plays: "desc" },
          },
        },
        orderBy,
        skip,
        take: PAGE_SIZE,
      }),
      db.user.count({ where: producerFilter }),
    ]);

    return NextResponse.json({
      producers: users.map((u) => {
        const beats         = u.tracks ?? [];
        const minPrice      = beats.reduce((min, b) => b.price != null && b.price < min ? b.price : min, Infinity);
        const hasStreamLease = beats.some((b) => b.beatLeaseSettings?.streamLeaseEnabled);
        return {
          ...u,
          type:            "producer" as const,
          topBeat:         beats[0] ?? null,
          beatCount:       beats.length,
          minPrice:        minPrice === Infinity ? null : minPrice,
          hasStreamLease,
          tracks:          undefined,
        };
      }),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  }

  // ── All: artists + producers, deduped ─────────────────────────────────────
  const [artists, producers] = await Promise.all([
    db.user.findMany({
      where: artistFilter,
      select: {
        ...userSelect,
        tracks: {
          where: { status: "PUBLISHED" },
          select: { id: true, title: true, fileUrl: true, coverArtUrl: true, plays: true, genre: true },
          orderBy: { plays: "desc" },
          take: 1,
        },
      },
      orderBy,
      take: PAGE_SIZE,
    }),
    db.user.findMany({
      where: producerFilter,
      select: {
        ...userSelect,
        producerProfile: {
          select: {
            displayName:       true,
            defaultLeasePrice: true,
          },
        },
        tracks: {
          where: { status: "PUBLISHED", beatLeaseSettings: { isNot: null } },
          select: {
            id: true, title: true, fileUrl: true, coverArtUrl: true, plays: true, price: true,
            beatLeaseSettings: { select: { streamLeaseEnabled: true } },
          },
          orderBy: { plays: "desc" },
        },
      },
      orderBy,
      take: PAGE_SIZE,
    }),
  ]);

  // Merge and dedup — a user who is both shows up once as "both"
  const artistIds = new Set(artists.map((a) => a.id));
  const producerIds = new Set(producers.map((p) => p.id));

  const merged = [
    ...artists.map((u) => ({
      ...u,
      type:            producerIds.has(u.id) ? ("both" as const) : ("artist" as const),
      topTrack:        u.tracks[0] ?? null,
      tracks:          undefined,
      topBeat:         null as null,
      beatCount:       0,
      minPrice:        null as number | null,
      hasStreamLease:  false,
      producerProfile: null as null,
    })),
    ...producers
      .filter((p) => !artistIds.has(p.id)) // skip already added
      .map((u) => {
        const beats         = u.tracks ?? [];
        const minPrice      = beats.reduce((min, b) => b.price != null && b.price < min ? b.price : min, Infinity);
        const hasStreamLease = beats.some((b) => b.beatLeaseSettings?.streamLeaseEnabled);
        return {
          ...u,
          type:           "producer" as const,
          topTrack:       null as null,
          topBeat:        beats[0] ?? null,
          beatCount:      beats.length,
          minPrice:       minPrice === Infinity ? null : minPrice,
          hasStreamLease,
          tracks:         undefined,
        };
      }),
  ];

  // Paginate the merged set
  const sliced = merged.slice(skip, skip + PAGE_SIZE);
  const total  = merged.length;

  return NextResponse.json({
    results: sliced,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
