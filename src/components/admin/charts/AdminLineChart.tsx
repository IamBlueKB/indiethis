"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import DateRangeSelector, { type DateRange } from "./DateRangeSelector";

export interface LineConfig {
  key: string;
  color: string;
  label: string;
}

interface DataPoint {
  date: string;
  [key: string]: string | number;
}

interface AdminLineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  title: string;
  defaultRange?: DateRange;
  valuePrefix?: string;
  valueSuffix?: string;
  showRangeSelector?: boolean;
}

function filterByRange(data: DataPoint[], range: DateRange): DataPoint[] {
  if (!data.length) return data;
  const limit = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : data.length;
  return data.slice(-limit);
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
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{p.name}:</span>
          <span className="font-bold text-white">{valuePrefix}{p.value.toLocaleString()}{valueSuffix}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminLineChart({
  data,
  lines,
  title,
  defaultRange = "30d",
  valuePrefix = "",
  valueSuffix = "",
  showRangeSelector = true,
}: AdminLineChartProps) {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const filtered = useMemo(() => filterByRange(data, range), [data, range]);

  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {showRangeSelector && <DateRangeSelector value={range} onChange={setRange} />}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={filtered} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${valuePrefix}${v}${valueSuffix}`}
          />
          <Tooltip
            content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />}
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          />
          {lines.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "rgba(255,255,255,0.5)" }}
            />
          )}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
