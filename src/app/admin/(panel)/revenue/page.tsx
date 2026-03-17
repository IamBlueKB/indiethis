import { db } from "@/lib/db";
import { DollarSign, TrendingUp, Users, Zap, UserMinus, BarChart2 } from "lucide-react";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";
import AdminPieChart from "@/components/admin/charts/AdminPieChart";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 29, REIGN: 79 };
const TIER_COLOR: Record<string, string> = { LAUNCH: "#888", PUSH: "#D4A843", REIGN: "#34C759" };

export default async function AdminRevenuePage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [subscriptions, paymentsThisMonth, allPayments, allPaymentsLast12m, churned] =
    await Promise.all([
      db.subscription.findMany({
        select: {
          tier: true,
          status: true,
          userId: true,
          createdAt: true,
          cancelReason: true,
          canceledAt: true,
        },
      }),
      db.payment.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: "succeeded" },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.payment.findMany({
        where: { createdAt: { gte: twelveMonthsAgo }, status: "succeeded" },
        select: { createdAt: true, type: true, amount: true },
        orderBy: { createdAt: "asc" },
      }),
      db.subscription.findMany({
        where: { status: "CANCELLED", canceledAt: { gte: thirtyDaysAgo } },
        select: {
          tier: true,
          cancelReason: true,
          canceledAt: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { canceledAt: "desc" },
      }),
    ]);

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const mrr = active.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);
  const arr = mrr * 12;
  const activeSubCount = active.length;

  const arpu = activeSubCount > 0 ? mrr / activeSubCount : 0;

  const avgSubLengthMonths =
    activeSubCount > 0
      ? active.reduce((sum, s) => {
          const months =
            (now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
          return sum + months;
        }, 0) / activeSubCount
      : 0;

  const ltv = arpu * Math.max(avgSubLengthMonths, 1);

  const tierBreakdown = ["LAUNCH", "PUSH", "REIGN"].map((tier) => ({
    tier,
    active: active.filter((s) => s.tier === tier).length,
    total: subscriptions.filter((s) => s.tier === tier).length,
    revenue: active.filter((s) => s.tier === tier).length * (TIER_PRICE[tier] ?? 0),
  }));

  // MRR trend — 12 months
  const mrrTrendData = (() => {
    const result: Array<{ date: string; mrr: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const monthRevenue = allPaymentsLast12m
        .filter(
          (p) =>
            (p.type ?? "").toLowerCase().includes("subscription") &&
            new Date(p.createdAt) >= monthStart &&
            new Date(p.createdAt) < monthEnd
        )
        .reduce((sum, p) => sum + p.amount, 0);
      result.push({ date: key, mrr: Math.round(monthRevenue) });
    }
    return result;
  })();

  const mrrGrowthPct = (() => {
    const prev = mrrTrendData[mrrTrendData.length - 2]?.mrr ?? 0;
    const curr = mrrTrendData[mrrTrendData.length - 1]?.mrr ?? 0;
    if (!prev) return null;
    return (((curr - prev) / prev) * 100).toFixed(1);
  })();

  // Revenue by source — pie
  const revenuePieData = (() => {
    const sources: Record<string, { value: number; color: string }> = {
      Subscriptions: { value: 0, color: "#34C759" },
      "Pay-per-use": { value: 0, color: "#E85D4A" },
      "Merch Cuts": { value: 0, color: "#D4A843" },
      "Music Cuts": { value: 0, color: "#5AC8FA" },
      Overages: { value: 0, color: "#AF52DE" },
    };
    for (const p of allPaymentsLast12m) {
      const t = (p.type ?? "").toLowerCase();
      if (t.includes("subscription")) sources["Subscriptions"].value += p.amount;
      else if (t.includes("ai") || t.includes("tool")) sources["Pay-per-use"].value += p.amount;
      else if (t.includes("merch")) sources["Merch Cuts"].value += p.amount;
      else if (t.includes("beat") || t.includes("music")) sources["Music Cuts"].value += p.amount;
      else if (t.includes("overage")) sources["Overages"].value += p.amount;
    }
    return Object.entries(sources)
      .map(([name, { value, color }]) => ({ name, value: Math.round(value), color }))
      .filter((d) => d.value > 0);
  })();

  const topStats = [
    { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, sub: mrrGrowthPct ? `${Number(mrrGrowthPct) >= 0 ? "+" : ""}${mrrGrowthPct}% vs last month` : undefined, icon: DollarSign, color: "#34C759" },
    { label: "Est. ARR", value: `$${arr.toLocaleString()}`, icon: TrendingUp, color: "#5AC8FA" },
    { label: "Active Subs", value: active.length, icon: Users, color: "#D4A843" },
    { label: "Revenue This Month", value: `$${(paymentsThisMonth._sum.amount ?? 0).toFixed(2)}`, icon: Zap, color: "#E85D4A" },
    { label: "ARPU", value: `$${arpu.toFixed(2)}`, sub: "avg revenue / user", icon: BarChart2, color: "#AF52DE" },
    { label: "Est. LTV", value: `$${ltv.toFixed(2)}`, sub: `${avgSubLengthMonths.toFixed(1)} mo avg length`, icon: UserMinus, color: "#FF9F0A" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform subscription & payment overview</p>
      </div>

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {topStats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                <Icon size={15} style={{ color }} strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <AdminLineChart
          data={mrrTrendData}
          lines={[{ key: "mrr", color: "#34C759", label: "MRR" }]}
          title="MRR Trend — 12 Months"
          defaultRange="12m"
          showRangeSelector={false}
          valuePrefix="$"
        />
        <AdminPieChart
          data={revenuePieData}
          title="Revenue by Source"
          valuePrefix="$"
        />
      </div>

      {/* Tier breakdown */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Subscription Breakdown</p>
        </div>
        {tierBreakdown.map(({ tier, active: tierActive, total, revenue }) => (
          <div key={tier} className="flex items-center justify-between px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier] }}>
                {tier}
              </span>
              <span className="text-sm text-muted-foreground">${TIER_PRICE[tier]}/mo</span>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{tierActive}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: "#34C759" }}>${revenue}/mo</p>
                <p className="text-[10px] text-muted-foreground">MRR</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Churn */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Cancellations — Last 30 Days</p>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: churned.length > 0 ? "#E85D4A18" : "rgba(255,255,255,0.05)",
              color: churned.length > 0 ? "#E85D4A" : "rgba(255,255,255,0.4)",
            }}
          >
            {churned.length}
          </span>
        </div>
        {churned.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No cancellations in the last 30 days 🎉</p>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-[1fr_80px_100px_70px_160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <span>User</span>
              <span>Tier</span>
              <span>Canceled</span>
              <span>Length</span>
              <span>Reason</span>
            </div>
            {churned.map((sub, i) => {
              const subLengthMonths = sub.canceledAt
                ? Math.round(
                    (new Date(sub.canceledAt).getTime() - new Date(sub.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24 * 30)
                  )
                : 0;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_80px_100px_70px_160px] items-center px-5 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{sub.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.user.email}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit"
                    style={{ backgroundColor: `${TIER_COLOR[sub.tier]}18`, color: TIER_COLOR[sub.tier] }}
                  >
                    {sub.tier}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sub.canceledAt
                      ? new Date(sub.canceledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">{subLengthMonths}mo</span>
                  <span className="text-xs text-muted-foreground truncate">{sub.cancelReason ?? "—"}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Recent payments */}
      {allPayments.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Recent Payments</p>
          </div>
          {allPayments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{p.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.type} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <p className="text-sm font-bold" style={{ color: p.status === "succeeded" ? "#34C759" : "#E85D4A" }}>
                ${p.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
