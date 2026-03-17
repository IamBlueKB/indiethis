import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Cpu, DollarSign, Zap, Layout } from "lucide-react";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";

// Rough average API cost per AI generation type
const COST_PER_USE: Record<string, number> = {
  VIDEO: 0.85,
  COVER_ART: 0.04,
  MASTERING: 0.12,
  LYRIC_VIDEO: 0.65,
  AAR_REPORT: 0.22,
  PRESS_KIT: 0.18,
};

const TOOL_LABEL: Record<string, string> = {
  VIDEO: "Music Video",
  COVER_ART: "Cover Art",
  MASTERING: "Mastering",
  LYRIC_VIDEO: "Lyric Video",
  AAR_REPORT: "A&R Report",
  PRESS_KIT: "Press Kit",
};

const TOOL_COLOR: Record<string, string> = {
  VIDEO: "#E85D4A",
  COVER_ART: "#D4A843",
  MASTERING: "#34C759",
  LYRIC_VIDEO: "#5AC8FA",
  AAR_REPORT: "#AF52DE",
  PRESS_KIT: "#FF9F0A",
};

export default async function AdminAIUsagePage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [usageThisMonth, usageLast30d, pageGenTotal, pageGenPaid] = await Promise.all([
    db.aIGeneration.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.aIGeneration.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.generationLog.count(),
    db.generationLog.count({ where: { wasPaid: true } }),
  ]);

  // Total uses and cost this month
  const totalUsesThisMonth = usageThisMonth.reduce((sum, r) => sum + r._count.id, 0);
  const totalCostThisMonth = usageThisMonth.reduce(
    (sum, r) => sum + r._count.id * (COST_PER_USE[r.type] ?? 0),
    0
  );

  // Page gen revenue (assume $5 per overage generation)
  const PAGE_GEN_OVERAGE_PRICE = 5;
  const pageGenRevenue = pageGenPaid * PAGE_GEN_OVERAGE_PRICE;

  // Build usage trend chart — one line per tool type, last 30 days
  const trendData = (() => {
    const dates: string[] = [];
    const buckets: Record<string, Record<string, number>> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dates.push(key);
      buckets[key] = {};
      for (const type of Object.keys(TOOL_LABEL)) {
        buckets[key][type] = 0;
      }
    }

    for (const gen of usageLast30d) {
      const key = new Date(gen.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (buckets[key]) {
        buckets[key][gen.type] = (buckets[key][gen.type] ?? 0) + 1;
      }
    }

    return dates.map((date) => ({ date, ...buckets[date] }));
  })();

  // Build per-type breakdown
  const usageByType = Object.keys(TOOL_LABEL).map((type) => {
    const count = usageThisMonth.find((r) => r.type === type)?._count.id ?? 0;
    const cost = count * (COST_PER_USE[type] ?? 0);
    return { type, label: TOOL_LABEL[type], count, cost, color: TOOL_COLOR[type] };
  });

  const totalPct = (count: number) =>
    totalUsesThisMonth > 0 ? ((count / totalUsesThisMonth) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide AI tool usage and cost estimates</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "AI Uses This Month", value: totalUsesThisMonth.toLocaleString(), icon: Cpu, color: "#E85D4A" },
          { label: "Est. API Cost", value: `$${totalCostThisMonth.toFixed(2)}`, icon: DollarSign, color: "#34C759" },
          { label: "Page Gens Total", value: pageGenTotal.toLocaleString(), icon: Layout, color: "#D4A843" },
          { label: "Overage Revenue", value: `$${pageGenRevenue.toFixed(2)}`, icon: Zap, color: "#AF52DE" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                <Icon size={15} style={{ color }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Per-tool table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">AI Tool Usage — This Month</p>
        </div>
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 100px 120px 80px" }}
        >
          <span>Tool</span>
          <span>Uses</span>
          <span>Est. Cost</span>
          <span>% of Total</span>
        </div>
        {usageByType.map(({ type, label, count, cost, color }) => (
          <div
            key={type}
            className="grid items-center px-5 py-3.5 border-b last:border-b-0"
            style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 100px 120px 80px" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            <span className="text-sm font-bold text-foreground">{count.toLocaleString()}</span>
            <span className="text-sm" style={{ color: "#34C759" }}>${cost.toFixed(2)}</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${totalPct(count)}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{totalPct(count)}%</span>
            </div>
          </div>
        ))}
        {totalUsesThisMonth === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No AI generations this month yet.</p>
          </div>
        )}
      </div>

      {/* Usage trend chart */}
      <AdminLineChart
        data={trendData}
        lines={Object.keys(TOOL_LABEL).map((type) => ({
          key: type,
          color: TOOL_COLOR[type],
          label: TOOL_LABEL[type],
        }))}
        title="AI Usage Trend — Last 30 Days"
        defaultRange="30d"
        showRangeSelector={false}
      />

      {/* Page generation section */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Page Generation</p>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--border)" }}>
          {[
            { label: "Total Generations", value: pageGenTotal },
            { label: "Paid (Overages)", value: pageGenPaid },
            { label: "Revenue", value: `$${pageGenRevenue.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
