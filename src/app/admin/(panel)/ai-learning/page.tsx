"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Brain, RefreshCw, ThumbsUp, ThumbsDown, Edit3, Shield, TrendingDown, MessageSquare } from "lucide-react";

type TopEdit = { fieldChanged: string; sectionType: string; count: number };
type SupportQ = { id: string; question: string; answer: string; createdAt: string };

type LearningData = {
  topEdits: TopEdit[];
  moderation: {
    totalScans: number;
    decided: number;
    approved: number;
    unpublished: number;
    falsePositiveRate: number | null;
  };
  churn: {
    totalPredictions: number;
    rated: number;
    accurate: number;
    accuracyRate: number | null;
  };
  support: {
    totalQueries: number;
    recentQuestions: SupportQ[];
  };
  generationFeedback: { total: number };
};

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={15} style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground font-display">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function RateBar({ label, rate, color, n }: { label: string; rate: number | null; color: string; n?: number }) {
  if (rate === null) return (
    <div className="flex items-center justify-between text-sm py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground text-xs">No data yet</span>
    </div>
  );
  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{rate}%{n !== undefined ? ` (${n} rated)` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AILearningPage() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-learning");
      if (res.ok) setData(await res.json() as LearningData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight flex items-center gap-2.5">
            <Brain size={22} style={{ color: "#E85D4A" }} />
            AI Learning Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            How the AI is performing and improving over time
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

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Failed to load data.</p>
      ) : (
        <>
          {/* Stat overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Page Edit Signals"
              value={data.generationFeedback.total.toLocaleString()}
              sub="field edits logged"
              color="#5AC8FA"
              icon={Edit3}
            />
            <StatCard
              label="Moderation Scans"
              value={data.moderation.totalScans}
              sub={`${data.moderation.decided} admin decisions`}
              color="#E85D4A"
              icon={Shield}
            />
            <StatCard
              label="Churn Predictions"
              value={data.churn.totalPredictions}
              sub={`${data.churn.rated} admin-rated`}
              color="#FF9F0A"
              icon={TrendingDown}
            />
            <StatCard
              label="Support Queries"
              value={data.support.totalQueries}
              sub="questions answered"
              color="#34C759"
              icon={MessageSquare}
            />
          </div>

          <div className="grid grid-cols-[1fr_320px] gap-5">
            {/* Left column */}
            <div className="space-y-5">
              {/* Top edited fields */}
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-semibold text-foreground">Most Edited AI-Generated Fields</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fields studios rewrite most after AI page generation — fed back into generation prompts
                  </p>
                </div>
                {data.topEdits.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No feedback yet — logs appear after studios edit AI-generated pages.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {data.topEdits.map((edit, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            <span className="text-muted-foreground">{edit.sectionType}</span>
                            {" · "}
                            <span style={{ color: "#D4A843" }}>{edit.fieldChanged}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Edited {edit.count}× by studio owners
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (edit.count / (data.topEdits[0]?.count ?? 1)) * 100)}%`,
                                backgroundColor: "#5AC8FA",
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground w-6 text-right">{edit.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent support questions */}
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-semibold text-foreground">Recent Support Questions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Questions asked in the admin support chat</p>
                </div>
                {data.support.recentQuestions.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No support queries yet.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {data.support.recentQuestions.map((q) => (
                      <div key={q.id} className="px-5 py-4 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{q.question}</p>
                          <p className="text-[10px] text-muted-foreground shrink-0">{fmt(q.createdAt)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{q.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column — accuracy */}
            <div className="space-y-5">
              {/* Moderation accuracy */}
              <div
                className="rounded-2xl border p-5"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={15} style={{ color: "#E85D4A" }} />
                  <p className="text-sm font-semibold text-foreground">Moderation Accuracy</p>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Based on {data.moderation.decided} admin decisions. "Approved" = false positive.
                </p>
                <RateBar
                  label="False Positive Rate"
                  rate={data.moderation.falsePositiveRate}
                  color={
                    data.moderation.falsePositiveRate !== null && data.moderation.falsePositiveRate > 40
                      ? "#E85D4A"
                      : "#34C759"
                  }
                  n={data.moderation.decided}
                />
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>✓ Confirmed violations (unpublished)</span>
                    <span className="font-semibold text-foreground">{data.moderation.unpublished}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>✗ False positives (approved)</span>
                    <span className="font-semibold text-foreground">{data.moderation.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total scans</span>
                    <span className="font-semibold text-foreground">{data.moderation.totalScans}</span>
                  </div>
                </div>
                {data.moderation.falsePositiveRate !== null && data.moderation.falsePositiveRate > 40 && (
                  <div
                    className="mt-4 p-3 rounded-xl text-xs"
                    style={{ backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.2)" }}
                  >
                    High false positive rate. Calibration note is being injected into moderation prompts to reduce sensitivity.
                  </div>
                )}
              </div>

              {/* Churn accuracy */}
              <div
                className="rounded-2xl border p-5"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown size={15} style={{ color: "#FF9F0A" }} />
                  <p className="text-sm font-semibold text-foreground">Churn Prediction Accuracy</p>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Based on {data.churn.rated} admin thumbs ratings on churn predictions.
                </p>
                <RateBar
                  label="Prediction Accuracy"
                  rate={data.churn.accuracyRate}
                  color={
                    data.churn.accuracyRate !== null && data.churn.accuracyRate > 70
                      ? "#34C759"
                      : "#FF9F0A"
                  }
                  n={data.churn.rated}
                />
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1"><ThumbsUp size={10} /> Accurate predictions</span>
                    <span className="font-semibold text-foreground">{data.churn.accurate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1"><ThumbsDown size={10} /> Wrong predictions</span>
                    <span className="font-semibold text-foreground">{data.churn.rated - data.churn.accurate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total predictions</span>
                    <span className="font-semibold text-foreground">{data.churn.totalPredictions}</span>
                  </div>
                </div>
                {data.churn.rated > 0 && (
                  <div
                    className="mt-4 p-3 rounded-xl text-xs"
                    style={{
                      backgroundColor: "rgba(255,159,10,0.08)",
                      color: "#FF9F0A",
                      border: "1px solid rgba(255,159,10,0.2)",
                    }}
                  >
                    Accuracy stats are fed back into churn prediction prompts each run.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
