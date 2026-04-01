"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search, Headphones, Loader2, X, ChevronDown,
  Radio, ShoppingBag, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useAudioStore } from "@/store";
import { useExpandedCard, type TrackCardData } from "@/store/expandedCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import BeatLicenseModal from "@/components/beats/BeatLicenseModal";
import PublicNav from "@/components/layout/PublicNav";
import { HoverCardCover } from "@/components/tracks/HoverCardCover";
import ExpandedCardContent from "@/components/tracks/ExpandedCardContent";

// ── Types ──────────────────────────────────────────────────────────────────

type BeatItem = {
  id:         string;
  title:      string;
  coverArtUrl:string | null;
  fileUrl:    string;
  bpm:        number | null;
  musicalKey: string | null;
  price:      number | null;
  genre:      string | null;
  plays:      number;
  artist: {
    id:         string;
    name:       string;
    artistSlug: string | null;
    photo:      string | null;
  };
  beatLeaseSettings: {
    streamLeaseEnabled: boolean;
  } | null;
  _count: { beatLicenses: number; streamLeases: number };
};

type SortOption = "newest" | "popular" | "price-asc" | "price-desc" | "bpm-asc";

// ── Constants ──────────────────────────────────────────────────────────────

const GENRES = [
  "Hip-Hop", "R&B", "Pop", "Trap", "Lo-fi", "Drill",
  "Afrobeats", "Electronic", "Gospel", "Latin", "Jazz", "Rock",
];

const KEYS = [
  "C Major","C Minor","C# Major","C# Minor",
  "D Major","D Minor","D# Major","D# Minor",
  "E Major","E Minor",
  "F Major","F Minor","F# Major","F# Minor",
  "G Major","G Minor","G# Major","G# Minor",
  "A Major","A Minor","A# Major","A# Minor",
  "B Major","B Minor",
];

const BPM_PRESETS = [
  { label: "Slow (60–90)",        min: 60,  max: 90  },
  { label: "Mid (90–120)",        min: 90,  max: 120 },
  { label: "Fast (120–150)",      min: 120, max: 150 },
  { label: "High Energy (150+)",  min: 150, max: 9999 },
];

const PRICE_PRESETS = [
  { label: "Under $25",  min: 0,   max: 25  },
  { label: "$25–$50",    min: 25,  max: 50  },
  { label: "$50–$100",   min: 50,  max: 100 },
  { label: "$100+",      min: 100, max: 9999 },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest" },
  { value: "popular",    label: "Most Popular" },
  { value: "price-asc",  label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "bpm-asc",    label: "BPM: Low → High" },
];

// ── Beat Card ──────────────────────────────────────────────────────────────

