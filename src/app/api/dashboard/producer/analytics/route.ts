import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Build an array of ISO date strings for the last N days (inclusive of today)
function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// GET /api/dashboard/producer/analytics
// Returns 90 days of time-series data + stats + tables + activity feed.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;
  const now    = new Date();
  const start90 = new Date(now);
  start90.setDate(start90.getDate() - 89);
  start90.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // ── Parallel data fetch ──────────────────────────────────────────────────────
  const [beats, leasePayments, licenses, leases, plays] = await Promise.all([
    db.track.findMany({
      where: { artistId: userId },
      select: {
        id: true, title: true, coverArtUrl: true,
        streamLeases: {
          select: {
            id: true, isActive: true, activatedAt: true, cancelledAt: true,
            plays: { select: { playedAt: true } },
          },
        },
        beatLicenses: { select: { id: true, price: true, createdAt: true } },
      },
    }),
    db.streamLeasePayment.findMany({
      where: { producerId: userId, status: "PAID", paidAt: { gte: start90 } },
      select: { producerAmount: true, paidAt: true },
    }),
    db.beatLicense.findMany({
      where: { producerId: userId, createdAt: { gte: start90 } },
      select: { price: true, createdAt: true },
    }),
    db.streamLease.findMany({
      where: { producerId: userId, activatedAt: { gte: start90 } },
      select: {
        id: true, beatId: true, trackTitle: true, activatedAt: true,
        artist: { select: { id: true, name: true, artistName: true, artistSlug: true } },
        beat:   { select: { title: true } },
      },
      orderBy: { activatedAt: "desc" },
    }),
    db.streamLeasePlay.findMany({
      where: {
        playedAt:    { gte: start90 },
        streamLease: { producerId: userId },
      },
      select: { playedAt: true, streamLeaseId: true },
    }),
  ]);

  const days90 = lastNDays(90);

  // ── Revenue series ───────────────────────────────────────────────────────────
  const leaseRevByDay  = new Map<string, number>();
  const licenseRevByDay = new Map<string, number>();
  for (const p of leasePayments) leaseRevByDay.set(toDateKey(p.paidAt), (leaseRevByDay.get(toDateKey(p.paidAt)) ?? 0) + p.producerAmount);
  for (const l of licenses)      licenseRevByDay.set(toDateKey(l.createdAt), (licenseRevByDay.get(toDateKey(l.createdAt)) ?? 0) + l.price);

  const revenueSeries = days90.map((d) => ({
    date:        d.slice(5),  // "MM-DD"
    streamLease: +(leaseRevByDay.get(d)  ?? 0).toFixed(2),
    license:     +(licenseRevByDay.get(d) ?? 0).toFixed(2),
  }));

  // ── Plays series ─────────────────────────────────────────────────────────────
  const playsByDay = new Map<string, number>();
  for (const p of plays) playsByDay.set(toDateKey(p.playedAt), (playsByDay.get(toDateKey(p.playedAt)) ?? 0) + 1);
  const playsSeries = days90.map((d) => ({
    date:  d.slice(5),
    plays: playsByDay.get(d) ?? 0,
  }));

  // ── Lease growth (new activations per day, cumulative) ───────────────────────
  const newLeasesByDay = new Map<string, number>();
  for (const l of leases) newLeasesByDay.set(toDateKey(l.activatedAt), (newLeasesByDay.get(toDateKey(l.activatedAt)) ?? 0) + 1);

  // Count all active leases before the window as starting baseline
  const allActiveLeases = await db.streamLease.count({
    where: { producerId: userId, isActive: true, activatedAt: { lt: start90 } },
  });
  let cumulative = allActiveLeases;
  const leaseGrowthSeries = days90.map((d) => {
    cumulative += newLeasesByDay.get(d) ?? 0;
    return { date: d.slice(5), active: cumulative };
  });

  // ── Top 5 beats by engagement ─────────────────────────────────────────────────
  const beatEngagement = beats.map((b) => ({
    name:       b.title.length > 20 ? b.title.slice(0, 18) + "…" : b.title,
    engagement: b.streamLeases.length + b.beatLicenses.length +
                b.streamLeases.reduce((s, l) => s + l.plays.length, 0),
  })).sort((a, b) => b.engagement - a.engagement).slice(0, 5);

  // ── Top performing beats table ────────────────────────────────────────────────
  const topBeatsTable = beats.map((b) => {
    const activeLeases = b.streamLeases.filter((l) => l.isActive).length;
    const totalPlays   = b.streamLeases.reduce((s, l) => s + l.plays.length, 0);
    const revenue      = b.beatLicenses.reduce((s, l) => s + l.price, 0);
    return {
      id:           b.id,
      title:        b.title,
      coverArtUrl:  b.coverArtUrl,
      leases:       activeLeases,
      licenses:     b.beatLicenses.length,
      totalPlays,
      revenue,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // ── Stat cards ────────────────────────────────────────────────────────────────
  const totalBeats        = beats.length;
  const activeLeases      = beats.reduce((s, b) => s + b.streamLeases.filter((l) => l.isActive).length, 0);
  const activeLeasesLastMonth = await db.streamLease.count({
    where: { producerId: userId, isActive: true, activatedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const licensesThisMonth = await db.beatLicense.count({
    where: { producerId: userId, createdAt: { gte: monthStart } },
  });
  const revenueThisMonth  = await db.streamLeasePayment.aggregate({
    where:  { producerId: userId, status: "PAID", paidAt: { gte: monthStart } },
    _sum:   { producerAmount: true },
  });
  const licRevThisMonth   = await db.beatLicense.aggregate({
    where:  { producerId: userId, createdAt: { gte: monthStart } },
    _sum:   { price: true },
  });
  const totalPlays        = beats.reduce((s, b) => s + b.streamLeases.reduce((ss, l) => ss + l.plays.length, 0), 0);

  const stats = {
    totalBeats,
    activeLeases,
    activeLeasesLastMonth,
    licensesThisMonth,
    revenueThisMonth: (revenueThisMonth._sum.producerAmount ?? 0) + (licRevThisMonth._sum.price ?? 0),
    totalPlays,
  };

  // ── Recent activity feed ──────────────────────────────────────────────────────
  // Pull from: new stream leases (last 30 days) + beat license purchases (last 30 days)
  const [recentLeases, recentLicenseFull] = await Promise.all([
    db.streamLease.findMany({
      where: { producerId: userId, activatedAt: { gte: new Date(now.getTime() - 30 * 86400_000) } },
      select: {
        id: true, trackTitle: true, activatedAt: true,
        artist: { select: { name: true, artistName: true } },
        beat:   { select: { title: true } },
        plays:  { select: { id: true } },
      },
      orderBy: { activatedAt: "desc" },
      take: 20,
    }),
    db.beatLicense.findMany({
      where: { producerId: userId, createdAt: { gte: new Date(now.getTime() - 30 * 86400_000) } },
      select: {
        id: true, licenseType: true, price: true, createdAt: true,
        artist: { select: { name: true, artistName: true } },
        track:  { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  type ActivityItem = { id: string; type: string; text: string; date: Date };
  const activityItems: ActivityItem[] = [
    ...recentLeases.map((l) => ({
      id:   `lease-${l.id}`,
      type: "lease",
      text: `${l.artist.artistName ?? l.artist.name} stream-leased "${l.beat.title}"`,
      date: l.activatedAt,
    })),
    ...recentLicenseFull.map((l) => ({
      id:   `license-${l.id}`,
      type: "license",
      text: `${l.artist.artistName ?? l.artist.name} purchased ${l.licenseType.toLowerCase().replace("_", "-")} license for "${l.track.title}" — $${l.price.toFixed(2)}`,
      date: l.createdAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 25);

  const recentActivity = activityItems.map((a) => ({
    id:   a.id,
    type: a.type,
    text: a.text,
    date: a.date.toISOString(),
  }));

  return NextResponse.json({
    stats,
    revenueSeries,
    playsSeries,
    leaseGrowthSeries,
    beatEngagement,
    topBeatsTable,
    recentActivity,
  });
}
