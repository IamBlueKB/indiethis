"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminViewOnlyBanner from "@/components/admin/AdminViewOnlyBanner";
import {
  Building2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Eye,
  Layers,
  EyeOff,
  ExternalLink,
  X,
} from "lucide-react";

type StudioRow = {
  id: string;
  name: string;
  slug: string | null;
  studioTier: string | null;
  tierOverride: string | null;
  isPublished: boolean;
  createdAt: string;
  isDormant: boolean;
  moderationStatus: string | null;
  owner: {
    name: string;
    email: string;
    lastLoginAt: string | null;
  };
  _count: {
    artists: number;
    sessions: number;
    contacts: number;
  };
};

type StudioDetail = {
  id: string;
  name: string;
  slug: string | null;
  studioTier: string | null;
  tierOverride: string | null;
  isPublished: boolean;
  createdAt: string;
  description: string | null;
  city: string | null;
  state: string | null;
  owner: { id: string; name: string; email: string; lastLoginAt: string | null };
  _count: { artists: number; sessions: number; contacts: number };
};

type ApiResponse = {
  studios: StudioRow[];
  total: number;
  pages: number;
  page: number;
};

const TIER_COLOR: Record<string, string> = {
  PRO: "#D4A843",
  ELITE: "#34C759",
};

// ─── Studio Detail Modal ──────────────────────────────────────────────────────

