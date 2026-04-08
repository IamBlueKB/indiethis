/**
 * /admin/mastering — AI Mix & Master admin panel
 *
 * Metrics dashboard + filterable jobs table + preset CRUD.
 * Server component: fetches all data, passes to MasteringAdminClient.
 */

import { db }                 from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { MasteringAdminClient } from "./MasteringAdminClient";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function MasteringAdminPage() {
  await requireAdminAccess("mastering");

  const now   = new Date();
  const month = startOfMonth();

  const [
    allJobStats,
    monthlyJobs,
    recentJobs,
    presets,
    recentCompleteJobs,
    genreStats,
    guestJobTotal,
    guestJobConverted,
  ] = await Promise.all([
    // All-time totals grouped by status
    db.masteringJob.groupBy({
      by:     ["status"],
      _count: { id: true },
      _sum:   { amount: true },
    }),

    // This month's jobs
    db.masteringJob.findMany({
      where:   { createdAt: { gte: month } },
      select:  { id: true, status: true, amount: true, mode: true, tier: true, createdAt: true },
    }),

    // 100 most recent jobs with full display + expandable data
    db.masteringJob.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
      select: {
        id:           true,
        status:       true,
        mode:         true,
        tier:         true,
        genre:        true,
        amount:       true,
        guestEmail:   true,
        userId:       true,
        albumGroupId: true,
        revisionUsed: true,
        versions:     true,
        exports:      true,
        trackId:      true,
        createdAt:    true,
        updatedAt:    true,
      },
    }),

    // All presets with full fields for CRUD
    db.masteringPreset.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id:            true,
        name:          true,
        genre:         true,
        description:   true,
        mixProfile:    true,
        masterProfile: true,
        active:        true,
        sortOrder:     true,
        createdAt:     true,
      },
    }),

    // Last 200 COMPLETE jobs for avg processing time
    db.masteringJob.findMany({
      where:   { status: "COMPLETE" },
      orderBy: { updatedAt: "desc" },
      take:    200,
      select:  { createdAt: true, updatedAt: true },
    }),

    // Genre distribution (all-time)
    db.masteringJob.groupBy({
      by:     ["genre"],
      where:  { genre: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take:   10,
    }),

    // Conversion rate: total guest jobs
    db.masteringJob.count({ where: { guestEmail: { not: null } } }),

    // Conversion rate: guest jobs that were later linked (signed up)
    db.masteringJob.count({ where: { guestEmail: { not: null }, userId: { not: null } } }),
  ]);

  // ── Derived metrics ───────────────────────────────────────────────────────────

  const totalJobs       = allJobStats.reduce((s, r) => s + r._count.id, 0);
  const totalRevCents   = allJobStats.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const completed       = allJobStats.find((r) => r.status === "COMPLETE")?._count.id ?? 0;
  const failed          = allJobStats.find((r) => r.status === "FAILED")?._count.id   ?? 0;
  const processing      = allJobStats
    .filter((r) => ["ANALYZING","SEPARATING","MIXING","MASTERING","PENDING"].includes(r.status))
    .reduce((s, r) => s + r._count.id, 0);

  const monthlyRevCents = monthlyJobs.reduce((s, j) => s + (j.amount ?? 0), 0);
  const monthlyCount    = monthlyJobs.length;

  const byMode: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  for (const j of monthlyJobs) {
    byMode[j.mode] = (byMode[j.mode] ?? 0) + 1;
    if (j.tier) byTier[j.tier] = (byTier[j.tier] ?? 0) + 1;
  }

  const completionRate   = totalJobs > 0 ? ((completed / totalJobs) * 100).toFixed(1) : "0";
  const conversionRate   = guestJobTotal > 0
    ? ((guestJobConverted / guestJobTotal) * 100).toFixed(1)
    : "0";

  // Avg processing time in minutes for COMPLETE jobs
  let avgProcessingMinutes = 0;
  if (recentCompleteJobs.length > 0) {
    const totalMs = recentCompleteJobs.reduce((s, j) => {
      return s + (j.updatedAt.getTime() - j.createdAt.getTime());
    }, 0);
    avgProcessingMinutes = Math.round(totalMs / recentCompleteJobs.length / 60000);
  }

  // Genre distribution as sorted array
  const genreDistribution = genreStats.map((g) => ({
    genre: g.genre ?? "Unknown",
    count: g._count.id,
  }));

  // Fetch track titles for jobs that have trackId
  const trackIds = recentJobs.map((j) => j.trackId).filter(Boolean) as string[];
  const tracks   = trackIds.length > 0
    ? await db.track.findMany({
        where:  { id: { in: trackIds } },
        select: { id: true, title: true },
      })
    : [];
  const trackTitleMap = new Map(tracks.map((t) => [t.id, t.title]));

  return (
    <MasteringAdminClient
      metrics={{
        totalJobs,
        completed,
        failed,
        processing,
        completionRate,
        totalRevCents,
        monthlyRevCents,
        monthlyCount,
        byMode,
        byTier,
        avgProcessingMinutes,
        conversionRate,
        genreDistribution,
      }}
      byStatus={allJobStats.map((r) => ({
        status:   r.status,
        count:    r._count.id,
        revCents: r._sum.amount ?? 0,
      }))}
      recentJobs={recentJobs.map((j) => ({
        ...j,
        trackTitle:      j.trackId ? (trackTitleMap.get(j.trackId) ?? null) : null,
        processingMins:  j.status === "COMPLETE"
          ? Math.round((j.updatedAt.getTime() - j.createdAt.getTime()) / 60000)
          : null,
        versions:        j.versions as unknown[] | null,
        exports:         j.exports  as unknown[] | null,
        createdAt:       j.createdAt.toISOString(),
        updatedAt:       j.updatedAt.toISOString(),
      }))}
      presets={presets.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
