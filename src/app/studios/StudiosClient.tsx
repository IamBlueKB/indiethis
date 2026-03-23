"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Building2, MapPin, Loader2, X, ChevronDown } from "lucide-react";
import PublicNav from "@/components/layout/PublicNav";

// ── Types ──────────────────────────────────────────────────────────────────

type StudioItem = {
  id:        string;
  name:      string;
  slug:      string;
  city:      string | null;
  state:     string | null;
  tagline:   string | null;
  services:  string[];
  heroImage: string | null;
  logoUrl:   string | null;
  photos:    string[];
};

type SortOption = "newest" | "az" | "most-services";

// ── Constants ──────────────────────────────────────────────────────────────

const SERVICE_FILTERS = [
  "All Services",
  "Recording",
  "Mixing",
  "Mastering",
  "Vocal Production",
  "Podcast",
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",        label: "Newest" },
  { value: "az",            label: "A–Z" },
  { value: "most-services", label: "Most Services" },
];

// ── Studio Card ────────────────────────────────────────────────────────────

function StudioCard({ studio }: { studio: StudioItem }) {
  const photo = studio.heroImage ?? studio.logoUrl ?? studio.photos?.[0] ?? null;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all hover:border-[rgba(212,168,67,0.3)]"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      {/* Hero image */}
      <Link href={`/${studio.slug}`} className="block">
        <div
          className="w-full overflow-hidden group"
          style={{ height: 200, backgroundColor: "#1a1a1a" }}
        >
          {photo ? (
            <img
              src={photo}
              alt={studio.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 size={40} style={{ color: "#2a2a2a" }} />
            </div>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="p-4 space-y-2">
        {/* Name */}
        <Link
          href={`/${studio.slug}`}
          className="block font-bold text-white text-base hover:underline truncate"
        >
          {studio.name}
        </Link>

        {/* Location */}
        {(studio.city || studio.state) && (
          <div className="flex items-center gap-1" style={{ color: "#888" }}>
            <MapPin size={11} />
            <span className="text-[12px]">
              {[studio.city, studio.state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {/* Tagline */}
        {studio.tagline && (
          <p className="text-[12px] truncate" style={{ color: "#666" }}>
            {studio.tagline}
          </p>
        )}

        {/* Services */}
        {studio.services.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {studio.services.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.15)" }}
              >
                {s}
              </span>
            ))}
            {studio.services.length > 4 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1e1e1e", color: "#666" }}>
                +{studio.services.length - 4}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="pt-2">
          <Link
            href={`/${studio.slug}`}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
          >
            View Studio →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────

export default function StudiosClient() {
  const [query,          setQuery]         = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeService,  setActiveService]  = useState("All Services");
  const [sort,           setSort]           = useState<SortOption>("newest");
  const [sortOpen,       setSortOpen]       = useState(false);
  const [studios,        setStudios]        = useState<StudioItem[]>([]);
  const [total,          setTotal]          = useState(0);
  const [pages,          setPages]          = useState(1);
  const [page,           setPage]           = useState(1);
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortRef     = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeService, sort]);

  // Fetch studios
  const fetchStudios = useCallback(async (pg: number, append: boolean) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);

    const serviceParam = activeService !== "All Services" ? `&service=${encodeURIComponent(activeService)}` : "";
    const url = `/api/studios?q=${encodeURIComponent(debouncedQuery)}&sort=${sort}&page=${pg}${serviceParam}`;

    try {
      const res  = await fetch(url);
      const data = await res.json() as { studios: StudioItem[]; total: number; pages: number };
      setStudios((prev) => append ? [...prev, ...data.studios] : data.studios);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedQuery, activeService, sort]);

  useEffect(() => { void fetchStudios(1, false); }, [fetchStudios]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void fetchStudios(next, true);
  }

  // Close sort dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Newest";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>

      {/* Nav */}
      <PublicNav />

      {/* Page header */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-10 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>
          STUDIO DIRECTORY
        </p>
        <h1 className="text-3xl font-black text-white mb-6">Find a Studio</h1>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#555" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or service..."
            className="w-full rounded-xl border pl-11 pr-10 py-3.5 text-sm text-white outline-none"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X size={14} style={{ color: "#555" }} />
            </button>
          )}
        </div>

        {/* Filter pills + sort */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {SERVICE_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveService(s)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
                style={
                  activeService === s
                    ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                    : { backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }
                }
              >
                {s}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {(query || activeService !== "All Services") && (
            <button
              onClick={() => { setQuery(""); setActiveService("All Services"); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.2)" }}
            >
              <X size={10} /> Clear filters
            </button>
          )}

          {/* Sort dropdown */}
          <div className="relative shrink-0" ref={sortRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }}
            >
              {currentSortLabel}
              <ChevronDown size={11} />
            </button>
            {sortOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden min-w-[130px]"
                style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
              >
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSort(o.value); setSortOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-white/5"
                    style={{ color: sort === o.value ? "#D4A843" : "#aaa" }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-16">

        {/* Result count */}
        {!loading && (
          <p className="text-[11px] mb-5" style={{ color: "#555" }}>
            {total === 0
              ? "No studios found"
              : `${total} studio${total !== 1 ? "s" : ""}`}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
          </div>
        ) : studios.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center space-y-4"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          >
            <Building2 size={40} className="mx-auto" style={{ color: "#333" }} />
            {total === 0 && !query && activeService === "All Services" ? (
              <>
                <p className="font-semibold text-white">Studios are coming soon.</p>
                <p className="text-sm" style={{ color: "#666" }}>
                  Are you a studio owner?{" "}
                  <Link href="/signup" className="underline font-semibold" style={{ color: "#D4A843" }}>
                    Join IndieThis →
                  </Link>
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-white">No studios found.</p>
                <p className="text-sm" style={{ color: "#666" }}>
                  Try a different search or{" "}
                  <button
                    onClick={() => { setQuery(""); setActiveService("All Services"); }}
                    className="underline font-semibold"
                    style={{ color: "#D4A843" }}
                  >
                    browse all studios
                  </button>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {studios.map((s) => (
                <StudioCard key={s.id} studio={s} />
              ))}
            </div>

            {/* Load more */}
            {page < pages && (
              <div className="mt-10 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
                >
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                  {loadingMore ? "Loading..." : "Load More Studios"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
