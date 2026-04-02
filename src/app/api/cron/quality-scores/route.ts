import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateQualityScore } from "@/lib/quality-score";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // 5-minute limit for large track catalogs

/**
 * POST /api/cron/quality-scores
 * Recalculates qualityScore for every published track.
 * Called daily by the master cron agent (QUALITY_SCORE_UPDATE).
 * Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  const now             = startedAt;
  const sevenDaysAgo    = new Date(now - 7  * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo   = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // ── Fetch all published tracks with scoring fields ──────────────────────────
  const tracks = await db.track.findMany({
    where:  { status: "PUBLISHED" },
    select: {
      id: true, createdAt: true, coverArtUrl: true,
      producer: true, songwriter: true, canvasVideoUrl: true,
      audioFeatures: {
        select: {
          energy: true, danceability: true, acousticness: true,
          instrumentalness: true, valence: true,
        },
      },
    },
  });

  if (tracks.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, duration: `${Date.now() - startedAt}ms` });
  }

  const trackIds = tracks.map(t => t.id);

  // ── Aggregate play counts in parallel ────────────────────────────────────────
  const [recentGroups, previousGroups, monthlyGroups, crateGroups, licenseGroups] =
    await Promise.all([
      // Plays in last 7 days
      db.trackPlay.groupBy({
        by:    ["trackId"],
        where: { trackId: { in: trackIds }, playedAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }),
      // Plays in the prior week (days 8–14)
      db.trackPlay.groupBy({
        by:    ["trackId"],
        where: { trackId: { in: trackIds }, playedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        _count: { id: true },
      }),
      // Plays in last 30 days (stale penalty check)
      db.trackPlay.groupBy({
        by:    ["trackId"],
        where: { trackId: { in: trackIds }, playedAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      // DJ crate adds (all-time)
      db.crateItem.groupBy({
        by:    ["trackId"],
        where: { trackId: { in: trackIds } },
        _count: { id: true },
      }),
      // Beat license purchases (all-time)
      db.beatLicense.groupBy({
        by:    ["trackId"],
        where: { trackId: { in: trackIds } },
        _count: { id: true },
      }),
    ]);

  // ── Build lookup maps ────────────────────────────────────────────────────────
  const recentMap   = new Map(recentGroups.map(g   => [g.trackId,  g._count.id]));
  const previousMap = new Map(previousGroups.map(g  => [g.trackId,  g._count.id]));
  const monthlyMap  = new Map(monthlyGroups.map(g   => [g.trackId,  g._count.id]));
  const crateMap    = new Map(crateGroups.map(g     => [g.trackId,  g._count.id]));
  const licenseMap  = new Map(licenseGroups.map(g   => [g.trackId,  g._count.id]));

  // ── Calculate and batch-update scores (50 at a time) ────────────────────────
  const BATCH = 50;
  let updated = 0;

  for (let i = 0; i < tracks.length; i += BATCH) {
    const batch = tracks.slice(i, i + BATCH);
    await Promise.all(
      batch.map(track => {
        const score = calculateQualityScore({
          id:                 track.id,
          playsLast7Days:     recentMap.get(track.id)   ?? 0,
          playsPrevious7Days: previousMap.get(track.id) ?? 0,
          playsLast30Days:    monthlyMap.get(track.id)  ?? 0,
          crateCount:         crateMap.get(track.id)    ?? 0,
          purchaseCount:      licenseMap.get(track.id)  ?? 0,
          createdAt:          track.createdAt,
          coverArtUrl:        track.coverArtUrl,
          producer:           track.producer,
          songwriter:         track.songwriter,
          canvasVideoUrl:     track.canvasVideoUrl,
          audioFeatures:      track.audioFeatures,
        });
        return db.track.update({
          where: { id: track.id },
          data:  { qualityScore: score },
        });
      })
    );
    updated += batch.length;
  }

  return NextResponse.json({
    ok:       true,
    updated,
    duration: `${Date.now() - startedAt}ms`,
  });
}
