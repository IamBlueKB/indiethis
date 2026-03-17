import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DollarSign, TrendingUp, Users, Zap } from "lucide-react";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 29, REIGN: 79 };
const TIER_COLOR: Record<string, string> = { LAUNCH: "#888", PUSH: "#D4A843", REIGN: "#34C759" };

export default async function AdminRevenuePage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [subscriptions, paymentsThisMonth, allPayments] = await Promise.all([
    db.subscription.findMany({
      select: { tier: true, status: true, userId: true },
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
  ]);

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const mrr = active.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);
  const arr = mrr * 12;

  const tierBreakdown = ["LAUNCH", "PUSH", "REIGN"].map((tier) => ({
    tier,
    active: active.filter((s) => s.tier === tier).length,
    total: subscriptions.filter((s) => s.tier === tier).length,
    revenue: active.filter((s) => s.tier === tier).length * (TIER_PRICE[tier] ?? 0),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform subscription & payment overview</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, icon: DollarSign, color: "#34C759" },
          { label: "Est. ARR", value: `$${arr.toLocaleString()}`, icon: TrendingUp, color: "#5AC8FA" },
          { label: "Active Subs", value: active.length, icon: Users, color: "#D4A843" },
          { label: "Revenue This Month", value: `$${(paymentsThisMonth._sum.amount ?? 0).toFixed(2)}`, icon: Zap, color: "#E85D4A" },
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

      {/* Tier breakdown */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Subscription Breakdown</p>
        </div>
        {tierBreakdown.map(({ tier, active, total, revenue }) => (
          <div key={tier} className="flex items-center justify-between px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier] }}>
                {tier}
              </span>
              <span className="text-sm text-muted-foreground">${TIER_PRICE[tier]}/mo</span>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{active}</p>
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

      {/* Recent payments */}
      {allPayments.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Recent Payments</p>
          </div>
          {allPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-sm font-medium text-foreground">{p.user.name}</p>
                <p className="text-xs text-muted-foreground">{p.type} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
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
