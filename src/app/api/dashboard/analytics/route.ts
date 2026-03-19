/**
 * GET /api/dashboard/analytics
 *
 * Returns artist page analytics for the authenticated user:
 * - pageViews: total + last 30 days broken into daily counts
 * - trackPlays: per-track totals, sorted by plays desc
 * - linkClicks: per-platform totals
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── All queries in parallel ────────────────────────────────────────────────
    const [
      totalViews,
      recentViews,
      trackPlaysRaw,
      linkClicksRaw,
    ] = await Promise.all([
      // Total all-time page views
      db.pageView.count({ where: { artistId } }),

      // Last 30 days page views (for chart)
      db.pageView.findMany({
        where:   { artistId, viewedAt: { gte: thirtyDaysAgo } },
        select:  { viewedAt: true },
        orderBy: { viewedAt: "asc" },
      }),

      // Track plays aggregated by track
      db.trackPlay.groupBy({
        by:      ["trackId"],
        where:   { artistId },
        _count:  { trackId: true },
        orderBy: { _count: { trackId: "desc" } },
        take:    10,
      }),

      // Link clicks aggregated by platform
      db.linkClick.groupBy({
        by:      ["platform"],
        where:   { artistId },
        _count:  { platform: true },
        orderBy: { _count: { platform: "desc" } },
      }),
    ]);

    // ── Build daily chart (last 30 days, one entry per day) ───────────────────
    const dailyMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }
    for (const v of recentViews) {
      const key = v.viewedAt.toISOString().slice(0, 10);
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
    }
    const viewChart = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

    // ── Resolve track titles for track play rows ───────────────────────────────
    const trackIds = trackPlaysRaw.map((r) => r.trackId);
    const tracks   = trackIds.length
      ? await db.track.findMany({
          where:  { id: { in: trackIds } },
          select: { id: true, title: true, coverArtUrl: true },
        })
      : [];
    const trackMap = new Map(tracks.map((t) => [t.id, t]));

    const topTracks = trackPlaysRaw.map((r) => ({
      trackId:     r.trackId,
      plays:       r._count.trackId,
      title:       trackMap.get(r.trackId)?.title ?? "Unknown",
      coverArtUrl: trackMap.get(r.trackId)?.coverArtUrl ?? null,
    }));

    const linkClicks = linkClicksRaw.map((r) => ({
      platform: r.platform,
      clicks:   r._count.platform,
    }));

    return NextResponse.json({
      totalViews,
      viewsLast30Days: recentViews.length,
      viewChart,
      topTracks,
      linkClicks,
    });
  } catch (err) {
    console.error("[analytics]", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
