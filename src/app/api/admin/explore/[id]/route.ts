import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/explore/[id]
 * Updates an ExploreFeatureCard.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const existing = await db.exploreFeatureCard.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const card = await db.exploreFeatureCard.update({
    where: { id: params.id },
    data: {
      ...(body.type        !== undefined && { type: body.type }),
      ...(body.headline    !== undefined && { headline: body.headline.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.imageUrl    !== undefined && { imageUrl: body.imageUrl }),
      ...(body.gradient    !== undefined && { gradient: body.gradient }),
      ...(body.ctaText     !== undefined && { ctaText: body.ctaText }),
      ...(body.ctaUrl      !== undefined && { ctaUrl: body.ctaUrl.trim() }),
      ...(body.isActive    !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder   !== undefined && { sortOrder: body.sortOrder }),
      ...(body.startsAt    !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
      ...(body.endsAt      !== undefined && { endsAt:   body.endsAt   ? new Date(body.endsAt)   : null }),
      ...(body.linkedArtistId !== undefined && { linkedArtistId: body.linkedArtistId }),
    },
    include: {
      linkedArtist: { select: { id: true, name: true, photo: true } },
    },
  });

  return NextResponse.json({ card });
}

/**
 * DELETE /api/admin/explore/[id]
 * Deletes an ExploreFeatureCard.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAdminAccess("explore");

  const existing = await db.exploreFeatureCard.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.exploreFeatureCard.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
