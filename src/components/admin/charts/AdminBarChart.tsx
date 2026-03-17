"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

export interface BarConfig {
  key: string;
  color: string;
  label: string;
}

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface AdminBarChartProps {
  data: DataPoint[];
  bars: BarConfig[];
  title: string;
  valuePrefix?: string;
  valueSuffix?: string;
  /** If true, each bar in a single-bar chart gets its own color from the data item's `color` field */
  multiColor?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, valuePrefix, valueSuffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="font-bold text-white">{valuePrefix}{p.value.toLocaleString()}{valueSuffix}</span>
        </div>
      ))}
    </div>
  );
}

const MULTI_COLORS = ["#E85D4A", "#D4A843", "#5AC8FA", "#34C759", "#AF52DE", "#FF9F0A"];

export default function AdminBarChart({
  data,
  bars,
  title,
  valuePrefix = "",
  valueSuffix = "",
  multiColor = false,
}: AdminBarChartProps) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <p className="text-sm font-semibold text-foreground mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${valuePrefix}${v}${valueSuffix}`}
          />
          <Tooltip
            content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]}>
              {multiColor &&
                data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={MULTI_COLORS[index % MULTI_COLORS.length]} />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
