"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, Radio, FileText, TrendingUp, ExternalLink, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxType = "STREAM_LEASE" | "LICENSE_SALE";

type Transaction = {
  id:          string;
  date:        string;
  type:        TxType;
  beat:        string;
  from:        string;
  fromSlug:    string | null;
  amount:      number;
  licenseType?: string;
};

type Summary = {
  totalAllTime:      number;
  totalThisMonth:    number;
  leaseTotal:        number;
  leaseThisMonth:    number;
  licenseTotal:      number;
  licenseThisMonth:  number;
  monthlyLeaseIncome: number;
  activeLeaseCount:  number;
};

type MonthPoint = { month: string; streamLease: number; license: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short", year: "2-digit",
  });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const LICENSE_META: Record<string, { label: string; color: string }> = {
  EXCLUSIVE:     { label: "Exclusive",     color: "#D4A843" },
  NON_EXCLUSIVE: { label: "Non-Exclusive", color: "#818CF8" },
  LEASE:         { label: "Lease",         color: "#4ADE80" },
};

const CHART_STYLE = {
  bg:      "var(--card)",
  border:  "var(--border)",
  grid:    "rgba(255,255,255,0.05)",
  axis:    "rgba(255,255,255,0.35)",
  tooltip: { backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)" },
};

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: { value: number }) => s + p.value, 0);
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-xl" style={CHART_STYLE.tooltip}>
      <p className="font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{p.name}:</span>
          <span className="font-bold text-white">${p.value.toFixed(2)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center gap-2 border-t mt-1 pt-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="w-2 h-2" />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>Total:</span>
          <span className="font-bold text-white">${total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: accent ? "rgba(212,168,67,0.08)" : "var(--card)",
        borderColor:     accent ? "rgba(212,168,67,0.3)"  : "var(--border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className="text-2xl font-bold"
        style={{ color: accent ? "#D4A843" : "var(--foreground)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5 text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ─── Source Split Bar ──────────────────────────────────────────────────────────

function SourceSplit({ leaseTotal, licenseTotal }: { leaseTotal: number; licenseTotal: number }) {
  const total = leaseTotal + licenseTotal;
  if (total === 0) return null;

  const leasePct   = Math.round((leaseTotal   / total) * 100);
  const licensePct = 100 - leasePct;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <p className="text-sm font-semibold text-foreground mb-4">Earnings by Source</p>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-4">
        <div
          style={{ width: `${leasePct}%`, backgroundColor: "#5AC8FA" }}
          title={`Stream Leases ${leasePct}%`}
        />
        <div
          style={{ width: `${licensePct}%`, backgroundColor: "#D4A843" }}
          title={`License Sales ${licensePct}%`}
        />
      </div>

      {/* Legend + values */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5AC8FA" }} />
            <span className="text-xs text-muted-foreground">Stream Leases</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(leaseTotal)}</p>
          <p className="text-[11px] text-muted-foreground">{leasePct}% of total</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#D4A843" }} />
            <span className="text-xs text-muted-foreground">License Sales</span>
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(licenseTotal)}</p>
          <p className="text-[11px] text-muted-foreground">{licensePct}% of total</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProducerEarningsPage() {
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [txFilter,     setTxFilter]     = useState<"ALL" | TxType>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/producer/earnings");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTransactions(data.transactions);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Build monthly chart data from transactions (last 6 months)
  const monthlyChart = useMemo<MonthPoint[]>(() => {
    const map: Record<string, MonthPoint> = {};

    // Seed the last 6 calendar months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[k]   = { month: fmtMonth(k), streamLease: 0, license: 0 };
    }

    for (const tx of transactions) {
      const k = monthKey(tx.date);
      if (!map[k]) continue; // outside the 6-month window
      if (tx.type === "STREAM_LEASE") {
        map[k].streamLease += tx.amount;
      } else {
        map[k].license += tx.amount;
      }
    }

    return Object.values(map);
  }, [transactions]);

  const filtered = txFilter === "ALL"
    ? transactions
    : transactions.filter((t) => t.type === txFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  const hasAnyEarnings = summary.totalAllTime > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Producer Earnings</h1>
        {summary.activeLeaseCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "rgba(90,200,250,0.1)", color: "#5AC8FA", border: "1px solid rgba(90,200,250,0.2)" }}
          >
            <Radio size={12} />
            {summary.activeLeaseCount} active lease{summary.activeLeaseCount !== 1 ? "s" : ""}
            {" · "}
            {fmt(summary.monthlyLeaseIncome)}/mo recurring
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Earned"
          value={fmt(summary.totalAllTime)}
          sub="all-time combined"
          icon={DollarSign}
          accent
        />
        <StatCard
          label="This Month"
          value={fmt(summary.totalThisMonth)}
          sub={`$${summary.leaseThisMonth.toFixed(2)} lease · $${summary.licenseThisMonth.toFixed(2)} license`}
          icon={TrendingUp}
        />
        <StatCard
          label="Stream Lease Income"
          value={fmt(summary.leaseTotal)}
          sub={`${summary.activeLeaseCount} active · ${fmt(summary.monthlyLeaseIncome)}/mo`}
          icon={Radio}
        />
        <StatCard
          label="License Sales"
          value={fmt(summary.licenseTotal)}
          sub={`${transactions.filter((t) => t.type === "LICENSE_SALE").length} total sales`}
          icon={FileText}
        />
      </div>

      {/* Chart + Source split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly bar chart — takes 2/3 width */}
        <div
          className="lg:col-span-2 rounded-xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm font-semibold text-foreground mb-4">Monthly Earnings — Last 6 Months</p>
          {hasAnyEarnings ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: CHART_STYLE.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_STYLE.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "rgba(255,255,255,0.5)" }}
                />
                <Bar dataKey="streamLease" name="Stream Leases" stackId="a" fill="#5AC8FA" radius={[0, 0, 0, 0]} />
                <Bar dataKey="license"     name="License Sales" stackId="a" fill="#D4A843" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[220px] text-center">
              <DollarSign size={32} className="text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">No earnings yet</p>
              <p className="text-xs text-muted-foreground">
                Earnings from stream leases and beat sales will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Source split — 1/3 */}
        {hasAnyEarnings ? (
          <SourceSplit leaseTotal={summary.leaseTotal} licenseTotal={summary.licenseTotal} />
        ) : (
          <div
            className="rounded-xl border p-5 flex items-center justify-center"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm text-muted-foreground text-center">
              Source breakdown will appear once you have earnings.
            </p>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Table header + filter */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-semibold text-foreground">
            Transaction History
            {transactions.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({transactions.length} total)
              </span>
            )}
          </p>

          {/* Filter pills */}
          <div className="flex gap-1.5">
            {(["ALL", "STREAM_LEASE", "LICENSE_SALE"] as const).map((f) => {
              const labels = { ALL: "All", STREAM_LEASE: "Stream Leases", LICENSE_SALE: "Licenses" };
              return (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                  style={
                    txFilter === f
                      ? { backgroundColor: "var(--accent)", color: "var(--background)" }
                      : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table body */}
        {transactions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{ backgroundColor: "var(--card)" }}
          >
            <DollarSign size={36} className="text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Stream lease payments and beat license sales will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex items-center justify-center py-12 text-sm text-muted-foreground"
            style={{ backgroundColor: "var(--card)" }}
          >
            No {txFilter === "STREAM_LEASE" ? "stream lease" : "license"} transactions.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {["Date", "Type", "Beat", "From", "Details", "Amount"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const isLease   = tx.type === "STREAM_LEASE";
                const licMeta   = tx.licenseType ? LICENSE_META[tx.licenseType] : null;

                return (
                  <tr
                    key={tx.id}
                    className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(tx.date)}
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={
                          isLease
                            ? { backgroundColor: "rgba(90,200,250,0.12)", color: "#5AC8FA" }
                            : { backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }
                        }
                      >
                        {isLease
                          ? <><Radio size={10} /> Stream Lease</>
                          : <><FileText size={10} /> License Sale</>
                        }
                      </span>
                    </td>

                    {/* Beat */}
                    <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">
                      {tx.beat}
                    </td>

                    {/* From (artist) */}
                    <td className="px-4 py-3">
                      {tx.fromSlug ? (
                        <a
                          href={`/${tx.fromSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-foreground hover:text-accent transition-colors"
                        >
                          {tx.from}
                          <ExternalLink size={10} className="text-muted-foreground shrink-0" />
                        </a>
                      ) : (
                        <span className="text-foreground">{tx.from}</span>
                      )}
                    </td>

                    {/* Details (license type or "Monthly payment") */}
                    <td className="px-4 py-3">
                      {isLease ? (
                        <span className="text-xs text-muted-foreground">Monthly payment</span>
                      ) : licMeta ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${licMeta.color}18`, color: licMeta.color }}
                        >
                          {licMeta.label}
                        </span>
                      ) : null}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-semibold" style={{ color: "#4ADE80" }}>
                      +{fmt(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
