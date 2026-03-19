"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCircle, XCircle, RefreshCw, Users,
  ChevronDown, ChevronUp, PauseCircle, PlayCircle,
  DollarSign, TrendingUp, Link2, Edit2, Check, X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

type AppData = {
  creatorType?: string;
  socialLinks?: string;
  audienceSize?: string;
  promotionPlan?: string;
};

type AffiliateRow = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  customSlug: string | null;
  discountCode: string | null;
  commissionRate: number;
  commissionDurationMonths: number;
  totalEarned: number;
  pendingPayout: number;
  applicationData: AppData | null;
  appliedAt: string;
  approvedAt: string | null;
  user: { id: string; name: string; email: string } | null;
  referrals: { isActive: boolean }[];
};

/* ------------------------------------------------------------------ */
/* Constants                                                             */
/* ------------------------------------------------------------------ */

const STATUS_FILTERS = ["all", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: "rgba(255,159,10,0.12)",  color: "#FF9F0A", label: "Pending" },
  APPROVED:  { bg: "rgba(52,199,89,0.12)",   color: "#34C759", label: "Approved" },
  REJECTED:  { bg: "rgba(232,93,74,0.12)",   color: "#E85D4A", label: "Rejected" },
  SUSPENDED: { bg: "rgba(150,150,150,0.12)", color: "#888",    label: "Suspended" },
};

const AUDIENCE_LABELS: Record<string, string> = {
  under_1k: "< 1K",
  "1k_5k":  "1K–5K",
  "5k_25k": "5K–25K",
  "25k_100k": "25K–100K",
  over_100k: "100K+",
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Stat card                                                             */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number;
  color: string; sub?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--foreground)" }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline commission editor                                              */
/* ------------------------------------------------------------------ */

