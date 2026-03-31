"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams }       from "next/navigation";
import { Loader2, ShieldAlert, CheckCircle, RefreshCw, EyeOff, ExternalLink, AlertTriangle, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlaggedStudio = {
  id: string;
  name: string;
  slug: string | null;
  moderationStatus: "FLAGGED" | "REVIEWING";
  moderationReason: string | null;
  moderationScannedAt: string | null;
  isPublished: boolean;
  createdAt: string;
  owner: { id: string; name: string; email: string };
};

type ContentFlag = {
  id:          string;
  contentType: string;
  contentId:   string;
  reason:      string;
  severity:    "LOW" | "MEDIUM" | "HIGH";
  status:      string;
  createdAt:   string;
  user: { id: string; name: string | null; email: string };
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   "#E85D4A",
  MEDIUM: "#FF9F0A",
  LOW:    "#60A5FA",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModerationPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const defaultTab   = searchParams.get("tab") === "flags" ? "flags" : "studios";

  const [tab, setTab]         = useState<"studios" | "flags">(defaultTab);
  const [studios, setStudios] = useState<FlaggedStudio[]>([]);
  const [flags, setFlags]     = useState<ContentFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadStudios = useCallback(async () => {
    const res  = await fetch("/api/admin/moderation");
    const data = await res.json();
    setStudios(data.studios ?? []);
  }, []);

  const loadFlags = useCallback(async () => {
    const res  = await fetch("/api/admin/moderation/flags?status=PENDING");
    const data = await res.json();
    setFlags(data.flags ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadStudios(), loadFlags()]);
    } finally {
      setLoading(false);
    }
  }, [loadStudios, loadFlags]);

  useEffect(() => { void load(); }, [load]);

  // ── Studio actions ──────────────────────────────────────────────────────────
  async function approveStudio(studioId: string) {
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/moderation/${studioId}/approve`, { method: "POST" });
      setStudios((s) => s.filter((x) => x.id !== studioId));
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  async function unpublishStudio(studioId: string) {
    if (!window.confirm("Force unpublish this studio?")) return;
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/studios/${studioId}/unpublish`, { method: "POST" });
      setStudios((s) => s.map((x) => x.id === studioId ? { ...x, isPublished: false } : x));
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  async function rescanStudio(studioId: string) {
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/moderation/${studioId}/scan`, { method: "POST" });
      await loadStudios();
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  // ── Content flag actions ────────────────────────────────────────────────────
  async function reviewFlag(flagId: string, action: "approve" | "remove") {
    if (action === "remove" && !window.confirm("Remove this content and notify the artist?")) return;
    setActioning((a) => ({ ...a, [flagId]: true }));
    try {
      await fetch(`/api/admin/moderation/flags/${flagId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      setFlags((f) => f.filter((x) => x.id !== flagId));
    } finally {
      setActioning((a) => ({ ...a, [flagId]: false }));
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Content Moderation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review flagged content and studio registrations
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(["studios", "flags"] as const).map((t) => {
          const count = t === "studios" ? studios.length : flags.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                tab === t
                  ? { backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {t === "studios" ? "Studios" : "Content Flags"}
              {count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: tab === t ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.08)",
                    color: tab === t ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : tab === "studios" ? (
        /* ── Studios tab ──────────────────────────────────────────────────── */
        studios.length === 0 ? (
          <EmptyState message="No studios are currently flagged for review." />
        ) : (
          <div className="space-y-4">
            {studios.map((studio) => (
              <div
                key={studio.id}
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: studio.moderationStatus === "FLAGGED"
                    ? "rgba(232,93,74,0.4)"
                    : "rgba(255,159,10,0.4)",
                }}
              >
                {/* Top bar */}
                <div
                  className="flex items-center justify-between px-5 py-3 border-b"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: studio.moderationStatus === "FLAGGED"
                      ? "rgba(232,93,74,0.08)"
                      : "rgba(255,159,10,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {studio.moderationStatus === "FLAGGED" ? (
                      <ShieldAlert size={16} style={{ color: "#E85D4A" }} />
                    ) : (
                      <AlertTriangle size={16} style={{ color: "#FF9F0A" }} />
                    )}
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{
                        backgroundColor: studio.moderationStatus === "FLAGGED"
                          ? "rgba(232,93,74,0.15)"
                          : "rgba(255,159,10,0.15)",
                        color: studio.moderationStatus === "FLAGGED" ? "#E85D4A" : "#FF9F0A",
                      }}
                    >
                      {studio.moderationStatus}
                    </span>
                    {studio.isPublished && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Scanned {fmt(studio.moderationScannedAt)}</p>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">{studio.name}</h3>
                        {studio.slug && <span className="text-xs text-muted-foreground">/{studio.slug}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Owner:{" "}
                        <button onClick={() => router.push(`/admin/users/${studio.owner.id}`)} className="underline hover:text-foreground transition-colors">
                          {studio.owner.name}
                        </button>{" "}
                        · {studio.owner.email}
                      </p>
                    </div>
                    {studio.slug && (
                      <a href={`/${studio.slug}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink size={12} /> View Page
                      </a>
                    )}
                  </div>

                  {studio.moderationReason && (
                    <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
                      style={{ backgroundColor: "rgba(232,93,74,0.08)", border: "1px solid rgba(232,93,74,0.2)" }}>
                      <ShieldAlert size={14} className="shrink-0 mt-0.5" style={{ color: "#E85D4A" }} />
                      <p style={{ color: "#E85D4A" }}>{studio.moderationReason}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={() => approveStudio(studio.id)} disabled={!!actioning[studio.id]}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}>
                      {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      Approve
                    </button>
                    {studio.isPublished && (
                      <button onClick={() => unpublishStudio(studio.id)} disabled={!!actioning[studio.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}>
                        {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                        Force Unpublish
                      </button>
                    )}
                    <button onClick={() => rescanStudio(studio.id)} disabled={!!actioning[studio.id]}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                      {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Re-scan
                    </button>
                    <button onClick={() => router.push(`/admin/studios/${studio.id}`)}
                      className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Content Flags tab ────────────────────────────────────────────── */
        flags.length === 0 ? (
          <EmptyState message="No content flags pending review." />
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => {
              const color = SEVERITY_COLOR[flag.severity] ?? "#888";
              return (
                <div
                  key={flag.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: "var(--card)", borderColor: `${color}44` }}
                >
                  {/* Top bar */}
                  <div className="flex items-center justify-between px-5 py-2.5 border-b"
                    style={{ borderColor: "var(--border)", backgroundColor: `${color}0d` }}>
                    <div className="flex items-center gap-3">
                      <ShieldAlert size={14} style={{ color }} />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{ backgroundColor: `${color}22`, color }}>
                        {flag.severity}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase"
                        style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)" }}>
                        {flag.contentType.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(flag.createdAt)}</p>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Reason:{" "}
                          <span style={{ color }}>{flag.reason}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Content ID: <code className="text-xs opacity-60">{flag.contentId}</code>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Artist:{" "}
                          <button onClick={() => router.push(`/admin/users/${flag.user.id}`)}
                            className="underline hover:text-foreground transition-colors">
                            {flag.user.name ?? "Unknown"}
                          </button>{" "}
                          · {flag.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => reviewFlag(flag.id, "approve")}
                        disabled={!!actioning[flag.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}
                      >
                        {actioning[flag.id] ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Approve — Looks Fine
                      </button>

                      <button
                        onClick={() => reviewFlag(flag.id, "remove")}
                        disabled={!!actioning[flag.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
                      >
                        {actioning[flag.id] ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Remove Content
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border p-12 text-center"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <CheckCircle size={32} className="mx-auto mb-3" style={{ color: "#34C759" }} />
      <p className="text-foreground font-semibold">All clear</p>
      <p className="text-muted-foreground text-sm mt-1">{message}</p>
    </div>
  );
}
