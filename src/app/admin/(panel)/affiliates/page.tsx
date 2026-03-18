"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCircle, XCircle, RefreshCw, Users,
  ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";

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
  totalEarned: number;
  applicationData: AppData | null;
  appliedAt: string;
  approvedAt: string | null;
  user: { id: string; name: string; email: string } | null;
};

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

export default function AdminAffiliatesPage() {
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>("all");
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/affiliates?status=${filter}`);
      const data = await res.json();
      setRows(data.affiliates ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  async function approve(id: string) {
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/approve`, { method: "POST" });
      if (res.ok) {
        setRows((r) => r.map((x) => x.id === id ? { ...x, status: "APPROVED" } : x));
      }
    } finally {
      setActioning((a) => ({ ...a, [id]: false }));
    }
  }

  async function reject(id: string) {
    if (!window.confirm("Reject this affiliate application?")) return;
    setActioning((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/reject`, { method: "POST" });
      if (res.ok) {
        setRows((r) => r.map((x) => x.id === id ? { ...x, status: "REJECTED" } : x));
      }
    } finally {
      setActioning((a) => ({ ...a, [id]: false }));
    }
  }

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
            Affiliate Applications
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review, approve, or reject affiliate program applications
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

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f;
          const count = f === "all" ? rows.length : (counts[f] ?? 0);
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

      {/* Content */}
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
          <p className="text-foreground font-semibold">No applications</p>
          <p className="text-muted-foreground text-sm mt-1">
            {filter === "all" ? "No affiliate applications yet." : `No ${filter.toLowerCase()} applications.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const style = STATUS_STYLES[row.status];
            const appData = row.applicationData as AppData | null;
            const isExpanded = !!expanded[row.id];
            const isBusy = !!actioning[row.id];

            return (
              <div
                key={row.id}
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Top bar */}
                <div
                  className="flex items-center justify-between px-5 py-3 border-b"
                  style={{ borderColor: "var(--border)", backgroundColor: `${style.bg}` }}
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

                {/* Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{row.applicantName}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{row.applicantEmail}</p>
                      {row.user && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Linked account: {row.user.name} · {row.user.email}
                        </p>
                      )}
                    </div>
                    {row.status === "APPROVED" && row.customSlug && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground mb-0.5">Affiliate link</p>
                        <code
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
                        >
                          /go/{row.customSlug}
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

                  {/* Expand toggle for application details */}
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
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                Social Links
                              </p>
                              <p className="text-foreground whitespace-pre-line">{appData.socialLinks}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Promotion Plan
                            </p>
                            <p className="text-foreground leading-relaxed">{appData.promotionPlan}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    {row.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => approve(row.id)}
                          disabled={isBusy}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          Approve
                        </button>
                        <button
                          onClick={() => reject(row.id)}
                          disabled={isBusy}
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
                        <button
                          onClick={() => reject(row.id)}
                          disabled={isBusy}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          Suspend
                        </button>
                        <span className="text-xs text-muted-foreground">
                          Earned: <strong className="text-foreground">${row.totalEarned.toFixed(2)}</strong>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Approved {fmt(row.approvedAt)}
                        </span>
                      </>
                    )}

                    {row.status === "REJECTED" && (
                      <button
                        onClick={() => approve(row.id)}
                        disabled={isBusy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Re-approve
                      </button>
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
