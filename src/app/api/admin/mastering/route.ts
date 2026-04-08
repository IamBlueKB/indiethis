/**
 * GET /api/admin/mastering
 *
 * Admin-only. Returns mastering metrics + recent jobs.
 * Query params:
 *   limit?  number (default 50)
 *   status? string filter
 *   mode?   string filter
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? "50", 10), 200);
  const status = searchParams.get("status") ?? undefined;
  const mode   = searchParams.get("mode")   ?? undefined;

  const [jobs, totals] = await Promise.all([
    prisma.masteringJob.findMany({
      where:   { ...(status ? { status } : {}), ...(mode ? { mode } : {}) },
      orderBy: { createdAt: "desc" },
      take:    limit,
      select: {
        id:          true,
        status:      true,
        mode:        true,
        tier:        true,
        genre:       true,
        amount:      true,
        createdAt:   true,
        guestEmail:  true,
        userId:      true,
        albumGroupId: true,
        revisionUsed: true,
      },
    }),

    prisma.masteringJob.groupBy({
      by:     ["status"],
      _count: { id: true },
      _sum:   { amount: true },
    }),
  ]);

  // Revenue + counts
  const totalJobs    = totals.reduce((s, r) => s + r._count.id, 0);
  const totalRevenue = totals.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const completed    = totals.find((r) => r.status === "COMPLETE")?._count.id ?? 0;
  const failed       = totals.find((r) => r.status === "FAILED")?._count.id   ?? 0;
  const processing   = totals
    .filter((r) => ["ANALYZING","SEPARATING","MIXING","MASTERING"].includes(r.status))
    .reduce((s, r) => s + r._count.id, 0);

  return NextResponse.json({
    metrics: {
      totalJobs,
      completed,
      failed,
      processing,
      totalRevenueCents: totalRevenue,
      completionRate:    totalJobs > 0 ? ((completed / totalJobs) * 100).toFixed(1) : "0",
    },
    byStatus: totals.map((r) => ({ status: r.status, count: r._count.id, revenueCents: r._sum.amount ?? 0 })),
    jobs,
  });
}
