import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, balance: true, totalEarnings: true },
  });
  if (!djProfile) return NextResponse.json({ error: "No DJ profile" }, { status: 404 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // This month earnings
  const thisMonthAgg = await db.dJAttribution.aggregate({
    where: { djProfileId: djProfile.id, createdAt: { gte: startOfMonth } },
    _sum: { amount: true },
  });

  // Total tracks in crates (unique trackIds)
  const crateItems = await db.crateItem.findMany({
    where: { crate: { djProfileId: djProfile.id } },
    select: { trackId: true },
  });
  const uniqueTrackIds = [...new Set(crateItems.map(i => i.trackId))];

  // Fans attributed (unique fanSessionIds)
  const allSessions = await db.dJAttribution.findMany({
    where: { djProfileId: djProfile.id },
    select: { fanSessionId: true },
  });
  const fanSessions = [...new Set(allSessions.map(s => s.fanSessionId))];

  // Revenue driven (sum of DigitalPurchase.amount where djAttributionId in DJ's attributions)
  const myAttributionIds = await db.dJAttribution.findMany({
    where: { djProfileId: djProfile.id },
    select: { id: true },
  });
  const attrIds = myAttributionIds.map(a => a.id);
  let revenueDriven = 0;
  if (attrIds.length > 0) {
    const revenueAgg = await db.digitalPurchase.aggregate({
      where: { djAttributionId: { in: attrIds } },
      _sum: { amount: true },
    });
    revenueDriven = revenueAgg._sum.amount ?? 0;
  }

  // Tracks broken: CrateItem tracks where TrackPlay count in 30 days AFTER addedAt
  // is >= 1.2x the count in 30 days BEFORE addedAt
  // We check each unique track that was crated
  const crateItemsWithDate = await db.crateItem.findMany({
    where: { crate: { djProfileId: djProfile.id } },
    select: { trackId: true, addedAt: true },
    orderBy: { addedAt: "asc" },
  });
  // Deduplicate by trackId (keep earliest addedAt)
  const trackMap = new Map<string, Date>();
  for (const item of crateItemsWithDate) {
    if (!trackMap.has(item.trackId)) trackMap.set(item.trackId, item.addedAt);
  }

  let tracksBroken = 0;
  for (const [trackId, addedAt] of trackMap.entries()) {
    const before30Start = new Date(addedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const after30End = new Date(addedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [beforeCount, afterCount] = await Promise.all([
      db.trackPlay.count({ where: { trackId, playedAt: { gte: before30Start, lt: addedAt } } }),
      db.trackPlay.count({ where: { trackId, playedAt: { gte: addedAt, lt: after30End } } }),
    ]);
    if (beforeCount > 0 && afterCount >= beforeCount * 1.2) tracksBroken++;
    else if (beforeCount === 0 && afterCount >= 5) tracksBroken++; // brand new track that got plays
  }

  // Growth chart: last 12 weeks — attributed fans + revenue per week
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const recentAttributions = await db.dJAttribution.findMany({
    where: { djProfileId: djProfile.id, createdAt: { gte: twelveWeeksAgo } },
    select: { createdAt: true, amount: true, fanSessionId: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by week (ISO week label)
  const weekMap = new Map<string, { fans: number; revenue: number; sessions: Set<string> }>();
  for (const attr of recentAttributions) {
    const d = new Date(attr.createdAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Sunday
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, { fans: 0, revenue: 0, sessions: new Set() });
    const entry = weekMap.get(key)!;
    if (!entry.sessions.has(attr.fanSessionId)) {
      entry.fans++;
      entry.sessions.add(attr.fanSessionId);
    }
    entry.revenue += attr.amount;
  }
  const chartData = Array.from(weekMap.entries()).map(([week, v]) => ({
    week,
    fans: v.fans,
    revenue: v.revenue,
  }));

  return NextResponse.json({
    balance: djProfile.balance,
    totalEarnings: djProfile.totalEarnings,
    thisMonth: thisMonthAgg._sum.amount ?? 0,
    tracksInCrates: uniqueTrackIds.length,
    fansAttributed: fanSessions.length, // now a deduplicated string[]
    revenueDriven,
    tracksBroken,
    chartData,
  });
}
