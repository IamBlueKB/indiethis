import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/explore/featured
 * Returns active featured carousel cards, sorted by sortOrder.
 * Active = isActive=true AND (startsAt null or <= now) AND (endsAt null or >= now).
 */
export async function GET() {
  const now = new Date();

  const cards = await db.exploreFeatureCard.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: {
      linkedArtist: { select: { id: true, name: true, photo: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 6,
  });

  return NextResponse.json({ cards });
}