function StudioDetailModal({
  studioId,
  onClose,
}: {
  studioId: string;
  onClose: () => void;
}) {
  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/studios/${studioId}`)
      .then((r) => r.json())
      .then((d) => setStudio(d as StudioDetail))
      .finally(() => setLoading(false));
  }, [studioId]);

  function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const effectiveTier = studio?.tierOverride ?? studio?.studioTier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold text-foreground">Studio Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        {loading || !studio ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-base font-semibold text-foreground">{studio.name}</p>
                {effectiveTier && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TIER_COLOR[effectiveTier] ?? "#888"}18`, color: TIER_COLOR[effectiveTier] ?? "#888" }}>
                    {studio.tierOverride ? `${effectiveTier} (override)` : effectiveTier}
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: studio.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)", color: studio.isPublished ? "#34C759" : "rgba(255,255,255,0.35)" }}>
                  {studio.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              {studio.slug && <p className="text-xs text-muted-foreground">/{studio.slug}</p>}
              {(studio.city || studio.state) && (
                <p className="text-xs text-muted-foreground">{[studio.city, studio.state].filter(Boolean).join(", ")}</p>
              )}
              {studio.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{studio.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Artists", value: studio._count.artists },
                { label: "Bookings", value: studio._count.sessions },
                { label: "Contacts", value: studio._count.contacts },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--background)" }}>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Owner */}
            <div className="rounded-xl p-4 space-y-1" style={{ backgroundColor: "var(--background)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Owner</p>
              <p className="text-sm font-medium text-foreground">{studio.owner.name}</p>
              <p className="text-xs text-muted-foreground">{studio.owner.email}</p>
              <p className="text-xs text-muted-foreground">Last login: {fmt(studio.owner.lastLoginAt)}</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Joined</p>
                <p className="text-sm text-foreground">{fmt(studio.createdAt)}</p>
              </div>
              {studio.slug && (
                <div className="rounded-xl p-3" style={{ backgroundColor: "var(--background)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Public URL</p>
                  <a
                    href={`/${studio.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm flex items-center gap-1 hover:underline"
                    style={{ color: "#E85D4A" }}
                  >
                    /{studio.slug} <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tier Override Modal ──────────────────────────────────────────────────────

function TierOverrideModal({
  studio,
  onClose,
  onDone,
}: {
  studio: StudioRow;
  onClose: () => void;
  onDone: (updated: Partial<StudioRow>) => void;
}) {
  const currentOverride = studio.tierOverride ?? "";
  const [tier, setTier] = useState(currentOverride);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/studios/${studio.id}/tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier || null }),
      });
      if (res.ok) {
        const data = await res.json() as { tierOverride: string | null };
        onDone({ tierOverride: data.tierOverride });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-2xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold text-foreground">Override Tier</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Override overrides the studio&apos;s subscription tier regardless of their plan. Clear to restore normal tier.
          </p>
          <div className="space-y-2">
            {["", "PRO", "ELITE"].map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors text-sm font-medium"
                style={{
                  borderColor: tier === t ? "#E85D4A" : "var(--border)",
                  backgroundColor: tier === t ? "rgba(232,93,74,0.08)" : "transparent",
                  color: t ? (TIER_COLOR[t] ?? "var(--foreground)") : "var(--muted-foreground)",
                }}
              >
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: tier === t ? "#E85D4A" : "var(--border)" }}>
                  {tier === t && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#E85D4A" }} />}
                </div>
                {t || "No override (use subscription tier)"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#E85D4A" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Studio Actions Dropdown ──────────────────────────────────────────────────

function StudioActions({
  studio,
  onRefresh,
}: {
  studio: StudioRow;
  onRefresh: (updated: Partial<StudioRow>) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"tier" | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleUnpublish() {
    setUnpublishing(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/admin/studios/${studio.id}/unpublish`, { method: "POST" });
      if (res.ok) onRefresh({ isPublished: false });
    } finally {
      setUnpublishing(false);
    }
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {unpublishing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <MoreHorizontal size={15} />
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-xl z-30 py-1"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { router.push(`/admin/studios/${studio.id}`); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
            >
              <Eye size={14} className="text-muted-foreground" /> View Studio
            </button>
            <button
              onClick={() => { setModal("tier"); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
            >
              <Layers size={14} className="text-muted-foreground" />
              {studio.tierOverride ? `Override: ${studio.tierOverride}` : "Override Tier"}
            </button>
            {studio.slug && (
              <a
                href={`/${studio.slug}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors no-underline"
              >
                <ExternalLink size={14} className="text-muted-foreground" /> View Public Page
              </a>
            )}
            {studio.isPublished && (
              <>
                <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <button
                  onClick={handleUnpublish}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: "#E85D4A" }}
                >
                  <EyeOff size={14} /> Force Unpublish
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {modal === "tier" && (
        <TierOverrideModal
          studio={studio}
          onClose={() => setModal(null)}
          onDone={(updated) => { onRefresh(updated); setModal(null); }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStudiosPage({ viewOnly = false }: { viewOnly?: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [tier, setTier] = useState("");
  const [published, setPublished] = useState("");
  const [dormant, setDormant] = useState(false);
  const [page, setPage] = useState(1);

  const fetchStudios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tier,
        published,
        dormant: String(dormant),
        page: String(page),
        limit: "50",
      });
      const res = await fetch(`/api/admin/studios?${params}`);
      if (res.ok) setData(await res.json() as ApiResponse);
    } finally {
      setLoading(false);
    }
  }, [tier, published, dormant, page]);

  useEffect(() => { fetchStudios(); }, [fetchStudios]);

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }

  function updateStudio(id: string, patch: Partial<StudioRow>) {
    setData((prev) =>
      prev
        ? { ...prev, studios: prev.studios.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
        : prev
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {viewOnly && <AdminViewOnlyBanner page="studios" />}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Studios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {data ? `${data.total} studios` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Tiers</option>
          <option value="PRO">Pro</option>
          <option value="ELITE">Elite</option>
        </select>
        <select
          value={published}
          onChange={(e) => { setPublished(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">Published &amp; Unpublished</option>
          <option value="true">Published only</option>
          <option value="false">Unpublished only</option>
        </select>
        <button
          onClick={() => { setDormant((d) => !d); setPage(1); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all"
          style={{
            borderColor: dormant ? "rgba(255,159,10,0.5)" : "var(--border)",
            backgroundColor: dormant ? "rgba(255,159,10,0.1)" : "transparent",
            color: dormant ? "#FF9F0A" : "var(--muted-foreground)",
          }}
        >
          <AlertTriangle size={13} />
          Dormant only
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 160px 60px 70px 80px 100px 80px 40px" }}
        >
          <span>Studio</span>
          <span>Owner</span>
          <span>Artists</span>
          <span>Sessions</span>
          <span>Contacts</span>
          <span>Last Login</span>
          <span>Joined</span>
          <span />
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : !data?.studios.length ? (
          <div className="py-12 text-center">
            <Building2 size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No studios found.</p>
          </div>
        ) : (
          data.studios.map((s) => {
            const effectiveTier = s.tierOverride ?? s.studioTier;
            return (
              <div
                key={s.id}
                className="grid items-center px-5 py-4 border-b last:border-b-0"
                style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 160px 60px 70px 80px 100px 80px 40px" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    {s.isDormant && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,159,10,0.12)", color: "#FF9F0A" }}>
                        <AlertTriangle size={9} /> Dormant
                      </span>
                    )}
                    {s.moderationStatus === "FLAGGED" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>
                        <AlertTriangle size={9} /> Flagged
                      </span>
                    )}
                    {s.moderationStatus === "REVIEWING" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,159,10,0.12)", color: "#FF9F0A" }}>
                        <AlertTriangle size={9} /> Review
                      </span>
                    )}
                    {!s.isPublished && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                        Draft
                      </span>
                    )}
                    {effectiveTier && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${TIER_COLOR[effectiveTier] ?? "#888"}18`, color: TIER_COLOR[effectiveTier] ?? "#888" }}>
                        {s.tierOverride ? `${effectiveTier}*` : effectiveTier}
                      </span>
                    )}
                  </div>
                  {s.slug && <p className="text-xs text-muted-foreground truncate">/{s.slug}</p>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{s.owner.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.owner.email}</p>
                </div>
                <span className="text-sm text-muted-foreground">{s._count.artists}</span>
                <span className="text-sm text-muted-foreground">{s._count.sessions}</span>
                <span className="text-sm text-muted-foreground">{s._count.contacts}</span>
                <span className="text-xs text-muted-foreground">{formatDate(s.owner.lastLoginAt)}</span>
                <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                {viewOnly ? <span /> : <StudioActions studio={s} onRefresh={(patch) => updateStudio(s.id, patch)} />}
              </div>
            );
          })
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground text-xs">
            Page {data.page} of {data.pages} · {data.total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
