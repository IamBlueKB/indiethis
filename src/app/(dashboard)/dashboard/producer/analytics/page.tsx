"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  ListMusic, Radio, FileText, DollarSign, BarChart2,
  Music, Loader2, Zap, ShoppingBag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = "30d" | "60d" | "90d";

type Stats = {
  totalBeats:            number;
  activeLeases:          number;
  activeLeasesLastMonth: number;
  licensesThisMonth:     number;
  revenueThisMonth:      number;
  totalPlays:            number;
};

type RevPoint    = { date: string; streamLease: number; license: number };
type PlaysPoint  = { date: string; plays: number };
type GrowthPoint = { date: string; active: number };
type EngagementPoint = { name: string; engagement: number };

type BeatRow = {
  id: string; title: string; coverArtUrl: string | null;
  leases: number; licenses: number; totalPlays: number; revenue: number;
};

type ActivityItem = { id: string; type: string; text: string; date: string };

type AnalyticsData = {
  stats:             Stats;
  revenueSeries:     RevPoint[];
  playsSeries:       PlaysPoint[];
  leaseGrowthSeries: GrowthPoint[];
  beatEngagement:    EngagementPoint[];
  topBeatsTable:     BeatRow[];
  recentActivity:    ActivityItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sliceDays(data: { date: string }[], days: number) {
  return data.slice(-days);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const p = ((current - previous) / previous) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`;
}

const CHART_STYLE = {
  bg:      "var(--card)",
  border:  "var(--border)",
  grid:    "rgba(255,255,255,0.05)",
  axis:    "rgba(255,255,255,0.35)",
  tooltip: { backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" },
};

const COLORS = {
  gold:   "#D4A843",
  coral:  "#E87040",
  blue:   "#5AC8FA",
  green:  "#4ADE80",
  purple: "#818CF8",
};

const BAR_COLORS = [COLORS.gold, COLORS.coral, COLORS.blue, COLORS.green, COLORS.purple];

// ─── Shared Tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl" style={CHART_STYLE.tooltip}>
      <p className="font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{p.name}:</span>
          <span className="font-bold text-white">{prefix}{p.value.toLocaleString()}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Range Toggle ─────────────────────────────────────────────────────────────

function RangeToggle({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--background)" }}>
      {(["30d", "60d", "90d"] as DateRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
          style={
            value === r
              ? { backgroundColor: "var(--card)", color: "var(--foreground)" }
              : { color: "rgba(255,255,255,0.4)" }
          }
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({ title, children, range, onRange }: {
  title: string; children: React.ReactNode;
  range?: DateRange; onRange?: (v: DateRange) => void;
}) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: CHART_STYLE.bg, borderColor: CHART_STYLE.border }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {range && onRange && <RangeToggle value={range} onChange={onRange} />}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProducerAnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState<DateRange>("30d");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/producer/analytics");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const days = range === "30d" ? 30 : range === "60d" ? 60 : 90;

  const revSlice    = useMemo(() => data ? sliceDays(data.revenueSeries,     days) : [], [data, days]);
  const playsSlice  = useMemo(() => data ? sliceDays(data.playsSeries,        days) : [], [data, days]);
  const growthSlice = useMemo(() => data ? sliceDays(data.leaseGrowthSeries,  days) : [], [data, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { stats, beatEngagement, topBeatsTable, recentActivity } = data;
  const leasePctChange = pct(stats.activeLeases, stats.activeLeasesLastMonth);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Producer Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            label: "Total Beats",
            value: stats.totalBeats,
            icon:  ListMusic,
            sub:   null,
          },
          {
            label: "Active Leases",
            value: stats.activeLeases,
            icon:  Radio,
            sub:   `${leasePctChange} vs last month`,
            subColor: stats.activeLeases >= stats.activeLeasesLastMonth ? "#4ADE80" : "#F87171",
          },
          {
            label: "Licenses This Month",
            value: stats.licensesThisMonth,
            icon:  FileText,
            sub:   null,
          },
          {
            label: "Revenue This Month",
            value: `$${stats.revenueThisMonth.toFixed(2)}`,
            icon:  DollarSign,
            sub:   null,
          },
          {
            label: "Total Plays",
            value: stats.totalPlays.toLocaleString(),
            icon:  BarChart2,
            sub:   "across all stream-leased tracks",
          },
        ].map(({ label, value, icon: Icon, sub, subColor }) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && (
              <p className="text-[11px] mt-0.5" style={{ color: subColor ?? "rgba(255,255,255,0.35)" }}>
                {sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row 1 — Revenue + Plays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue Over Time" range={range} onRange={setRange}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revSlice} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip prefix="$" />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "rgba(255,255,255,0.5)" }} />
              <Line type="monotone" dataKey="streamLease" name="Stream Lease" stroke={COLORS.gold}   strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="license"     name="License Sales" stroke={COLORS.coral} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Plays Over Time" range={range} onRange={setRange}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={playsSlice} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="plays" name="Plays" stroke={COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 — Engagement + Lease Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top 5 Beats by Engagement">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={beatEngagement} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="engagement" name="Engagement" radius={[0, 4, 4, 0]}>
                {beatEngagement.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stream Lease Growth" range={range} onRange={setRange}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthSlice} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: CHART_STYLE.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="active" name="Active Leases" stroke={COLORS.green} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Bottom row — Top beats table + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top performing beats */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="px-5 pt-5 pb-3 text-sm font-semibold text-foreground">Top Performing Beats</p>
          {topBeatsTable.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Music size={28} className="mb-2" />
              <p className="text-sm">No beats yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  {["Beat", "Leases", "Licenses", "Plays", "Revenue"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topBeatsTable.map((b) => (
                  <tr key={b.id} className="border-b last:border-b-0 hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
                          {b.coverArtUrl
                            ? <img src={b.coverArtUrl} alt={b.title} className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                            : <Music size={11} className="text-muted-foreground" />
                          }
                        </div>
                        <span className="font-medium text-foreground truncate max-w-[100px]">{b.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.leases}</td>
                    <td className="px-4 py-3 text-foreground">{b.licenses}</td>
                    <td className="px-4 py-3 text-foreground">{b.totalPlays.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: COLORS.gold }}>${b.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent activity feed */}
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground mb-4">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Zap size={28} className="mb-2" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {recentActivity.map((a) => {
                const Icon = a.type === "license" ? ShoppingBag : Radio;
                const color = a.type === "license" ? COLORS.gold : COLORS.blue;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${color}22` }}
                    >
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(a.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
