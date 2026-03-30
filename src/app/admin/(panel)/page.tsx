import { db } from "@/lib/db";
import {
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ShieldOff,
  Tag,
  BarChart2,
  Star,
  Radio,
  Play,
  Disc3,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";
import AdminBarChart from "@/components/admin/charts/AdminBarChart";
import AIInsightsCard from "@/components/admin/AIInsightsCard";
import ChurnPredictionTable from "@/components/admin/ChurnPredictionTable";
import AdminViewOnlyBanner from "@/components/admin/AdminViewOnlyBanner";
import { requireAdminAccess } from "@/lib/require-admin-access";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 49, REIGN: 99 };

function pctDelta(current: number, prev: number): { delta: string; positive: boolean } | null {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return { delta: `${Math.abs(pct).toFixed(1)}%`, positive: pct >= 0 };
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { viewOnly } = await requireAdminAccess("dashboard");
  const { denied } = await searchParams;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    artistCount,
    studioCount,
    activeSubscriptions,
    newUsersThisMonth,
    recentUsers,
    artistCountLastMonth,
    studioCountLastMonth,
    activeSubsLastMonth,
    allUsersLast12m,
    allStudiosLast12m,
    allPaymentsLast12m,
    activePromoCount,
    totalRedemptions,
    conversionsThisMonth,
    ambassadorBalanceOwed,
    activeLeaseCount,
    totalLeasePlays,
    uniqueBeatLeaseCount,
    duplicateFlagCount,
    totalLeadsThisMonth,
    totalConvertedThisMonth,
    studioLeadBreakdown,
    smsSentThisMonth,
  ] = await Promise.all([
    db.user.count({ where: { role: "ARTIST" } }),
    db.studio.count(),
    db.subscription.findMany({ where: { status: "ACTIVE" }, select: { tier: true } }),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.user.count({ where: { role: "ARTIST", createdAt: { lt: startOfMonth } } }),
    db.studio.count({ where: { createdAt: { lt: startOfMonth } } }),
    db.subscription.count({ where: { status: "ACTIVE", createdAt: { lt: startOfMonth } } }),
    db.user.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    db.studio.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, status: "succeeded" },
      select: { createdAt: true, type: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
    db.promoCode.count({ where: { isActive: true } }),
    db.promoRedemption.count(),
    db.promoRedemption.count({ where: { status: "CONVERTED", convertedAt: { gte: startOfMonth } } }),
    db.ambassador.aggregate({ _sum: { creditBalance: true } }).then((r) => r._sum.creditBalance ?? 0),
    db.streamLease.count({ where: { isActive: true } }),
    db.streamLeasePlay.count(),
    db.streamLease.groupBy({ by: ["beatId"], where: { isActive: true } }).then((r) => r.length),
    db.streamLease.count({ where: { duplicateFlag: true } }),
    // Platform-wide booking leads this month
    Promise.all([
      db.contactSubmission.count({ where: { createdAt: { gte: startOfMonth } } }),
      db.intakeSubmission.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]).then(([c, i]) => c + i),
    // Platform-wide converted bookings this month
    db.contact.count({ where: { convertedToBooking: true, convertedAt: { gte: startOfMonth } } }),
    // Per-studio lead breakdown
    db.studio.findMany({
      select: {
        id: true,
        name: true,
        averageSessionRate: true,
        _count: {
          select: {
            contactSubmissions: { where: { createdAt: { gte: startOfMonth } } },
            intakeSubmissions:  { where: { createdAt: { gte: startOfMonth } } },
            contacts:           { where: { convertedToBooking: true, convertedAt: { gte: startOfMonth } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    // SMS broadcasts sent this month (platform-wide)
    db.broadcastLog.aggregate({
      where: { sentAt: { gte: startOfMonth } },
      _sum:  { recipientCount: true },
    }),
  ]);

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);
  const activeSubCount = activeSubscriptions.length;
  const mrrLastMonth = activeSubsLastMonth * 29;

  // Signups chart — monthly artists vs studios for last 12 months
  const signupsChartData = (() => {
    const months = 12;
    const dates: string[] = [];
    const artistBuckets: Record<string, number> = {};
    const studioBuckets: Record<string, number> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      dates.push(key);
      artistBuckets[key] = 0;
      studioBuckets[key] = 0;
    }
    for (const u of allUsersLast12m) {
      const key = new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (u.role === "ARTIST" && key in artistBuckets) artistBuckets[key]++;
      if (u.role === "STUDIO_ADMIN" && key in studioBuckets) studioBuckets[key]++;
    }
    void allStudiosLast12m; // included in allUsersLast12m via STUDIO_ADMIN role
    return dates.map((date) => ({ date, artists: artistBuckets[date], studios: studioBuckets[date] }));
  })();

  // MRR chart — 6 months via subscription payments
  const mrrChartData = (() => {
    const result: Array<{ date: string; mrr: number }> = [];
    for (let i = 5; i >= 0; i--) {
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

  // Revenue by source
  const revenueBySource = (() => {
    const sources: Record<string, number> = {
      Subscriptions: 0,
      "Pay-per-use": 0,
      "Merch Cuts": 0,
      "Music Cuts": 0,
      Overages: 0,
    };
    for (const p of allPaymentsLast12m) {
      const t = (p.type ?? "").toLowerCase();
      if (t.includes("subscription")) sources["Subscriptions"] += p.amount;
      else if (t.includes("ai") || t.includes("tool")) sources["Pay-per-use"] += p.amount;
      else if (t.includes("merch")) sources["Merch Cuts"] += p.amount;
      else if (t.includes("beat") || t.includes("music")) sources["Music Cuts"] += p.amount;
      else if (t.includes("overage")) sources["Overages"] += p.amount;
    }
    return Object.entries(sources).map(([name, value]) => ({ name, value: Math.round(value) }));
  })();

  // Platform lead ROI — potential value based on all leads × each studio's avg rate
  const totalEstimatedValue = studioLeadBreakdown.reduce((sum, s) => {
    const leads = s._count.contactSubmissions + s._count.intakeSubmissions;
    const rate  = s.averageSessionRate ?? 150;
    return sum + leads * rate;
  }, 0);

  const artistDelta = pctDelta(artistCount, artistCountLastMonth);
  const studioDelta = pctDelta(studioCount, studioCountLastMonth);
  const subDelta = pctDelta(activeSubCount, activeSubsLastMonth);
  const mrrDelta = pctDelta(mrr, mrrLastMonth);

  const stats = [
    { label: "Total Artists", value: artistCount, sub: `+${newUsersThisMonth} this month`, icon: Users, color: "#5AC8FA", href: "/admin/users", delta: artistDelta },
    { label: "Total Studios", value: studioCount, sub: "registered studios", icon: Building2, color: "#D4A843", href: "/admin/studios", delta: studioDelta },
    { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, sub: `${activeSubCount} active subscriptions`, icon: DollarSign, color: "#34C759", href: "/admin/revenue", delta: mrrDelta },
    { label: "Active Subs", value: activeSubCount, sub: "paying users", icon: TrendingUp, color: "#E85D4A", href: "/admin/revenue", delta: subDelta },
  ];

  const ROLE_COLOR: Record<string, string> = {
    ARTIST: "#5AC8FA",
    STUDIO_ADMIN: "#D4A843",
    PLATFORM_ADMIN: "#E85D4A",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Platform Administration
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">IndieThis platform overview</p>
      </div>

      {/* Access denied notice when redirected from a restricted page */}
      {denied && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{ backgroundColor: "rgba(232,93,74,0.08)", borderColor: "rgba(232,93,74,0.3)", color: "#E85D4A" }}
        >
          <ShieldOff size={15} className="shrink-0" />
          <span>You don&apos;t have permission to access <strong>{denied}</strong>. Contact a Super Admin if you need access.</span>
        </div>
      )}

      {/* View-only banner */}
      {viewOnly && <AdminViewOnlyBanner page="dashboard" />}

      {/* AI Insights Card */}
      <Suspense fallback={
        <div className="rounded-2xl border p-5 flex items-center gap-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Generating AI insights…</p>
        </div>
      }>
        <AIInsightsCard />
      </Suspense>

      {/* Stats with % change */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border p-5 no-underline block hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
                {stat.delta && (
                  <span
                    className="flex items-center gap-0.5 text-[11px] font-semibold"
                    style={{ color: stat.delta.positive ? "#34C759" : "#E85D4A" }}
                  >
                    {stat.delta.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {stat.delta.delta}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Promo & Ambassador Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Active Promo Codes", value: activePromoCount, sub: "codes live", icon: Tag, color: "#FB923C", href: "/admin/promo-codes" },
          { label: "Total Redemptions", value: totalRedemptions, sub: "all time", icon: BarChart2, color: "#A78BFA", href: "/admin/promo-analytics" },
          { label: "Conversions / Month", value: conversionsThisMonth, sub: "this month", icon: TrendingUp, color: "#34D399", href: "/admin/promo-analytics" },
          { label: "Ambassador Balance", value: `$${(ambassadorBalanceOwed as number).toFixed(2)}`, sub: "owed to ambassadors", icon: Star, color: "#D4A843", href: "/admin/ambassadors" },
          { label: "SMS Sent This Month", value: (smsSentThisMonth._sum.recipientCount ?? 0).toLocaleString(), sub: "recipients across all artists", icon: MessageSquare, color: "#5AC8FA", href: "/admin/users" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border p-5 no-underline block hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Duplicate stream lease alert */}
      {duplicateFlagCount > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{ backgroundColor: "rgba(251,146,60,0.08)", borderColor: "rgba(251,146,60,0.35)", color: "#FB923C" }}
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">{duplicateFlagCount} stream lease{duplicateFlagCount !== 1 ? "s" : ""} flagged for duplicate audio.</span>
            {" "}Review these in the stream leases section — an artist may have uploaded a raw beat file or reused an existing song.
          </div>
        </div>
      )}

      {/* Stream Lease Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Stream Leases",
            value: activeLeaseCount,
            sub: "artist–beat pairs",
            icon: Radio,
            color: "#E85D4A",
            href: "/admin/revenue",
          },
          {
            label: "Lease Revenue / Mo",
            value: `$${(activeLeaseCount * 0.30).toFixed(2)}`,
            sub: "platform share ($0.30 × leases)",
            icon: DollarSign,
            color: "#34C759",
            href: "/admin/revenue",
          },
          {
            label: "Total Lease Plays",
            value: totalLeasePlays.toLocaleString(),
            sub: "all time streams",
            icon: Play,
            color: "#5AC8FA",
            href: "/admin/revenue",
          },
          {
            label: "Beats Being Leased",
            value: uniqueBeatLeaseCount,
            sub: "unique beats with active leases",
            icon: Disc3,
            color: "#A78BFA",
            href: "/admin/revenue",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border p-5 no-underline block hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Booking Lead Tracking */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: "Platform Leads / Month",
            value: totalLeadsThisMonth,
            sub: "contact + intake forms this month",
            icon: Users,
            color: "#D4A843",
            href: "/admin/lead-tracking/leads",
          },
          {
            label: "Potential Lead Value",
            value: `$${totalEstimatedValue.toLocaleString()}`,
            sub: `${totalLeadsThisMonth} leads × studio avg rates`,
            icon: DollarSign,
            color: "#34C759",
            href: "/admin/lead-tracking/value",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border p-5 no-underline block hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Per-studio lead breakdown */}
      {studioLeadBreakdown.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Studio Lead Breakdown — This Month</p>
          </div>
          <div
            className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
            style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 80px 80px 80px 110px" }}
          >
            <span>Studio</span>
            <span>Inquiries</span>
            <span>Bookings</span>
            <span>Converted</span>
            <span>Est. Value</span>
          </div>
          {studioLeadBreakdown.map((s) => {
            const leads     = s._count.contactSubmissions + s._count.intakeSubmissions;
            const converted = s._count.contacts;
            const estValue  = converted * (s.averageSessionRate ?? 150);
            return (
              <div
                key={s.id}
                className="grid items-center px-5 py-3 border-b last:border-b-0 text-sm"
                style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 80px 80px 80px 110px" }}
              >
                <p className="font-medium text-foreground truncate pr-4">{s.name}</p>
                <p className="text-muted-foreground">{s._count.contactSubmissions}</p>
                <p className="text-muted-foreground">{s._count.intakeSubmissions}</p>
                <p className="text-muted-foreground">{converted}</p>
                <p className="font-semibold" style={{ color: estValue > 0 ? "#34C759" : "var(--muted-foreground)" }}>
                  ${estValue.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[1fr_260px] gap-5">
        {/* Recent signups */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Recent Signups</p>
            <Link href="/admin/users" className="flex items-center gap-1 text-xs text-accent no-underline hover:opacity-80">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role] }}>
                {u.role === "STUDIO_ADMIN" ? "STUDIO" : u.role}
              </span>
            </div>
          ))}
        </div>

        {/* Platform status */}
        <div className="rounded-2xl border overflow-hidden h-fit" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Platform Status</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "Database", ok: true },
              { label: "Auth Service", ok: true },
              { label: "Brevo Email", ok: true },
              { label: "UploadThing", ok: true },
              { label: "Stripe", ok: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="flex items-center gap-1" style={{ color: item.ok ? "#34C759" : "#E85D4A" }}>
                  {item.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  <span className="text-xs font-semibold">{item.ok ? "OK" : "Pending"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-5">
        <AdminLineChart
          data={signupsChartData}
          lines={[
            { key: "artists", color: "#5AC8FA", label: "Artists" },
            { key: "studios", color: "#D4A843", label: "Studios" },
          ]}
          title="New Signups"
          defaultRange="12m"
        />
        <AdminLineChart
          data={mrrChartData}
          lines={[{ key: "mrr", color: "#34C759", label: "MRR" }]}
          title="MRR Trend (6 months)"
          defaultRange="12m"
          showRangeSelector={false}
          valuePrefix="$"
        />
      </div>

      {/* Revenue by source */}
      <AdminBarChart
        data={revenueBySource}
        bars={[{ key: "value", color: "#E85D4A", label: "Revenue" }]}
        title="Revenue by Source — Last 12 Months"
        valuePrefix="$"
        multiColor
      />

      {/* Churn Prediction */}
      <Suspense fallback={
        <div className="rounded-2xl border p-5 flex items-center gap-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Running churn prediction…</p>
        </div>
      }>
        <ChurnPredictionTable />
      </Suspense>
    </div>
  );
}
