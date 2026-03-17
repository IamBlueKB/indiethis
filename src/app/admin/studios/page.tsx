"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type StudioRow = {
  id: string;
  name: string;
  slug: string | null;
  studioTier: string | null;
  isPublished: boolean;
  createdAt: string;
  isDormant: boolean;
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

export default function AdminStudiosPage() {
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

  function filterChanged() { setPage(1); }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
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
          onChange={(e) => { setTier(e.target.value); filterChanged(); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Tiers</option>
          <option value="PRO">Pro</option>
          <option value="ELITE">Elite</option>
        </select>

        <select
          value={published}
          onChange={(e) => { setPublished(e.target.value); filterChanged(); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">Published &amp; Unpublished</option>
          <option value="true">Published only</option>
          <option value="false">Unpublished only</option>
        </select>

        <button
          onClick={() => { setDormant((d) => !d); filterChanged(); }}
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
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 160px 60px 70px 80px 100px 80px" }}
        >
          <span>Studio</span>
          <span>Owner</span>
          <span>Artists</span>
          <span>Sessions</span>
          <span>Contacts</span>
          <span>Last Login</span>
          <span>Joined</span>
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
          data.studios.map((s) => (
            <div
              key={s.id}
              className="grid items-center px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 160px 60px 70px 80px 100px 80px" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  {s.isDormant && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,159,10,0.12)", color: "#FF9F0A" }}>
                      <AlertTriangle size={9} /> Dormant
                    </span>
                  )}
                  {!s.isPublished && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                      Draft
                    </span>
                  )}
                  {s.studioTier && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${TIER_COLOR[s.studioTier] ?? "#888"}18`, color: TIER_COLOR[s.studioTier] ?? "#888" }}>
                      {s.studioTier}
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
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
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
