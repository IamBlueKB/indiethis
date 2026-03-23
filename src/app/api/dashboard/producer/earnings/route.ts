import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/producer/earnings
// Returns all-time producer earnings summary + transaction history.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId     = session.user.id as string;
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [leasePaymentsAll, leasePaymentsMonth, licensesAll, licensesMonth, beatGroups] = await Promise.all([
    db.streamLeasePayment.aggregate({
      where: { producerId: userId, status: "PAID" },
      _sum:  { producerAmount: true },
    }),
    db.streamLeasePayment.aggregate({
      where: { producerId: userId, status: "PAID", paidAt: { gte: monthStart } },
      _sum:  { producerAmount: true },
    }),
    db.beatLicense.aggregate({
      where: { producerId: userId },
      _sum:  { price: true },
    }),
    db.beatLicense.aggregate({
      where: { producerId: userId, createdAt: { gte: monthStart } },
      _sum:  { price: true },
    }),
    // active lease count per beat for monthly income estimate
    db.track.findMany({
      where:  { artistId: userId },
      select: {
        id: true,
        streamLeases: { where: { isActive: true }, select: { id: true } },
      },
    }),
  ]);

  const leaseTotal      = leasePaymentsAll._sum.producerAmount   ?? 0;
  const leaseThisMonth  = leasePaymentsMonth._sum.producerAmount ?? 0;
  const licenseTotal    = licensesAll._sum.price                 ?? 0;
  const licenseThisMonth = licensesMonth._sum.price              ?? 0;

  const activeLeaseCount   = beatGroups.reduce((s, b) => s + b.streamLeases.length, 0);
  const monthlyLeaseIncome = activeLeaseCount * 0.70;

  // Transaction history — merge stream lease payments + license sales, newest first
  const [leaseTransactions, licenseTransactions] = await Promise.all([
    db.streamLeasePayment.findMany({
      where:   { producerId: userId, status: "PAID" },
      select: {
        id:             true,
        paidAt:         true,
        producerAmount: true,
        streamLease: {
          select: {
            trackTitle: true,
            beat:   { select: { title: true } },
            artist: { select: { name: true, artistName: true, artistSlug: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    db.beatLicense.findMany({
      where:   { producerId: userId },
      select: {
        id:          true,
        createdAt:   true,
        price:       true,
        licenseType: true,
        track:  { select: { title: true } },
        artist: { select: { name: true, artistName: true, artistSlug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  type Tx = {
    id: string; date: string; type: "STREAM_LEASE" | "LICENSE_SALE";
    beat: string; from: string; fromSlug: string | null; amount: number;
    licenseType?: string;
  };

  const transactions: Tx[] = [
    ...leaseTransactions.map((t) => ({
      id:       `lease-${t.id}`,
      date:     t.paidAt.toISOString(),
      type:     "STREAM_LEASE" as const,
      beat:     t.streamLease.beat.title,
      from:     t.streamLease.artist.artistName ?? t.streamLease.artist.name,
      fromSlug: t.streamLease.artist.artistSlug,
      amount:   t.producerAmount,
    })),
    ...licenseTransactions.map((l) => ({
      id:          `license-${l.id}`,
      date:        l.createdAt.toISOString(),
      type:        "LICENSE_SALE" as const,
      beat:        l.track.title,
      from:        l.artist.artistName ?? l.artist.name,
      fromSlug:    l.artist.artistSlug,
      amount:      l.price,
      licenseType: l.licenseType,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    summary: {
      leaseTotal,
      leaseThisMonth,
      licenseTotal,
      licenseThisMonth,
      monthlyLeaseIncome,
      activeLeaseCount,
      totalAllTime:  leaseTotal + licenseTotal,
      totalThisMonth: leaseThisMonth + licenseThisMonth,
    },
    transactions,
  });
}