function CommissionEditor({
  affiliateId,
  currentRate,
  currentMonths,
  onSaved,
}: {
  affiliateId: string;
  currentRate: number;
  currentMonths: number;
  onSaved: (rate: number, months: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rate, setRate]       = useState(String(Math.round(currentRate * 100)));
  const [months, setMonths]   = useState(String(currentMonths));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function save() {
    const rateNum   = parseFloat(rate) / 100;
    const monthsNum = parseInt(months, 10);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 1) { setError("Rate must be 0–100%"); return; }
    if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 60) { setError("Months: 1–60"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliateId}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rateNum, commissionDurationMonths: monthsNum }),
      });
      const data = await res.json();
      if (data.ok) { onSaved(rateNum, monthsNum); setEditing(false); }
      else setError(data.error ?? "Failed.");
    } finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Edit2 size={11} />
        {Math.round(currentRate * 100)}% / {currentMonths}mo
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={0} max={100} step={1} value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-12 px-2 py-1 rounded-lg text-xs text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>%</span>
      </div>
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={1} max={60} step={1} value={months}
          onChange={(e) => setMonths(e.target.value)}
          className="w-12 px-2 py-1 rounded-lg text-xs text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>mo</span>
      </div>
      <button onClick={save} disabled={saving}
        className="p-1.5 rounded-lg"
        style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
      </button>
      <button onClick={() => { setEditing(false); setError(""); }}
        className="p-1.5 rounded-lg"
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
      >
        <X size={11} />
      </button>
      {error && <p className="text-[11px] text-red-400 w-full">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                             */
/* ------------------------------------------------------------------ */

export default function AdminAffiliatesPage() {
  const [filter, setFilter]           = useState<typeof STATUS_FILTERS[number]>("all");
  const [rows, setRows]               = useState<AffiliateRow[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [actioning, setActioning]     = useState<Record<string, boolean>>({});
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/affiliates?status=${filter}`);
      const data = await res.json();
      setRows(data.affiliates ?? []);
      setMonthlyTotal(data.monthlyPayoutTotal ?? 0);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  function toggleExpand(id: string) { setExpanded((e) => ({ ...e, [id]: !e[id] })); }

  async function approve(id: string) {
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/approve`, { method: "POST" });
      if (res.ok) setRows((r) => r.map((x) => x.id === id ? { ...x, status: "APPROVED" } : x));
    } finally { setActioning((a) => ({ ...a, [id]: false })); }
  }

  async function reject(id: string) {
    if (!window.confirm("Reject this affiliate application?")) return;
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/reject`, { method: "POST" });
      if (res.ok) setRows((r) => r.map((x) => x.id === id ? { ...x, status: "REJECTED" } : x));
    } finally { setActioning((a) => ({ ...a, [id]: false })); }
  }

  async function suspend(id: string) {
    if (!window.confirm("Suspend this affiliate? They will lose access to their affiliate dashboard.")) return;
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/suspend`, { method: "POST" });
      if (res.ok) setRows((r) => r.map((x) => x.id === id ? { ...x, status: "SUSPENDED" } : x));
    } finally { setActioning((a) => ({ ...a, [id]: false })); }
  }

  async function reactivate(id: string) {
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/suspend?reactivate=1`, { method: "POST" });
      if (res.ok) setRows((r) => r.map((x) => x.id === id ? { ...x, status: "APPROVED" } : x));
    } finally { setActioning((a) => ({ ...a, [id]: false })); }
  }

  function handleCommissionSaved(id: string, rate: number, months: number) {
    setRows((r) => r.map((x) => x.id === id ? { ...x, commissionRate: rate, commissionDurationMonths: months } : x));
  }

  // Aggregate stats across all loaded rows
  const allApproved        = rows.filter((r) => r.status === "APPROVED");
  const allPending         = rows.filter((r) => r.status === "PENDING");
  const totalEarnedAll     = allApproved.reduce((s, r) => s + r.totalEarned, 0);
  const totalPendingAll    = allApproved.reduce((s, r) => s + r.pendingPayout, 0);
  const activeRefCount     = allApproved.reduce((s, r) => s + r.referrals.filter((x) => x.isActive).length, 0);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Affiliate Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review applications, manage approved affiliates, adjust commissions
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-white/5 transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat cards — shown when "all" or "APPROVED" filter */}
      {!loading && (filter === "all" || filter === "APPROVED") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Approved Affiliates"
            value={allApproved.length}
            color="#34C759"
            sub={`${allPending.length} pending review`}
          />
          <StatCard
            icon={Link2}
            label="Active Referrals"
            value={activeRefCount}
            color="#5AC8FA"
            sub="subscribers from affiliates"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Commission Paid"
            value={`$${totalEarnedAll.toFixed(0)}`}
            color="#D4A843"
            sub="all time"
          />
          <StatCard
            icon={DollarSign}
            label="Paid Out This Month"
            value={`$${monthlyTotal.toFixed(0)}`}
            color="#E85D4A"
            sub={`$${totalPendingAll.toFixed(0)} pending`}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f;
          const count  = f === "all" ? rows.length : (counts[f] ?? 0);
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: "rgba(212,168,67,0.15)", borderColor: "#D4A843", color: "#D4A843" }
                  : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
              }
            >
              {f === "all" ? "All" : STATUS_STYLES[f].label}
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: active ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.06)",
                  color: active ? "#D4A843" : "var(--muted-foreground)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Affiliate cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Users size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-foreground font-semibold">No affiliates</p>
          <p className="text-muted-foreground text-sm mt-1">
            {filter === "all" ? "No affiliate applications yet." : `No ${filter.toLowerCase()} affiliates.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const style         = STATUS_STYLES[row.status];
            const appData       = row.applicationData as AppData | null;
            const isExpanded    = !!expanded[row.id];
            const isBusy        = !!actioning[row.id];
            const activeRefs    = row.referrals.filter((r) => r.isActive).length;
            const totalRefs     = row.referrals.length;
            const showStats     = row.status === "APPROVED" || row.status === "SUSPENDED";

            return (
              <div
                key={row.id}
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Status bar */}
                <div
                  className="flex items-center justify-between px-5 py-3 border-b"
                  style={{ borderColor: "var(--border)", backgroundColor: style.bg }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.color}40` }}
                    >
                      {style.label}
                    </span>
                    {appData?.audienceSize && (
                      <span className="text-xs text-muted-foreground">
                        {AUDIENCE_LABELS[appData.audienceSize] ?? appData.audienceSize} audience
                      </span>
                    )}
                    {appData?.creatorType && (
                      <span className="text-xs text-muted-foreground capitalize">
                        · {appData.creatorType.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Applied {fmt(row.appliedAt)}</p>
                </div>

                {/* Card body */}
                <div className="p-5 space-y-4">

                  {/* Name + link */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{row.applicantName}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{row.applicantEmail}</p>
                      {row.user && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Account: {row.user.name} · {row.user.email}
                        </p>
                      )}
                    </div>
                    {row.status === "APPROVED" && row.customSlug && (
                      <div className="text-right shrink-0">
                        <code
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
                        >
                          /ref/{row.customSlug}
                        </code>
                        {row.discountCode && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Code:{" "}
                            <code
                              className="font-mono px-1 rounded"
                              style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
                            >
                              {row.discountCode}
                            </code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats row (approved + suspended) */}
                  {showStats && (
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl p-3"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                    >
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Referrals</p>
                        <p className="text-sm font-semibold text-foreground">
                          {activeRefs} active
                          <span className="text-muted-foreground font-normal"> / {totalRefs}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Total Earned</p>
                        <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
                          ${row.totalEarned.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">Pending Payout</p>
                        <p className="text-sm font-semibold text-foreground">${row.pendingPayout.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Commission Rate</p>
                        <CommissionEditor
                          affiliateId={row.id}
                          currentRate={row.commissionRate}
                          currentMonths={row.commissionDurationMonths}
                          onSaved={(r, m) => handleCommissionSaved(row.id, r, m)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Application details toggle */}
                  {appData?.promotionPlan && (
                    <div>
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? "Hide" : "View"} application details
                      </button>
                      {isExpanded && (
                        <div
                          className="mt-3 rounded-xl p-4 space-y-3 text-sm"
                          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                        >
                          {appData.socialLinks && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Social Links</p>
                              <p className="text-foreground whitespace-pre-line">{appData.socialLinks}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Promotion Plan</p>
                            <p className="text-foreground leading-relaxed">{appData.promotionPlan}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1 flex-wrap">

                    {row.status === "PENDING" && (
                      <>
                        <button onClick={() => approve(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          Approve
                        </button>
                        <button onClick={() => reject(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                          Reject
                        </button>
                      </>
                    )}

                    {row.status === "APPROVED" && (
                      <>
                        <button onClick={() => suspend(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                          style={{ borderColor: "rgba(255,159,10,0.3)", color: "#FF9F0A", backgroundColor: "rgba(255,159,10,0.08)" }}
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <PauseCircle size={12} />}
                          Suspend
                        </button>
                        <button onClick={() => reject(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          Reject
                        </button>
                        <span className="text-xs text-muted-foreground ml-1">Approved {fmt(row.approvedAt)}</span>
                      </>
                    )}

                    {row.status === "REJECTED" && (
                      <button onClick={() => approve(row.id)} disabled={isBusy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Re-approve
                      </button>
                    )}

                    {row.status === "SUSPENDED" && (
                      <>
                        <button onClick={() => reactivate(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                          Reactivate
                        </button>
                        <button onClick={() => reject(row.id)} disabled={isBusy}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          Reject
                        </button>
                      </>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
