/**
 * GET /api/dashboard/analytics
 *
 * Returns extended artist analytics:
 * - Stat cards with % delta (views, plays, signups, revenue) — this vs last month
 * - 90-day page view chart (daily)
 * - 90-day track plays chart (per top-5 track, one key per track)
 * - Streaming link clicks by platform
 * - Fan signups by source (RELEASE_NOTIFY / SHOW_NOTIFY)
 * - 90-day fan signup chart (daily)
 * - Conversion rate (views vs signups, last 30d)
 * - Top cities by zip (from FanContact)
 * - Top merch products by sales
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Map<isoDateKey, 0> for the last N days */
function buildDailyMap(days: number): Map<string, number> {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  return map;
}

/** Format an ISO date key to a short display label */
function shortLabel(isoKey: string): string {
  return new Date(isoKey + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    const now              = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo    = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // ── Batch 1: all independent queries ────────────────────────────────────
    const [
      totalViews,
      viewsThisMonth,
      viewsLastMonth,
      recentViews90d,
      playsThisMonth,
      playsLastMonth,
      trackPlaysGrouped,
      signupsThisMonth,
      signupsLastMonth,
      recentSignups90d,
      signupsBySourceRaw,
      linkClicksRaw,
      fanZips,
      merchOrdersRaw,
      revenueThisMerch,
      revenueLastMerch,
      revenueThisTips,
      revenueLastTips,
    ] = await Promise.all([
      db.pageView.count({ where: { artistId } }),

      db.pageView.count({
        where: { artistId, viewedAt: { gte: startOfMonth } },
      }),
      db.pageView.count({
        where: { artistId, viewedAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),

      db.pageView.findMany({
        where:  { artistId, viewedAt: { gte: ninetyDaysAgo } },
        select: { viewedAt: true },
      }),

      db.trackPlay.count({
        where: { artistId, playedAt: { gte: startOfMonth } },
      }),
      db.trackPlay.count({
        where: { artistId, playedAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),

      // Top 5 tracks by all-time plays
      db.trackPlay.groupBy({
        by:      ["trackId"],
        where:   { artistId },
        _count:  { trackId: true },
        orderBy: { _count: { trackId: "desc" } },
        take:    5,
      }),

      db.fanContact.count({
        where: { artistId, createdAt: { gte: startOfMonth } },
      }),
      db.fanContact.count({
        where: { artistId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),

      db.fanContact.findMany({
        where:  { artistId, createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true },
      }),

      db.fanContact.groupBy({
        by:      ["source"],
        where:   { artistId },
        _count:  { source: true },
      }),

      db.linkClick.groupBy({
        by:      ["platform"],
        where:   { artistId },
        _count:  { platform: true },
        orderBy: { _count: { platform: "desc" } },
      }),

      db.fanContact.findMany({
        where:  { artistId, zip: { not: null } },
        select: { zip: true },
      }),

      db.merchOrder.findMany({
        where:  { artistId },
        select: { merchProductId: true, artistEarnings: true },
        take:   1000,
      }),

      db.merchOrder.aggregate({
        where: { artistId, createdAt: { gte: startOfMonth } },
        _sum:  { artistEarnings: true },
      }),
      db.merchOrder.aggregate({
        where: { artistId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum:  { artistEarnings: true },
      }),
      db.artistSupport.aggregate({
        where: { artistId, createdAt: { gte: startOfMonth } },
        _sum:  { amount: true },
      }),
      db.artistSupport.aggregate({
        where: { artistId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum:  { amount: true },
      }),
    ]);

    // ── Batch 2: top-track details + 90-day plays (depends on trackPlaysGrouped) ─
    const top5Ids = trackPlaysGrouped.map((r) => r.trackId);

    const [trackDetails, top5PlaysRaw] = await Promise.all([
      top5Ids.length
        ? db.track.findMany({
            where:  { id: { in: top5Ids } },
            select: { id: true, title: true, coverArtUrl: true },
          })
        : Promise.resolve([]),

      top5Ids.length
        ? db.trackPlay.findMany({
            where:  { trackId: { in: top5Ids }, artistId, playedAt: { gte: ninetyDaysAgo } },
            select: { trackId: true, playedAt: true },
          })
        : Promise.resolve([]),
    ]);

    // ── Merch product titles ────────────────────────────────────────────────
    const productIds = [...new Set(merchOrdersRaw.map((o) => o.merchProductId))];
    const products   = productIds.length
      ? await db.merchProduct.findMany({
          where:  { id: { in: productIds } },
          select: { id: true, title: true },
        })
      : [];
    const productNameMap = new Map(products.map((p) => [p.id, p.title]));

    // ── Transform: 90-day page view chart ──────────────────────────────────
    const viewDailyMap = buildDailyMap(90);
    for (const v of recentViews90d) {
      const k = v.viewedAt.toISOString().slice(0, 10);
      if (viewDailyMap.has(k)) viewDailyMap.set(k, (viewDailyMap.get(k) ?? 0) + 1);
    }
    const viewChart = Array.from(viewDailyMap.entries()).map(([k, views]) => ({
      date: shortLabel(k),
      views,
    }));

    // ── Transform: 90-day fan signup chart ─────────────────────────────────
    const signupDailyMap = buildDailyMap(90);
    for (const s of recentSignups90d) {
      const k = s.createdAt.toISOString().slice(0, 10);
      if (signupDailyMap.has(k)) signupDailyMap.set(k, (signupDailyMap.get(k) ?? 0) + 1);
    }
    const signupChart = Array.from(signupDailyMap.entries()).map(([k, signups]) => ({
      date: shortLabel(k),
      signups,
    }));

    // ── Transform: track plays multi-line chart ────────────────────────────
    const trackNameMap = new Map(trackDetails.map((t) => [t.id, t.title.slice(0, 18)]));
    const trackKeys    = top5Ids.map((id) => trackNameMap.get(id) ?? id.slice(0, 8));

    // Build skeleton 90-day array, one entry per day
    const trackPlaysDailyMap = buildDailyMap(90);
    const trackPlaysChart: Array<Record<string, string | number>> = Array.from(
      trackPlaysDailyMap.entries()
    ).map(([k]) => {
      const entry: Record<string, string | number> = { date: shortLabel(k) };
      for (const key of trackKeys) entry[key] = 0;
      return entry;
    });

    for (const p of top5PlaysRaw) {
      const daysAgo = Math.floor((now.getTime() - p.playedAt.getTime()) / 86_400_000);
      if (daysAgo >= 0 && daysAgo < 90) {
        const idx = 89 - daysAgo;
        const key = trackNameMap.get(p.trackId) ?? p.trackId.slice(0, 8);
        if (trackPlaysChart[idx]) {
          trackPlaysChart[idx][key] = (trackPlaysChart[idx][key] as number) + 1;
        }
      }
    }

    const trackLines = top5Ids.map((id, i) => ({
      key:   trackNameMap.get(id) ?? id.slice(0, 8),
      color: ["#E85D4A", "#D4A843", "#5AC8FA", "#34C759", "#AF52DE"][i] ?? "#888",
      label: trackNameMap.get(id) ?? "Track",
    }));

    // ── Transform: streaming clicks ────────────────────────────────────────
    const linkClicks = linkClicksRaw.map((r) => ({
      platform: r.platform,
      clicks:   r._count.platform,
    }));

    // ── Transform: fan signups by source ───────────────────────────────────
    const SOURCE_LABELS: Record<string, string> = {
      RELEASE_NOTIFY: "Release Notify",
      SHOW_NOTIFY:    "Show Waitlist",
    };
    const signupsBySource = signupsBySourceRaw.map((r) => ({
      name:  SOURCE_LABELS[r.source] ?? r.source,
      count: r._count.source,
    }));

    // ── Transform: top cities (zip → count) ────────────────────────────────
    const zipMap = new Map<string, number>();
    for (const f of fanZips) {
      if (f.zip) zipMap.set(f.zip, (zipMap.get(f.zip) ?? 0) + 1);
    }
    const topCities = Array.from(zipMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([zip, count]) => ({ zip, count }));

    // ── Transform: merch performance ───────────────────────────────────────
    const merchByProduct = new Map<string, { sales: number; revenue: number }>();
    for (const o of merchOrdersRaw) {
      const existing = merchByProduct.get(o.merchProductId) ?? { sales: 0, revenue: 0 };
      merchByProduct.set(o.merchProductId, {
        sales:   existing.sales + 1,
        revenue: existing.revenue + o.artistEarnings,
      });
    }
    const topMerch = Array.from(merchByProduct.entries())
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 8)
      .map(([id, agg]) => ({
        title:   productNameMap.get(id) ?? "Product",
        sales:   agg.sales,
        revenue: agg.revenue,
      }));

    // ── Revenue stat ───────────────────────────────────────────────────────
    const revenueThis = (revenueThisMerch._sum.artistEarnings ?? 0) + (revenueThisTips._sum.amount ?? 0);
    const revenueLast = (revenueLastMerch._sum.artistEarnings ?? 0) + (revenueLastTips._sum.amount ?? 0);

    // ── Conversion rate + QR scans (last 30d) ─────────────────────────────
    const [signups30d, views30d, qrScansTotal, qrScans30d] = await Promise.all([
      db.fanContact.count({ where: { artistId, createdAt: { gte: thirtyDaysAgo } } }),
      db.pageView.count(  { where: { artistId, viewedAt:  { gte: thirtyDaysAgo } } }),
      db.pageView.count(  { where: { artistId, referrer: "qr" } }),
      db.pageView.count(  { where: { artistId, referrer: "qr", viewedAt: { gte: thirtyDaysAgo } } }),
    ]);

    return NextResponse.json({
      // Stat cards
      stats: {
        views:   { this: viewsThisMonth,   last: viewsLastMonth,   total: totalViews },
        plays:   { this: playsThisMonth,   last: playsLastMonth },
        signups: { this: signupsThisMonth, last: signupsLastMonth },
        revenue: { this: revenueThis,      last: revenueLast },
      },
      // Charts
      viewChart,
      trackPlaysChart,
      trackLines,
      signupChart,
      // Tables / bars
      linkClicks,
      signupsBySource,
      topCities,
      topMerch,
      // Conversion
      conversion: { views30d, signups30d },
      // QR scans
      qrScans: { total: qrScansTotal, last30d: qrScans30d },
    });
  } catch (err) {
    console.error("[analytics]", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
