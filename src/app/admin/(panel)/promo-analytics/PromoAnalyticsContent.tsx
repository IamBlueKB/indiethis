"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Star } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Funnel = {
  codesCreated: number;
  totalRedemptions: number;
  totalConversions: number;
  retained: number;
};

type TopCode = {
  id: string;
  code: string;
  type: string;
  redemptions: number;
  conversions: number;
  conversionRate: string;
  ambassadorName: string | null;
};

type TopAmbassador = {
  id: string;
  name: string;
  tier: string;
  referrals: number;
  conversions: number;
  totalEarned: number;
  creditBalance: number;
};

type WinBackCandidate = {
  id: string;
  userName: string;
  userEmail: string;
  code: string;
  codeType: string;
  status: string;
  redeemedAt: string;
};

type AnalyticsData = {
  funnel: Funnel;
  topCodes: TopCode[];
  topAmbassadors: TopAmbassador[];
  cpa: string;
  winBackCandidates: WinBackCandidate[];
};

const TIER_COLORS: Record<string, string> = {
  STANDARD:  "#9A9A9E",
  PREFERRED: "#D4A843",
  ELITE:     "#E85D4A",
};

const TYPE_COLORS: Record<string, string> = {
  FREE_TRIAL: "#5AC8FA",
  DISCOUNT:   "#D4A843",
  COMP:       "#A78BFA",
  CREDIT:     "#34D399",
  AI_BUNDLE:  "#FB923C",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PromoAnalyticsContent() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-analytics");
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="font-bold text-2xl">Promo Analytics</h1>
        <div className="text-center py-20 text-muted-foreground">Loading analytics…</div>
      </div>
    );
  }

  const { funnel, topCodes, topAmbassadors, cpa, winBackCandidates } = data;

  const funnelSteps = [
    { label: "Codes Created", value: funnel.codesCreated, color: "#5AC8FA" },
    { label: "Redemptions", value: funnel.totalRedemptions, color: "#D4A843" },
    { label: "Conversions", value: funnel.totalConversions, color: "#34D399" },
    { label: "Retained (90d)", value: funnel.retained, color: "#E85D4A" },
  ];
  const maxFunnelValue = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Promo Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Conversion funnel, top performers, and win-back opportunities</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <h2 className="font-semibold mb-5">Conversion Funnel</h2>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const pct = Math.round((step.value / maxFunnelValue) * 100);
            const convRate = i > 0 && funnelSteps[i - 1].value > 0
              ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)
              : null;
            return (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <div className="flex items-center gap-3">
                    {convRate && (
                      <span className="text-xs text-muted-foreground">{convRate}% from prev</span>
                    )}
                    <span className="font-bold" style={{ color: step.color }}>{step.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: step.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CPA Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Cost Per Acquisition</p>
          <p className="text-3xl font-bold mt-1" style={{ color: "#34D399" }}>${cpa}</p>
          <p className="text-xs text-muted-foreground mt-1">avg ambassador cost / conversion</p>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Overall Conversion Rate</p>
          <p className="text-3xl font-bold mt-1" style={{ color: "#D4A843" }}>
            {funnel.totalRedemptions > 0
              ? `${((funnel.totalConversions / funnel.totalRedemptions) * 100).toFixed(1)}%`
              : "0.0%"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">redemptions → paid subscribers</p>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Win-Back Opportunities</p>
          <p className="text-3xl font-bold mt-1" style={{ color: "#f87171" }}>{winBackCandidates.length}</p>
          <p className="text-xs text-muted-foreground mt-1">expired/churned ex-trial users</p>
        </div>
      </div>

      {/* Top Codes + Top Ambassadors side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Codes */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-sm">Top Codes</h2>
            <Link href="/admin/promo-codes" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Code</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Redeem</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Conv.</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Rate</th>
              </tr>
            </thead>
            <tbody>
              {topCodes.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No codes yet.</td></tr>
              ) : topCodes.map((code) => (
                <tr key={code.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-2.5">
                    <span className="font-mono font-bold text-xs">{code.code}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ color: TYPE_COLORS[code.type] ?? "#888", backgroundColor: `${TYPE_COLORS[code.type] ?? "#888"}22` }}
                      >
                        {code.type.replace(/_/g, " ")}
                      </span>
                      {code.ambassadorName && <span className="text-[10px] text-muted-foreground">via {code.ambassadorName}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 font-medium text-xs">{code.redemptions}</td>
                  <td className="px-5 py-2.5 text-xs" style={{ color: "#34D399" }}>{code.conversions}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{code.conversionRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Ambassadors */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-sm">Top Ambassadors</h2>
            <Link href="/admin/ambassadors" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Refs</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Conv.</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Earned</th>
              </tr>
            </thead>
            <tbody>
              {topAmbassadors.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No ambassadors yet.</td></tr>
              ) : topAmbassadors.map((amb) => (
                <tr key={amb.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/ambassadors/${amb.id}`} className="font-medium text-xs hover:underline">{amb.name}</Link>
                    <span
                      className="flex items-center gap-1 text-[10px] mt-0.5"
                      style={{ color: TIER_COLORS[amb.tier] ?? "#888" }}
                    >
                      <Star size={8} fill="currentColor" />
                      {amb.tier}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-medium">{amb.referrals}</td>
                  <td className="px-5 py-2.5 text-xs" style={{ color: "#34D399" }}>{amb.conversions}</td>
                  <td className="px-5 py-2.5 text-xs font-medium" style={{ color: "#D4A843" }}>${amb.totalEarned.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Win-Back Candidates */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-sm">Win-Back Candidates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Expired/churned users who tried IndieThis but didn&apos;t convert</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">User</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Expired</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {winBackCandidates.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No win-back candidates — great retention!</td></tr>
            ) : winBackCandidates.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-2.5">
                  <p className="text-xs font-medium">{r.userName}</p>
                  <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs">{r.code}</td>
                <td className="px-5 py-2.5 text-xs text-muted-foreground">{new Date(r.redeemedAt).toLocaleDateString()}</td>
                <td className="px-5 py-2.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.12)" }}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
