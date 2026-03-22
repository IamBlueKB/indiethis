import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/stream-lease-earnings
// Returns stream lease income for the current user acting as a producer.
// A "producer" owns beats (Tracks) that other artists have leased.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all beats owned by this user
  const myBeats = await db.track.findMany({
    where:  { artistId: session.user.id },
    select: { id: true, title: true, coverArtUrl: true },
  });

  if (myBeats.length === 0) {
    return NextResponse.json({
      totalEarned:   0,
      monthlyIncome: 0,
      beatGroups:    [],
    });
  }

  const beatIds = myBeats.map((b) => b.id);

  // Fetch active leases grouped by beat + all paid payments in parallel
  const [activeLeaseGroups, payments] = await Promise.all([
    db.streamLease.groupBy({
      by:     ["beatId"],
      where:  { beatId: { in: beatIds }, isActive: true },
      _count: { id: true },
    }),
    db.streamLeasePayment.findMany({
      where:  { producerId: session.user.id, status: "PAID" },
      select: { producerAmount: true, streamLease: { select: { beatId: true } } },
    }),
  ]);

  // Build lookup maps
  const activeByBeat = new Map(activeLeaseGroups.map((g) => [g.beatId, g._count.id]));
  const earnedByBeat = new Map<string, number>();

  for (const payment of payments) {
    const beatId = payment.streamLease.beatId;
    earnedByBeat.set(beatId, (earnedByBeat.get(beatId) ?? 0) + payment.producerAmount);
  }

  // Build per-beat groups (only include beats with any activity)
  const beatGroups = myBeats
    .map((beat) => {
      const artistCount   = activeByBeat.get(beat.id) ?? 0;
      const totalEarned   = earnedByBeat.get(beat.id) ?? 0;
      // monthlyIncome = active artists × producerAmount per payment cycle
      // producerAmount defaults to 0.70 per month
      const monthlyIncome = artistCount * 0.70;
      return {
        beatId:       beat.id,
        beatTitle:    beat.title,
        coverArtUrl:  beat.coverArtUrl,
        artistCount,
        monthlyIncome,
        totalEarned,
      };
    })
    .filter((b) => b.artistCount > 0 || b.totalEarned > 0)
    .sort((a, b) => b.monthlyIncome - a.monthlyIncome);

  const totalEarned   = Array.from(earnedByBeat.values()).reduce((s, v) => s + v, 0);
  const monthlyIncome = beatGroups.reduce((s, b) => s + b.monthlyIncome, 0);

  return NextResponse.json({ totalEarned, monthlyIncome, beatGroups });
}
