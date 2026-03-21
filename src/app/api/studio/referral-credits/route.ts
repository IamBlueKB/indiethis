import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseHistory } from "@/lib/studio-referral";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, referralCredits: true, referralCreditHistory: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const history = parseHistory(studio.referralCreditHistory);

  const totalEarned = history
    .filter(e => e.type === "EARNED")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalApplied = history
    .filter(e => e.type === "APPLIED")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const referredArtists = new Set(
    history.filter(e => e.type === "EARNED" && e.artistId).map(e => e.artistId),
  ).size;

  // Count contacts that are marked referred but haven't triggered a credit yet
  const pendingReferrals = await db.contact.count({
    where: {
      studioId: studio.id,
      referredToIndieThis: true,
      source: { in: ["BOOKING", "MANUAL"] },
    },
  });

  return NextResponse.json({
    balance: studio.referralCredits,
    history,
    stats: {
      totalEarned,
      totalApplied,
      referredArtists,
      pendingReferrals,
    },
  });
}
