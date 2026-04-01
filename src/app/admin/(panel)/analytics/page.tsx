import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  Music2,
  DollarSign,
  Trophy,
  ShieldCheck,
} from "lucide-react";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const [
    totalDJs,
    djRevenueAgg,
    topDJs,
    verificationCounts,
  ] = await Promise.all([
    // 1. Total active DJs
    db.dJProfile.count(),

    // 2. Total DJ-attributed revenue (sum of DJAttribution.amount in cents)
    db.dJAttribution.aggregate({ _sum: { amount: true } }),

    // 3. Top 5 DJs by totalEarnings
    db.dJProfile.findMany({
      orderBy: { totalEarnings: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        totalEarnings: true,
        user: { select: { name: true } },
      },
    }),

    // 4. Verification status breakdown
    db.dJProfile.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
  ]);

  const totalRevenueCents = djRevenueAgg._sum.amount ?? 0;
  const totalRevenueDollars = totalRevenueCents / 100;

  // Build a map for all four statuses so we always show them
  const statusOrder = ["NONE", "PENDING", "APPROVED", "DENIED"] as const;
  const statusMap: Record<string, number> = {
    NONE: 0,
    PENDING: 0,
    APPROVED: 0,
    DENIED: 0,
  };
  for (const row of verificationCounts) {
    statusMap[row.verificationStatus] = row._count._all;
  }

  const STATUS_COLOR: Record<string, string> = {
    NONE:     "#555",
    PENDING:  "#D4A843",
    APPROVED: "#34C759",
    DENIED:   "#E85D4A",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Platform analytics and DJ stats</p>
      </div>

      {/* Quick nav */}
      <div className="flex gap-3">
        <Link
          href="/admin/analytics/funnel"
          className="px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors"
          style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", color: "#D4A843" }}
        >
          Signup Funnel →
        </Link>
        <Link
          href="/admin/dj-verification"
          className="px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors"
          style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}
        >
          DJ Verification →
        </Link>
      </div>

      {/* ── DJ Platform Stats ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-foreground">DJ Platform Stats</h2>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Active DJs */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Active DJs
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#5AC8FA18" }}
              >
                <Music2 size={15} style={{ color: "#5AC8FA" }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-display">
              {totalDJs.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">registered DJ profiles</p>
          </div>

          {/* Total DJ-Attributed Revenue */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                DJ-Attributed Revenue
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#34C75918" }}
              >
                <DollarSign size={15} style={{ color: "#34C759" }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-display">
              ${totalRevenueDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">total attributed sales</p>
          </div>

          {/* Verified DJs */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verified DJs
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#34C75918" }}
              >
                <ShieldCheck size={15} style={{ color: "#34C759" }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-display">
              {statusMap.APPROVED.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">approved verifications</p>
          </div>

          {/* Pending Verification */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Review
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#D4A84318" }}
              >
                <ShieldCheck size={15} style={{ color: "#D4A843" }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-display">
              {statusMap.PENDING.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">awaiting verification decision</p>
          </div>
        </div>

        {/* Top DJs by Revenue + Verification breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top 5 DJs by Revenue */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-2.5 px-5 py-3.5 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <Trophy size={14} style={{ color: "#D4A843" }} />
              <p className="text-sm font-semibold text-foreground">Top DJs by Revenue Driven</p>
            </div>

            {topDJs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">No DJ revenue data yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {topDJs.map((dj, i) => {
                  const earningsDollars = dj.totalEarnings / 100;
                  return (
                    <div
                      key={dj.id}
                      className="flex items-center gap-4 px-5 py-3.5"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{
                          backgroundColor: i === 0 ? "#D4A84320" : "#1a1a1a",
                          color: i === 0 ? "#D4A843" : "#555",
                          border: "1px solid #2a2a2a",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {dj.user.name ?? "—"}
                        </p>
                        <p className="text-xs truncate" style={{ color: "#555" }}>
                          @{dj.slug}
                        </p>
                      </div>
                      <p
                        className="text-sm font-bold tabular-nums shrink-0"
                        style={{ color: "#34C759" }}
                      >
                        ${earningsDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification Status Breakdown */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-2.5 px-5 py-3.5 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <ShieldCheck size={14} style={{ color: "#5AC8FA" }} />
              <p className="text-sm font-semibold text-foreground">DJ Verification Stats</p>
            </div>

            <div className="p-5 space-y-3">
              {statusOrder.map((status) => {
                const count = statusMap[status];
                const pct = totalDJs > 0 ? Math.round((count / totalDJs) * 100) : 0;
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: STATUS_COLOR[status] }}
                      >
                        {status}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {count.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ backgroundColor: "#1a1a1a" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: STATUS_COLOR[status],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 pb-4">
              <Link
                href="/admin/dj-verification"
                className="text-xs no-underline hover:opacity-80 transition-opacity"
                style={{ color: "#D4A843" }}
              >
                Manage verifications →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