function BeatCard({
  beat,
  isPlaying,
  onPlay,
  onLicense,
}: {
  beat:      BeatItem;
  isPlaying: boolean;
  onPlay:    (b: BeatItem) => void;
  onLicense: (b: BeatItem) => void;
}) {
  const totalUses     = beat._count.beatLicenses + beat._count.streamLeases;
  const streamEnabled = beat.beatLeaseSettings?.streamLeaseEnabled ?? false;
  const monthlyRate   = 1;
  const artistSlug    = beat.artist.artistSlug;

  const isMobile = useIsMobile();
  const { expandedId, open, close } = useExpandedCard();
  const isExpanded = expandedId === beat.id;
  const cardRef = useRef<HTMLDivElement>(null);

  const cardData: TrackCardData = {
    id:            beat.id,
    title:         beat.title,
    coverArtUrl:   beat.coverArtUrl,
    canvasVideoUrl: null,
    fileUrl:       beat.fileUrl,
    genre:         beat.genre,
    bpm:           beat.bpm,
    musicalKey:    beat.musicalKey,
    plays:         beat.plays,
    artist: {
      id:          beat.artist.id,
      name:        beat.artist.name,
      artistSlug:  beat.artist.artistSlug ?? null,
    },
  };

  function handleCardClick() {
    if (isMobile) { open(cardData); return; }
    isExpanded ? close() : open(cardData);
  }

  // Close on outside click (desktop)
  useEffect(() => {
    if (!isExpanded || isMobile) return;
    function onDocClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isExpanded, isMobile, close]);

  return (
    <motion.div
      ref={cardRef}
      layout
      className="rounded-2xl border overflow-hidden transition-[border-color] hover:border-[rgba(212,168,67,0.25)] cursor-pointer"
      style={{ backgroundColor: "#141414", borderColor: isExpanded ? "rgba(212,168,67,0.3)" : "#2a2a2a" }}
      whileHover={!isExpanded ? { y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={handleCardClick}
    >
      {/* Cover art */}
      <HoverCardCover
        id={beat.id}
        coverArtUrl={beat.coverArtUrl}
        isPlaying={isPlaying}
        onPlay={(e) => { e.stopPropagation(); onPlay(beat); }}
        className="w-full aspect-square overflow-hidden"
      >
        {!beat.coverArtUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Headphones size={32} style={{ color: "#2a2a2a" }} />
          </div>
        )}
        {streamEnabled && (
          <div className="absolute top-2 left-2 z-10">
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(212,168,67,0.9)", color: "#0A0A0A" }}
            >
              STREAM LEASE ${monthlyRate}/mo
            </span>
          </div>
        )}
      </HoverCardCover>

      {/* Card body */}
      <div className="p-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); onLicense(beat); }}
          className="w-full text-left font-bold text-white text-sm truncate hover:underline block"
        >
          {beat.title}
        </button>
        {artistSlug ? (
          <Link href={`/${artistSlug}`} className="text-[11px] block hover:underline truncate" style={{ color: "#888" }} onClick={e => e.stopPropagation()}>
            {beat.artist.name}
          </Link>
        ) : (
          <p className="text-[11px] truncate" style={{ color: "#888" }}>{beat.artist.name}</p>
        )}
        {artistSlug && (
          <Link href={`/${artistSlug}`} className="text-[9px] block hover:underline" style={{ color: "#D4A843" }} onClick={e => e.stopPropagation()}>
            More from {beat.artist.name} →
          </Link>
        )}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {beat.bpm && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>{beat.bpm} BPM</span>}
          {beat.musicalKey && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1e1e1e", color: "#777" }}>{beat.musicalKey}</span>}
          {beat.genre && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1e1e1e", color: "#777" }}>{beat.genre}</span>}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          {beat.price != null ? (
            <span className="text-sm font-bold" style={{ color: "#D4A843" }}>From ${beat.price.toFixed(0)}</span>
          ) : <span />}
          {totalUses > 0 && (
            <span className="text-[9px] flex items-center gap-1" style={{ color: "#555" }}>
              <TrendingUp size={9} />
              {totalUses} artist{totalUses !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onLicense(beat); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors"
            style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
          >
            <ShoppingBag size={10} /> License
          </button>
          {streamEnabled && (
            <button
              onClick={(e) => { e.stopPropagation(); onLicense(beat); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors"
              style={{ backgroundColor: "rgba(212,168,67,0.08)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
            >
              <Radio size={10} /> Stream Lease
            </button>
          )}
        </div>
      </div>

      {/* Desktop expanded view — inline in grid */}
      <AnimatePresence>
        {isExpanded && !isMobile && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <ExpandedCardContent data={cardData} onClose={close} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Dropdown helper ────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label:    string;
  value:    string;
  options:  { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value)?.label ?? label;
  const isActive = value !== "";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
        style={
          isActive
            ? { backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }
            : { backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }
        }
      >
        {selected}
        {isActive && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="ml-0.5 rounded-full hover:bg-white/10 p-0.5"
          >
            <X size={9} />
          </span>
        )}
        {!isActive && <ChevronDown size={10} />}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 rounded-xl border shadow-2xl z-50 overflow-auto"
          style={{ backgroundColor: "#141414", borderColor: "#2a2a2a", maxHeight: 240, minWidth: 160 }}
        >
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-white/5 transition-colors"
            style={{ color: value === "" ? "#D4A843" : "#aaa" }}
          >
            All
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-white/5 transition-colors"
              style={{ color: value === o.value ? "#D4A843" : "#aaa" }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────

export default function BeatsClient() {
  const { play, currentTrack } = useAudioStore();

  // Filters
  const [query,      setQuery]      = useState("");
  const [debounced,  setDebounced]  = useState("");
  const [genre,      setGenre]      = useState("");
  const [key,        setKey]        = useState("");
  const [bpmMin,     setBpmMin]     = useState(0);
  const [bpmMax,     setBpmMax]     = useState(9999);
  const [priceMin,   setPriceMin]   = useState(0);
  const [priceMax,   setPriceMax]   = useState(99999);
  const [leaseOnly,  setLeaseOnly]  = useState(false);
  const [sort,       setSort]       = useState<SortOption>("newest");
  const [sortOpen,   setSortOpen]   = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Data
  const [beats,       setBeats]       = useState<BeatItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal
  const [licenseBeat, setLicenseBeat] = useState<BeatItem | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [genre, key, bpmMin, bpmMax, priceMin, priceMax, leaseOnly, sort]);

  // Fetch
  const fetchBeats = useCallback(async (pg: number, append: boolean) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);

    const params = new URLSearchParams({
      q:        debounced,
      sort,
      page:     String(pg),
      ...(genre    ? { genre }                : {}),
      ...(key      ? { key }                  : {}),
      ...(bpmMin   ? { bpmMin: String(bpmMin) } : {}),
      ...(bpmMax < 9999 ? { bpmMax: String(bpmMax) } : {}),
      ...(priceMin  ? { priceMin: String(priceMin) }   : {}),
      ...(priceMax < 99999 ? { priceMax: String(priceMax) } : {}),
      ...(leaseOnly ? { leaseOnly: "1" }      : {}),
    });

    try {
      const res  = await fetch(`/api/beats?${params.toString()}`);
      const data = await res.json() as { beats: BeatItem[]; total: number; pages: number };
      setBeats((prev) => append ? [...prev, ...data.beats] : data.beats);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debounced, genre, key, bpmMin, bpmMax, priceMin, priceMax, leaseOnly, sort]);

  useEffect(() => { void fetchBeats(1, false); }, [fetchBeats]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void fetchBeats(next, true);
  }

  function handlePlay(beat: BeatItem) {
    play({
      id:       beat.id,
      title:    beat.title,
      artist:   beat.artist.name,
      src:      beat.fileUrl,
      coverArt: beat.coverArtUrl ?? undefined,
    });
  }

  // Sort dropdown outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Newest";

  // Active BPM preset label
  const activeBpmPreset = BPM_PRESETS.find((p) => p.min === bpmMin && p.max === bpmMax) ?? null;
  const activePricePreset = PRICE_PRESETS.find((p) => p.min === priceMin && p.max === priceMax) ?? null;

  function clearAllFilters() {
    setQuery(""); setGenre(""); setKey("");
    setBpmMin(0); setBpmMax(9999);
    setPriceMin(0); setPriceMax(99999);
    setLeaseOnly(false); setSort("newest");
  }

  const hasFilters = query || genre || key || bpmMin > 0 || bpmMax < 9999 || priceMin > 0 || priceMax < 99999 || leaseOnly;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>

      {/* Nav */}
      <PublicNav />

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>
          BEAT MARKETPLACE
        </p>
        <h1 className="text-3xl font-black text-white mb-6">Browse Beats</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#555" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beats by title, genre, or producer..."
            className="w-full rounded-xl border pl-11 pr-10 py-3.5 text-sm text-white outline-none"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: "#555" }} />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 pb-4">
          {/* Genre */}
          <FilterDropdown
            label="Genre"
            value={genre}
            options={GENRES.map((g) => ({ value: g, label: g }))}
            onChange={setGenre}
          />

          {/* BPM presets */}
          <FilterDropdown
            label="BPM"
            value={activeBpmPreset ? `${activeBpmPreset.min}-${activeBpmPreset.max}` : ""}
            options={BPM_PRESETS.map((p) => ({ value: `${p.min}-${p.max}`, label: p.label }))}
            onChange={(v) => {
              if (!v) { setBpmMin(0); setBpmMax(9999); return; }
              const preset = BPM_PRESETS.find((p) => `${p.min}-${p.max}` === v);
              if (preset) { setBpmMin(preset.min); setBpmMax(preset.max); }
            }}
          />

          {/* Key */}
          <FilterDropdown
            label="Key"
            value={key}
            options={KEYS.map((k) => ({ value: k, label: k }))}
            onChange={setKey}
          />

          {/* Price */}
          <FilterDropdown
            label="Price"
            value={activePricePreset ? `${activePricePreset.min}-${activePricePreset.max}` : ""}
            options={PRICE_PRESETS.map((p) => ({ value: `${p.min}-${p.max}`, label: p.label }))}
            onChange={(v) => {
              if (!v) { setPriceMin(0); setPriceMax(99999); return; }
              const preset = PRICE_PRESETS.find((p) => `${p.min}-${p.max}` === v);
              if (preset) { setPriceMin(preset.min); setPriceMax(preset.max); }
            }}
          />

          {/* Stream Lease toggle */}
          <button
            onClick={() => setLeaseOnly((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
            style={
              leaseOnly
                ? { backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }
                : { backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }
            }
          >
            <Radio size={10} />
            Stream Lease available
          </button>

          {/* Divider */}
          <div className="flex-1" />

          {/* Sort */}
          <div className="relative shrink-0" ref={sortRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }}
            >
              {currentSortLabel} <ChevronDown size={10} />
            </button>
            {sortOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden min-w-[160px]"
                style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
              >
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSort(o.value); setSortOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-white/5 transition-colors"
                    style={{ color: sort === o.value ? "#D4A843" : "#aaa" }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear all */}
          {hasFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.2)" }}
            >
              <X size={10} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-24">
        {!loading && (
          <p className="text-[11px] mb-5" style={{ color: "#555" }}>
            {total === 0 ? "No beats found" : `${total} beat${total !== 1 ? "s" : ""}`}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
          </div>
        ) : beats.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center space-y-3"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          >
            <Headphones size={40} className="mx-auto" style={{ color: "#333" }} />
            <p className="font-semibold text-white">No beats found.</p>
            <p className="text-sm" style={{ color: "#666" }}>
              Try a different search or{" "}
              <button onClick={clearAllFilters} className="underline font-semibold" style={{ color: "#D4A843" }}>
                clear all filters
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <LayoutGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
                {beats.map((b) => (
                  <BeatCard
                    key={b.id}
                    beat={b}
                    isPlaying={currentTrack?.id === b.id}
                    onPlay={handlePlay}
                    onLicense={setLicenseBeat}
                  />
                ))}
              </div>
            </LayoutGroup>

            {page < pages && (
              <div className="mt-10 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? "Loading..." : "Load More Beats"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* License Modal */}
      {licenseBeat && (
        <BeatLicenseModal
          track={{
            id:                 licenseBeat.id,
            title:              licenseBeat.title,
            price:              licenseBeat.price,
            coverArtUrl:        licenseBeat.coverArtUrl,
            streamLeaseEnabled: licenseBeat.beatLeaseSettings?.streamLeaseEnabled ?? false,
            artist: {
              name:       licenseBeat.artist.name,
              artistName: null,
              artistSlug: licenseBeat.artist.artistSlug ?? null,
            },
          }}
          onClose={() => setLicenseBeat(null)}
        />
      )}
    </div>
  );
}
