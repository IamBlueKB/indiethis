"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store";
import {
  CalendarDays, Plus, Loader2, CheckCircle2, Clock, Rocket, XCircle, Music2, ChevronRight,
} from "lucide-react";
import UpgradeGate from "@/components/dashboard/UpgradeGate";

// ── Types ──────────────────────────────────────────────────────────────────

type PlanSummary = {
  id: string;
  title: string;
  releaseDate: string;
  status: "PLANNING" | "IN_PROGRESS" | "LAUNCHED" | "CANCELLED";
  track: { id: string; title: string; coverArtUrl: string | null } | null;
  release: { id: string; title: string; coverUrl: string | null } | null;
  tasks: { id: string; isCompleted: boolean }[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  PLANNING:    { label: "Planning",     bg: "rgba(120,120,120,0.12)", color: "#888",    Icon: Clock },
  IN_PROGRESS: { label: "In Progress",  bg: "rgba(212,168,67,0.12)",  color: "#D4A843", Icon: Rocket },
  LAUNCHED:    { label: "Launched",     bg: "rgba(52,199,89,0.12)",   color: "#34C759", Icon: CheckCircle2 },
  CANCELLED:   { label: "Cancelled",    bg: "rgba(232,93,74,0.12)",   color: "#E85D4A", Icon: XCircle },
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(days: number): { text: string; color: string } {
  if (days > 0) return { text: `${days} day${days === 1 ? "" : "s"} to release`, color: "#D4A843" };
  if (days === 0) return { text: "Releases today!", color: "#34C759" };
  return { text: `Released ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, color: "#888" };
}


// ── Create Plan Modal ────────────────────────────────────────────────────────

function CreatePlanModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (plan: PlanSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !releaseDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/release-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), releaseDate }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreate(data.plan);
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to create plan");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} style={{ color: "#D4A843" }} />
            <h2 className="font-bold">New Release Plan</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Plan Title <span style={{ color: "#E85D4A" }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Midnight Drive Single Release"'
            required
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Release Date <span style={{ color: "#E85D4A" }}>*</span>
          </label>
          <input
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            type="date"
            required
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}

        <div
          className="rounded-xl border px-3 py-2.5 flex items-start gap-2.5"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.2)" }}
        >
          <Rocket size={13} style={{ color: "#D4A843" }} className="shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We'll auto-generate a 20-task rollout checklist with due dates calculated back from your release date.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !title.trim() || !releaseDate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Rocket size={14} /> Create Release Plan</>}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground"
            style={{ backgroundColor: "var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReleasePlannerPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const tier = user?.tier ?? "launch";
  const hasAccess = tier === "push" || tier === "reign";

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    fetch("/api/dashboard/release-plans")
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hasAccess]);

  if (!hasAccess) return (
    <UpgradeGate
      requiredTier="PUSH"
      featureName="Release Planner"
      featureDescription="Plan your entire release rollout — auto-generated timelines, coordinated tasks, and integrated launch workflows."
      features={[
        "Auto-generated 20-task release checklist",
        "Countdown timer and status tracking per release",
        "Coordinated launch tasks across all your IndieThis tools",
      ]}
    />
  );

  function handleCreated(plan: PlanSummary) {
    setShowCreate(false);
    router.push(`/dashboard/release-planner/${plan.id}`);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Release Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Coordinate your entire release rollout</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> Create Release Plan
        </button>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : plans.length === 0 ? (
        <div
          className="rounded-2xl border py-16 text-center space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
          >
            <CalendarDays size={24} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="font-bold">No release plans yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a plan and get a full auto-generated rollout checklist.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Plus size={14} /> Create Release Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const meta = STATUS_META[plan.status];
            const Icon = meta.Icon;
            const completed = plan.tasks.filter((t) => t.isCompleted).length;
            const total = plan.tasks.length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const days = daysUntil(plan.releaseDate);
            const countdown = countdownLabel(days);

            return (
              <button
                key={plan.id}
                onClick={() => router.push(`/dashboard/release-planner/${plan.id}`)}
                className="w-full rounded-2xl border p-5 flex items-center gap-4 hover:border-accent/40 transition-colors text-left group"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Cover art */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ backgroundColor: "var(--border)" }}
                >
                  {(plan.track?.coverArtUrl || plan.release?.coverUrl)
                    ? <img src={(plan.track?.coverArtUrl ?? plan.release?.coverUrl)!} alt={plan.title} className="w-full h-full object-cover" />
                    : <Music2 size={18} className="text-muted-foreground" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{plan.title}</p>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      <Icon size={9} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#34C759" : "#D4A843" }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{completed}/{total}</span>
                    </div>
                    {/* Countdown */}
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: countdown.color }}>
                      {countdown.text}
                    </span>
                  </div>
                </div>

                <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreatePlanModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </div>
  );
}
