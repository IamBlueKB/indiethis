/**
 * /admin/mastering — AI Mix & Master admin panel
 *
 * Metrics dashboard + recent jobs table + preset management.
 * Server component: fetches data, passes to MasteringAdminClient.
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
  await requireAdminAccess();

  const now   = new Date();
  const month = startOfMonth();

  const [
    allJobStats,
    monthlyJobs,
    recentJobs,
    presets,
    albumGroups,
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

    // 100 most recent jobs
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
        createdAt:    true,
      },
    }),

    // Mastering presets
    db.masteringPreset.findMany({
      orderBy: { name: "asc" },
      select: {
        id:          true,
        name:        true,
        genre:       true,
        description: true,
      },
    }),

    // Album groups
    db.masteringAlbumGroup.findMany({
      orderBy: { createdAt: "desc" },
      take:    20,
      select: {
        id:              true,
        title:           true,
        status:          true,
        completedTracks: true,
        totalTracks:     true,
        createdAt:       true,
      },
    }),
  ]);

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const totalJobs    = allJobStats.reduce((s, r) => s + r._count.id, 0);
  const totalRevCents = allJobStats.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const completed    = allJobStats.find((r) => r.status === "COMPLETE")?._count.id  ?? 0;
  const failed       = allJobStats.find((r) => r.status === "FAILED")?._count.id    ?? 0;
  const processing   = allJobStats
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

  const completionRate = totalJobs > 0 ? ((completed / totalJobs) * 100).toFixed(1) : "0";

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
      }}
      byStatus={allJobStats.map((r) => ({
        status:     r.status,
        count:      r._count.id,
        revCents:   r._sum.amount ?? 0,
      }))}
      recentJobs={recentJobs.map((j) => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
      }))}
      presets={presets}
      albumGroups={albumGroups.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
      }))}
    />
  );
}
