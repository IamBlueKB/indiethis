/**
 * GET /api/studio/credits
 *
 * Returns the studio's referral credit balance, full credit history, and
 * summary stats (total earned, total applied, unique artists credited).
 *
 * Auth: STUDIO_ADMIN only.
 */

import { NextResponse }        from "next/server";
import { auth }                from "@/lib/auth";
import { db }                  from "@/lib/db";
import { parseHistory }        from "@/lib/studio-referral";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where:  { ownerId: session.user.id },
    select: {
      id:                    true,
      referralCredits:       true,
      referralCreditHistory: true,
    },
  });

  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  const history = parseHistory(studio.referralCreditHistory);

  // Compute stats
  const totalEarned    = history.filter(e => e.type === "EARNED").reduce((s, e) => s + e.amount, 0);
  const totalApplied   = history.filter(e => e.type === "APPLIED").reduce((s, e) => s + Math.abs(e.amount), 0);
  const referredArtists = new Set(
    history.filter(e => e.type === "EARNED" && e.artistId).map(e => e.artistId!),
  ).size;

  // Count pending (BOOKING or MANUAL contacts whose artist hasn't purchased yet)
  const pendingCount = await db.contact.count({
    where: {
      studioId:           studio.id,
      source:             { in: ["BOOKING", "MANUAL"] },
      referredToIndieThis: false,
      email:              { not: null },
    },
  });

  return NextResponse.json({
    balance:         studio.referralCredits,
    history:         [...history].reverse(), // most-recent first
    stats: {
      totalEarned,
      totalApplied,
      referredArtists,
      pendingReferrals: pendingCount, // contacts not yet on IndieThis
    },
  });
}
