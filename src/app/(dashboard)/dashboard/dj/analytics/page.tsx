"use client";

import { useEffect, useState } from "react";
import {
  BarChart2,
  Disc3,
  Users,
  DollarSign,
  TrendingUp,
  Flame,
  Wallet,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartEntry = {
  week: string;
  fans: number;
  revenue: number;
};

type AnalyticsData = {
  balance: number;
  totalEarnings: number;
  thisMonth: number;
  tracksInCrates: number;
  fansAttributed: number;
  revenueDriven: number;
  tracksBroken: number;
  chartData: ChartEntry[];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  tooltip,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  tooltip?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 relative group"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {tooltip && (
          <div className="relative">
            <span
              className="text-[10px] text-muted-foreground cursor-help border rounded-full w-4 h-4 flex items-center justify-center"
              style={{ borderColor: "var(--border)" }}
              title={tooltip}
            >
              ?
            </span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DJAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/dj/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl animate-pulse"
            style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
          />
          <div
            className="h-5 w-40 rounded-lg animate-pulse"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 h-28 animate-pulse"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            />
          ))}
        </div>
        <div
          className="rounded-2xl border h-72 animate-pulse"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="rounded-xl border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    balance,
    totalEarnings,
    thisMonth,
    tracksInCrates,
    fansAttributed,
    revenueDriven,
    tracksBroken,
    chartData,
  } = data;

  // Format cents to dollars
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Format week label for display
  const fmtWeek = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const chartFormatted = chartData.map((entry) => ({
    ...entry,
    week: fmtWeek(entry.week),
    revenueDisplay: parseFloat((entry.revenue / 100).toFixed(2)),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
        >
          <BarChart2 size={18} style={{ color: "#D4A843" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">DJ Analytics</h1>
          <p className="text-xs text-muted-foreground">Your attribution and influence stats</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          label="Balance Available"
          value={fmt(balance)}
          icon={<Wallet size={17} />}
          iconBg="rgba(212,168,67,0.12)"
          iconColor="#D4A843"
        />
        <StatCard
          label="Total Earnings"
          value={fmt(totalEarnings)}
          icon={<TrendingUp size={17} />}
          iconBg="rgba(255,255,255,0.07)"
          iconColor="var(--foreground)"
        />
        <StatCard
          label="This Month"
          value={fmt(thisMonth)}
          icon={<DollarSign size={17} />}
          iconBg="rgba(52,199,89,0.12)"
          iconColor="#34C759"
        />
        <StatCard
          label="Tracks in Crates"
          value={tracksInCrates.toLocaleString()}
          icon={<Disc3 size={17} />}
          iconBg="rgba(255,255,255,0.07)"
          iconColor="var(--foreground)"
        />
        <StatCard
          label="Fans Attributed"
          value={fansAttributed.toLocaleString()}
          icon={<Users size={17} />}
          iconBg="rgba(255,255,255,0.07)"
          iconColor="var(--foreground)"
        />
        <StatCard
          label="Revenue Driven"
          value={fmt(revenueDriven)}
          icon={<DollarSign size={17} />}
          iconBg="rgba(255,255,255,0.07)"
          iconColor="var(--foreground)"
        />
        <StatCard
          label="Tracks Broken 🔥"
          value={tracksBroken.toLocaleString()}
          icon={<Flame size={17} />}
          iconBg="rgba(212,168,67,0.12)"
          iconColor="#D4A843"
          tooltip="Tracks that saw 20%+ play growth after being added to your crate"
        />
      </div>

      {/* Growth chart */}
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground">Growth (Last 12 Weeks)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Attributed fans and revenue driven per week</p>
        </div>

        {chartFormatted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <BarChart2 size={32} style={{ color: "rgba(255,255,255,0.10)" }} />
            <p className="text-sm text-muted-foreground">No attribution data yet</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Data appears once fans are attributed through your crates, mixes, or profile.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartFormatted} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "var(--foreground)", marginBottom: "4px" }}
                formatter={(value, name) => {
                  if (name === "Revenue Driven") return [`$${Number(value ?? 0).toFixed(2)}`, name as string];
                  return [value ?? 0, name as string];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", paddingTop: "8px" }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fans"
                name="Attributed Fans"
                stroke="#D4A843"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#D4A843" }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenueDisplay"
                name="Revenue Driven"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "rgba(255,255,255,0.55)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
