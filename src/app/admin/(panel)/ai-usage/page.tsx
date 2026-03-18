import { db }             from "@/lib/db";
import { Cpu, DollarSign, Zap,
         TrendingUp, AlertCircle, Clock, Users } from "lucide-react";
import AdminLineChart    from "@/components/admin/charts/AdminLineChart";
import JobsTable         from "./JobsTable";

// ─── Per-tool display config ───────────────────────────────────────────────────

const TOOL_LABEL: Record<string, string> = {
  VIDEO:       "Music Video",
  COVER_ART:   "Cover Art",
  MASTERING:   "Mastering",
  LYRIC_VIDEO: "Lyric Video",
  AR_REPORT:   "A&R Report",
  PRESS_KIT:   "Press Kit",
};

const TOOL_COLOR: Record<string, string> = {
  VIDEO:       "#E85D4A",
  COVER_ART:   "#D4A843",
  MASTERING:   "#34C759",
  LYRIC_VIDEO: "#5AC8FA",
  AR_REPORT:   "#AF52DE",
  PRESS_KIT:   "#FF9F0A",
};

// Fallback cost estimate when costToUs is null (pre-measurement jobs)
const COST_ESTIMATE: Record<string, number> = {
  VIDEO: 0.85, COVER_ART: 0.04, MASTERING: 0.12,
  LYRIC_VIDEO: 0.65, AR_REPORT: 0.22, PRESS_KIT: 0.18,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (ms < 1000)   return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string;
  icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}>
          <Icon size={15} style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Page (server component) ───────────────────────────────────────────────────

