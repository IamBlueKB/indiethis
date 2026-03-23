import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { db } from "@/lib/db";

/**
 * GET /api/admin/explore
 * Returns all ExploreFeatureCards ordered by sortOrder.
 */
export async function GET() {
  await requireAdminAccess("explore");

  const cards = await db.exploreFeatureCard.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      linkedArtist: { select: { id: true, name: true, photo: true } },
    },
  });

  return NextResponse.json({ cards });
}

/**
 * POST /api/admin/explore
 * Creates a new ExploreFeatureCard.
 */
export async function POST(req: NextRequest) {
  await requireAdminAccess("explore");

  const body = await req.json() as {
    type?: string;
    headline?: string;
    description?: string;
    imageUrl?: string;
    gradient?: string;
    ctaText?: string;
    ctaUrl?: string;
    isActive?: boolean;
    sortOrder?: number;
    startsAt?: string | null;
    endsAt?: string | null;
    linkedArtistId?: string | null;
  };

  if (!body.headline?.trim()) {
    return NextResponse.json({ error: "headline is required" }, { status: 400 });
  }
  if (!body.ctaUrl?.trim()) {
    return NextResponse.json({ error: "ctaUrl is required" }, { status: 400 });
  }

  const card = await db.exploreFeatureCard.create({
    data: {
      type:          body.type        ?? "ANNOUNCEMENT",
      headline:      body.headline.trim(),
      description:   body.description ?? null,
      imageUrl:      body.imageUrl    ?? null,
      gradient:      body.gradient    ?? null,
      ctaText:       body.ctaText     ?? "Learn More",
      ctaUrl:        body.ctaUrl.trim(),
      isActive:      body.isActive    ?? true,
      sortOrder:     body.sortOrder   ?? 0,
      startsAt:      body.startsAt    ? new Date(body.startsAt) : null,
      endsAt:        body.endsAt      ? new Date(body.endsAt)   : null,
      linkedArtistId: body.linkedArtistId ?? null,
    },
    include: {
      linkedArtist: { select: { id: true, name: true, photo: true } },
    },
  });

  return NextResponse.json({ card }, { status: 201 });
}
