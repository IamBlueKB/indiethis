"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, CheckCircle, RefreshCw, EyeOff, ExternalLink, AlertTriangle } from "lucide-react";

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

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ModerationPage() {
  const router = useRouter();
  const [studios, setStudios] = useState<FlaggedStudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderation");
      const data = await res.json();
      setStudios(data.studios ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approve(studioId: string) {
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/moderation/${studioId}/approve`, { method: "POST" });
      setStudios((s) => s.filter((x) => x.id !== studioId));
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  async function unpublish(studioId: string) {
    if (!window.confirm("Force unpublish this studio?")) return;
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/studios/${studioId}/unpublish`, { method: "POST" });
      setStudios((s) =>
        s.map((x) => x.id === studioId ? { ...x, isPublished: false } : x)
      );
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  async function rescan(studioId: string) {
    setActioning((a) => ({ ...a, [studioId]: true }));
    try {
      await fetch(`/api/admin/moderation/${studioId}/scan`, { method: "POST" });
      await load();
    } finally {
      setActioning((a) => ({ ...a, [studioId]: false }));
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Content Moderation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Studios flagged by AI content scanning
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
      ) : studios.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <CheckCircle size={32} className="mx-auto mb-3" style={{ color: "#34C759" }} />
          <p className="text-foreground font-semibold">All clear</p>
          <p className="text-muted-foreground text-sm mt-1">
            No studios are currently flagged for review.
          </p>
        </div>
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
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
                    >
                      Live
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scanned {fmt(studio.moderationScannedAt)}
                </p>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Studio info */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">{studio.name}</h3>
                      {studio.slug && (
                        <span className="text-xs text-muted-foreground">/{studio.slug}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Owner:{" "}
                      <button
                        onClick={() => router.push(`/admin/users/${studio.owner.id}`)}
                        className="underline hover:text-foreground transition-colors"
                      >
                        {studio.owner.name}
                      </button>{" "}
                      · {studio.owner.email}
                    </p>
                  </div>
                  {studio.slug && (
                    <a
                      href={`/${studio.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink size={12} /> View Page
                    </a>
                  )}
                </div>

                {/* Flag reason */}
                {studio.moderationReason && (
                  <div
                    className="flex items-start gap-2 p-3 rounded-xl text-sm"
                    style={{ backgroundColor: "rgba(232,93,74,0.08)", border: "1px solid rgba(232,93,74,0.2)" }}
                  >
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" style={{ color: "#E85D4A" }} />
                    <p style={{ color: "#E85D4A" }}>{studio.moderationReason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => approve(studio.id)}
                    disabled={!!actioning[studio.id]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.25)" }}
                  >
                    {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Approve — Looks Fine
                  </button>

                  {studio.isPublished && (
                    <button
                      onClick={() => unpublish(studio.id)}
                      disabled={!!actioning[studio.id]}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
                    >
                      {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                      Force Unpublish
                    </button>
                  )}

                  <button
                    onClick={() => rescan(studio.id)}
                    disabled={!!actioning[studio.id]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {actioning[studio.id] ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Re-scan
                  </button>

                  <button
                    onClick={() => router.push(`/admin/studios/${studio.id}`)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