export default async function AdminAIUsagePage() {
  const now           = new Date();
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const stuckAt       = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

  // ── Fire all queries in parallel ──────────────────────────────────────────
  const [
    totalJobsAllTime,
    revenueAgg,
    costAgg,
    countByType,
    revenueByType,
    costByType,
    countByTrigger,
    failedCount,
    processingCount,
    queuedCount,
    stuckCount,
    thisMonthCount,
    recentComplete,
    trendRaw,
    pageGenTotal,
    pageGenPaid,
  ] = await Promise.all([
    db.aIJob.count(),
    db.aIJob.aggregate({ _sum: { priceCharged: true } }),
    db.aIJob.aggregate({ _sum: { costToUs:     true } }),
    db.aIJob.groupBy({ by: ["type"],        _count: { id: true }              }),
    db.aIJob.groupBy({ by: ["type"],        _sum:   { priceCharged: true }    }),
    db.aIJob.groupBy({ by: ["type"],        _sum:   { costToUs: true }        }),
    db.aIJob.groupBy({ by: ["triggeredBy"], _count: { id: true }              }),
    db.aIJob.count({ where: { status: "FAILED"     } }),
    db.aIJob.count({ where: { status: "PROCESSING" } }),
    db.aIJob.count({ where: { status: "QUEUED"     } }),
    db.aIJob.count({ where: { status: "PROCESSING", createdAt: { lte: stuckAt } } }),
    db.aIJob.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.aIJob.findMany({
      where:   { status: "COMPLETE", completedAt: { not: null } },
      select:  { createdAt: true, completedAt: true },
      orderBy: { createdAt: "desc" },
      take:    500,
    }),
    db.aIJob.findMany({
      where:   { createdAt: { gte: thirtyDaysAgo } },
      select:  { type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.generationLog.count(),
    db.generationLog.count({ where: { wasPaid: true } }),
  ]);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalRevenue   = revenueAgg._sum.priceCharged ?? 0;
  const totalCostKnown = costAgg._sum.costToUs        ?? 0;
  const netMargin      = totalRevenue - totalCostKnown;
  const marginPct      = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

  const artistCount = countByTrigger.find(r => r.triggeredBy === "ARTIST")?._count.id ?? 0;
  const studioCount = countByTrigger.find(r => r.triggeredBy === "STUDIO")?._count.id ?? 0;

  // Avg processing time from last 500 completed jobs
  const withTimes = recentComplete.filter(j => j.completedAt != null);
  const avgDurationMs = withTimes.length > 0
    ? withTimes.reduce((s, j) => s + j.completedAt!.getTime() - j.createdAt.getTime(), 0)
      / withTimes.length
    : 0;

  // ── Per-type breakdown ─────────────────────────────────────────────────────
  const typeBreakdown = Object.keys(TOOL_LABEL).map(type => {
    const count   = countByType.find(r => r.type === type)?._count.id          ?? 0;
    const revenue = revenueByType.find(r => r.type === type)?._sum.priceCharged ?? 0;
    const cost    = costByType.find(r => r.type === type)?._sum.costToUs
                    ?? count * (COST_ESTIMATE[type] ?? 0);
    const margin  = revenue - cost;
    const marginP = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { type, label: TOOL_LABEL[type], color: TOOL_COLOR[type],
             count, revenue, cost, margin, marginP };
  });
  const totalCount = typeBreakdown.reduce((s, r) => s + r.count, 0);

  // ── 30-day trend chart ─────────────────────────────────────────────────────
  const trendData = (() => {
    const dates: string[] = [];
    const buckets: Record<string, Record<string, number>> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dates.push(k);
      buckets[k] = {};
      for (const t of Object.keys(TOOL_LABEL)) buckets[k][t] = 0;
    }
    for (const job of trendRaw) {
      const k = new Date(job.createdAt)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (buckets[k]) buckets[k][job.type] = (buckets[k][job.type] ?? 0) + 1;
    }
    return dates.map(date => ({ date, ...buckets[date] }));
  })();

  // Page gen
  const pageGenRevenue = pageGenPaid * 5;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Unified AIJob queue — real revenue, cost, and queue health across all tools
        </p>
      </div>

      {/* ── Primary stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs"    value={totalJobsAllTime.toLocaleString()}
          icon={Cpu}        color="#E85D4A"
          sub={`${thisMonthCount.toLocaleString()} this month`} />
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`}
          icon={TrendingUp} color="#34C759" sub="from completed jobs" />
        <StatCard label="Platform Cost" value={`$${totalCostKnown.toFixed(2)}`}
          icon={DollarSign} color="#FF9F0A" sub="actual provider costs" />
        <StatCard label="Net Margin"    value={`$${netMargin.toFixed(2)}`}
          icon={Zap}        color="#AF52DE"
          sub={`${marginPct.toFixed(1)}% margin`} />
      </div>

      {/* ── Secondary stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Artist Jobs"       value={artistCount.toLocaleString()}
          icon={Users}     color="#D4A843"
          sub={`${studioCount.toLocaleString()} studio-triggered`} />
        <StatCard label="Failed Jobs"       value={failedCount.toLocaleString()}
          icon={AlertCircle} color="#E85D4A"
          sub={`${processingCount} processing · ${queuedCount} queued`} />
        <StatCard label="Stuck Jobs"        value={stuckCount.toLocaleString()}
          icon={Clock}     color="#FF9F0A" sub="PROCESSING > 30 min" />
        <StatCard label="Avg. Process Time" value={avgDurationMs > 0 ? fmtDuration(avgDurationMs) : "—"}
          icon={Zap}       color="#5AC8FA"
          sub={withTimes.length > 0 ? `last ${withTimes.length} completed` : "no data yet"} />
      </div>

      {/* ── Per-type breakdown table ────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Breakdown by Tool — All Time</p>
        </div>
        <div className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)",
            gridTemplateColumns: "1.5fr 70px 90px 90px 90px 75px 100px" }}>
          <span>Tool</span>
          <span>Jobs</span>
          <span>Revenue</span>
          <span>Cost</span>
          <span>Margin</span>
          <span>Margin%</span>
          <span>% of Total</span>
        </div>
        {typeBreakdown.map(r => {
          const pct = totalCount > 0 ? (r.count / totalCount) * 100 : 0;
          return (
            <div key={r.type}
              className="grid items-center px-5 py-3 border-b last:border-b-0"
              style={{ borderColor: "var(--border)",
                gridTemplateColumns: "1.5fr 70px 90px 90px 90px 75px 100px" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }} />
                <span className="text-sm font-medium text-foreground">{r.label}</span>
              </div>
              <span className="text-sm font-bold text-foreground">{r.count.toLocaleString()}</span>
              <span className="text-sm font-semibold" style={{ color: "#34C759" }}>
                ${r.revenue.toFixed(2)}
              </span>
              <span className="text-sm" style={{ color: "#E85D4A" }}>
                ${r.cost.toFixed(2)}
              </span>
              <span className="text-sm font-semibold"
                style={{ color: r.margin >= 0 ? "#34C759" : "#E85D4A" }}>
                ${r.margin.toFixed(2)}
              </span>
              <span className="text-sm"
                style={{ color: r.marginP >= 0 ? "#34C759" : "#E85D4A" }}>
                {r.marginP.toFixed(1)}%
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${pct.toFixed(1)}%`, backgroundColor: r.color }} />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
        {totalCount === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No AI jobs yet.</p>
          </div>
        )}
      </div>

      {/* ── Artist vs Studio bar ────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold text-foreground mb-4">Jobs by Trigger Source</p>
        <div className="space-y-2.5">
          {[
            { label: "Artist-triggered", count: artistCount, color: "#D4A843" },
            { label: "Studio-triggered",  count: studioCount,  color: "#5AC8FA" },
          ].map(({ label, count, color }) => {
            const pct = totalJobsAllTime > 0 ? (count / totalJobsAllTime) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="text-xs font-bold text-foreground w-20 text-right shrink-0">
                  {count.toLocaleString()}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({pct.toFixed(1)}%)
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 30-day trend chart ─────────────────────────────────────────── */}
      <AdminLineChart
        data={trendData}
        lines={Object.keys(TOOL_LABEL).map(type => ({
          key:   type,
          color: TOOL_COLOR[type],
          label: TOOL_LABEL[type],
        }))}
        title="AI Job Trend — Last 30 Days"
        defaultRange="30d"
        showRangeSelector={false}
      />

      {/* ── Queue health alert ─────────────────────────────────────────── */}
      {(stuckCount > 0 || failedCount > 0) && (
        <div className="rounded-2xl border p-4 flex items-start gap-3"
          style={{
            borderColor: stuckCount > 0 ? "#FF9F0A" : "rgba(232,93,74,0.4)",
            background:  stuckCount > 0
              ? "rgba(255,159,10,0.06)" : "rgba(232,93,74,0.06)",
          }}>
          <AlertCircle size={17} className="shrink-0 mt-0.5"
            style={{ color: stuckCount > 0 ? "#FF9F0A" : "#E85D4A" }} />
          <div>
            <p className="text-sm font-semibold text-foreground">Queue Health Warning</p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {stuckCount > 0 && (
                <li className="text-xs text-muted-foreground">
                  <strong style={{ color: "#FF9F0A" }}>{stuckCount}</strong>{" "}
                  job{stuckCount !== 1 ? "s" : ""} stuck in PROCESSING for &gt;30 min
                </li>
              )}
              {failedCount > 0 && (
                <li className="text-xs text-muted-foreground">
                  <strong style={{ color: "#E85D4A" }}>{failedCount}</strong>{" "}
                  total failed — filter by FAILED in Job Log below
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ── Legacy page generation ─────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">
            Studio Page Generation
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (public studio site builder)
            </span>
          </p>
        </div>
        <div className="grid grid-cols-3">
          {[
            { label: "Total Generations", value: pageGenTotal.toLocaleString()     },
            { label: "Paid (Overages)",   value: pageGenPaid.toLocaleString()      },
            { label: "Overage Revenue",   value: `$${pageGenRevenue.toFixed(2)}`   },
          ].map(({ label, value }) => (
            <div key={label} className="p-5 border-r last:border-r-0"
              style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {label}
              </p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interactive job log (client component) ─────────────────────── */}
      <JobsTable />
    </div>
  );
}
