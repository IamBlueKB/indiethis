import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 12;

const SERVICE_OPTIONS = ["Recording", "Mixing", "Mastering", "Vocal Production", "Podcast"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q       = searchParams.get("q")?.trim() ?? "";
  const service = searchParams.get("service") ?? "";
  const sort    = searchParams.get("sort") ?? "newest";
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const where: Prisma.StudioWhereInput = {
    isPublished: true,
    ...(q
      ? {
          OR: [
            { name:    { contains: q, mode: "insensitive" } },
            { city:    { contains: q, mode: "insensitive" } },
            { state:   { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { services: { has: q } },
          ],
        }
      : {}),
    ...(service && service !== "All" && SERVICE_OPTIONS.includes(service)
      ? { services: { has: service } }
      : {}),
  };

  const orderBy: Prisma.StudioOrderByWithRelationInput =
    sort === "az"            ? { name: "asc" }      :
    sort === "most-services" ? { name: "asc" }       : // fallback — computed below
                               { createdAt: "desc" };

  const [studios, total] = await Promise.all([
    db.studio.findMany({
      where,
      select: {
        id:        true,
        name:      true,
        slug:      true,
        city:      true,
        state:     true,
        tagline:   true,
        services:  true,
        heroImage: true,
        logoUrl:   true,
        photos:    true,
        createdAt: true,
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.studio.count({ where }),
  ]);

  // Client-side sort for most-services (can't do in Prisma without raw query)
  const sorted =
    sort === "most-services"
      ? [...studios].sort((a, b) => b.services.length - a.services.length)
      : studios;

  return NextResponse.json({
    studios: sorted,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
