"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface PieDataPoint {
  name: string;
  value: number;
  color: string;
}

interface AdminPieChartProps {
  data: PieDataPoint[];
  title: string;
  valuePrefix?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, valuePrefix }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.payload.color }} />
        <span style={{ color: "rgba(255,255,255,0.6)" }}>{d.name}:</span>
        <span className="font-bold text-white">{valuePrefix}{d.value.toLocaleString()}</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>({d.payload.percent ? `${(d.payload.percent * 100).toFixed(1)}%` : ""})</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AdminPieChart({ data, title, valuePrefix = "" }: AdminPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) {
    return (
      <div className="rounded-2xl border p-5 flex flex-col" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold text-foreground mb-4">{title}</p>
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-xs text-muted-foreground">No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <p className="text-sm font-semibold text-foreground mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "rgba(255,255,255,0.5)" }}
            formatter={(value) => <span style={{ color: "rgba(255,255,255,0.6)" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
