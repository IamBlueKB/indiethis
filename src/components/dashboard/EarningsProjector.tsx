"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import type { EarningsProjection } from "@/lib/earnings-projector";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(0)}`;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border p-3 text-xs space-y-1"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", minWidth: 130 }}
    >
      <p className="font-semibold mb-1.5" style={{ color: "#fff" }}>{label}</p>
      {payload.map(p => p.value != null && (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-bold" style={{ color: "#fff" }}>${p.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Projection summary cards ─────────────────────────────────────────────────

function ProjectionCard({ months, amount }: { months: number; amount: number }) {
  return (
    <div
      className="flex-1 rounded-xl border p-4"
      style={{ background: "#111", borderColor: "#1A1A1A" }}
    >
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#555" }}>
        In {months} Month{months !== 1 ? "s" : ""}
      </p>
      <p className="font-display font-bold text-2xl leading-none" style={{ color: "#D4A843" }}>
        {fmt(amount)}
      </p>
      <p className="text-[10px] mt-1" style={{ color: "#555" }}>at current rate</p>
    </div>
  );
}

// ─── Revenue breakdown bar ────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  "Merch Sales":   "#E85D4A",
  "Fan Tips":      "#5AC8FA",
  "Beat Licenses": "#D4A843",
  "Stream Leases": "#34C759",
};

function RevenueBreakdown({ breakdown }: { breakdown: EarningsProjection["revenueBreakdown"] }) {
  if (breakdown.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#555" }}>
        Revenue Sources (6-month window)
      </p>
      <div className="flex rounded-lg overflow-hidden h-2">
        {breakdown.map(b => (
          <div
            key={b.source}
            style={{
              width:      `${b.percentage}%`,
              background: SOURCE_COLORS[b.source] ?? "#D4A843",
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.map(b => (
          <div key={b.source} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: SOURCE_COLORS[b.source] ?? "#D4A843" }}
            />
            <span className="text-[11px]" style={{ color: "#888" }}>
              {b.source} <span style={{ color: "#D4A843" }}>{b.percentage}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EarningsProjector() {
  const [data,    setData]    = useState<EarningsProjection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/earnings-projection")
      .then(r => r.json())
      .then(d => setData(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    if (loading) return (
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="h-48 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
    // Not enough data
    return (
      <div
        className="rounded-2xl border p-6 flex flex-col items-center text-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <TrendingUp size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
        <div>
          <p className="text-sm font-semibold text-foreground">Where You&apos;re Headed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Start selling and we&apos;ll project your earnings trajectory.
            Upload your first track or beat to get started.
          </p>
        </div>
      </div>
    );
  }

  // Find the index of the "today" divider in chartData
  // It's the last index where actual is non-null
  const todayIdx = data.chartData.reduce(
    (last, pt, i) => (pt.actual !== null ? i : last),
    0
  );
  const todayLabel = data.chartData[todayIdx]?.label ?? "";

  const growthPct = (data.growthRate * 100).toFixed(1);
  const growthPos = data.growthRate >= 0;

  return (
    <div
      className="rounded-2xl border p-5 md:p-6 space-y-5"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Where You&apos;re Headed
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#666" }}>
            Based on your last 6 months · {data.topRevenueSource} is your top source ({data.topRevenuePercentage}%)
          </p>
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0"
          style={{
            background: growthPos ? "rgba(52,199,89,0.1)" : "rgba(232,93,74,0.1)",
            color:      growthPos ? "#34C759" : "#E85D4A",
          }}
        >
          <ArrowUpRight size={11} style={{ transform: growthPos ? undefined : "rotate(90deg)" }} />
          <span className="text-[10px] font-bold">{growthPos ? "+" : ""}{growthPct}%/mo</span>
        </div>
      </div>

      {/* 3-month summary cards */}
      <div className="flex gap-3">
        {data.projections.map(p => (
          <ProjectionCard key={p.months} months={p.months} amount={p.atCurrentRate} />
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#D4A843" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#D4A843" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#555", fontFamily: "DM Sans, sans-serif" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#555", fontFamily: "DM Sans, sans-serif" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${v}`}
              width={42}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />

            {/* Today divider */}
            <ReferenceLine
              x={todayLabel}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 3"
              label={{ value: "Today", position: "insideTopLeft", fontSize: 9, fill: "#555" }}
            />

            {/* Actual area */}
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#D4A843"
              strokeWidth={2}
              fill="url(#goldAreaGrad)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: "#D4A843" }}
            />

            {/* Projected flat */}
            <Line
              type="monotone"
              dataKey="projectedFlat"
              name="At current rate"
              stroke="rgba(212,168,67,0.55)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              connectNulls={false}
              dot={false}
            />

            {/* Projected with growth */}
            <Line
              type="monotone"
              dataKey="projectedGrowth"
              name="With growth"
              stroke="rgba(232,93,74,0.7)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              connectNulls={false}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {[
          { label: "Actual",          color: "#D4A843",               dashed: false },
          { label: "At current rate", color: "rgba(212,168,67,0.55)", dashed: true  },
          { label: "With growth",     color: "rgba(232,93,74,0.7)",   dashed: true  },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <svg width={20} height={2} viewBox="0 0 20 2">
              <line
                x1="0" y1="1" x2="20" y2="1"
                stroke={l.color}
                strokeWidth={l.dashed ? 1.5 : 2}
                strokeDasharray={l.dashed ? "4 2" : undefined}
              />
            </svg>
            <span className="text-[10px]" style={{ color: "#666" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Revenue breakdown */}
      <RevenueBreakdown breakdown={data.revenueBreakdown} />
    </div>
  );
}
