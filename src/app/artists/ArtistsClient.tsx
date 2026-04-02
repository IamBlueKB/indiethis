"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search, Play, Music2, Users, Headphones,
  Loader2, X, ChevronDown, Radio, TrendingUp,
} from "lucide-react";
import { useAudioStore } from "@/store";
import PublicNav from "@/components/layout/PublicNav";

// ── Types ──────────────────────────────────────────────────────────────────

type TopTrack = {
  id:          string;
  title:       string;
  fileUrl:     string;
  coverArtUrl: string | null;
  plays:       number;
  genre:       string | null;
};

type TopBeat = {
  id:          string;
  title:       string;
  fileUrl:     string;
  coverArtUrl: string | null;
  plays:       number;
  price:       number | null;
  beatLeaseSettings: { streamLeaseEnabled: boolean } | null;
};

type ResultItem = {
  id:         string;
  name:       string;
  artistName: string | null;
  photo:      string | null;
  city:       string | null;
  genres:     string[];
  artistSlug: string | null;
  type:       "artist" | "producer" | "both";
  _count:     { fanContacts: number };
  // artist fields
  topTrack:   TopTrack | null;
  // producer fields
  topBeat:       TopBeat | null;
  beatCount:     number;
  minPrice:      number | null;
  hasStreamLease:boolean;
  producerProfile: { displayName: string | null; defaultLeasePrice: number | null } | null;
};

type TabType = "all" | "artist" | "producer";
type SortType = "trending" | "newest" | "az" | "mostfans";

// ── Constants ──────────────────────────────────────────────────────────────

const GENRES = [
  "Hip-Hop", "R&B", "Pop", "Rock", "Gospel",
  "Electronic", "Trap", "Afrobeats", "Latin", "Jazz",
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "trending",  label: "Trending" },
  { value: "newest",    label: "Newest" },
  { value: "az",        label: "A–Z" },
  { value: "mostfans",  label: "Most Fans" },
];

// ── Artist Card ────────────────────────────────────────────────────────────

function ArtistCard({ item, onPlay }: { item: ResultItem; onPlay: (track: TopTrack) => void }) {
  const displayName = item.artistName ?? item.name;
  const slug        = item.artistSlug;
  const totalPlays  = item.topTrack?.plays ?? 0;
  const fanCount    = item._count.fanContacts;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3 transition-all hover:border-[rgba(212,168,67,0.2)]"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {slug ? (
          <Link href={`/${slug}`} className="shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
              {item.photo
                ? <img src={item.photo} alt={displayName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: "#D4A843" }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
              }
            </div>
          </Link>
        ) : (
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1e1e1e" }}>
            {item.photo
              ? <img src={item.photo} alt={displayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: "#D4A843" }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          {slug ? (
            <Link href={`/${slug}`} className="font-bold text-white block truncate hover:underline">
              {displayName}
            </Link>
          ) : (
            <p className="font-bold text-white truncate">{displayName}</p>
          )}
          <p className="text-[11px] truncate mt-0.5" style={{ color: "#666" }}>
            {[item.genres[0], item.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        {(item.type === "artist" || item.type === "both") && (
          <span className="text-[9px] px-2 py-1 rounded-full font-bold shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
            ARTIST
          </span>
        )}
      </div>

      {/* Top track */}
      {item.topTrack && (
        <button
          onClick={() => onPlay(item.topTrack!)}
          className="w-full flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-white/5 group/track"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 relative" style={{ backgroundColor: "#1e1e1e" }}>
            {item.topTrack.coverArtUrl
              ? <img src={item.topTrack.coverArtUrl} alt="" className="w-full h-full object-cover" />
              : <Music2 size={13} className="absolute inset-0 m-auto" style={{ color: "#444" }} />
            }
          </div>
          <p className="flex-1 text-xs text-left text-white truncate">{item.topTrack.title}</p>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-70 group-hover/track:opacity-100"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
          >
            <Play size={10} fill="#D4A843" style={{ color: "#D4A843", marginLeft: 1 }} />
          </div>
        </button>
      )}

      {/* Social proof + More from */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {fanCount > 0 && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: "#555" }}>
              <Users size={9} /> {fanCount >= 1000 ? `${(fanCount / 1000).toFixed(1)}K` : fanCount} fans
            </span>
          )}
          {totalPlays > 0 && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: "#555" }}>
              <TrendingUp size={9} /> {totalPlays >= 1000 ? `${(totalPlays / 1000).toFixed(1)}K` : totalPlays} plays
            </span>
          )}
        </div>
        {slug && (
          <Link href={`/${slug}`} className="text-[9px] hover:underline" style={{ color: "#D4A843" }}>
            More from {displayName} →
          </Link>
        )}
      </div>

      {/* CTA */}
      {slug && (
        <Link
          href={`/${slug}`}
          className="block text-center py-2 rounded-xl text-[11px] font-bold transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#aaa" }}
        >
          Listen
        </Link>
      )}
    </div>
  );
}

// ── Producer Card ──────────────────────────────────────────────────────────

function ProducerCard({ item, onPlay }: { item: ResultItem; onPlay: (beat: TopBeat) => void }) {
  const displayName = item.producerProfile?.displayName ?? item.artistName ?? item.name;
  const slug        = item.artistSlug;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3 transition-all hover:border-[rgba(212,168,67,0.2)]"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {slug ? (
          <Link href={`/${slug}`} className="shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
              {item.photo
                ? <img src={item.photo} alt={displayName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: "#D4A843" }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
              }
            </div>
          </Link>
        ) : (
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1e1e1e" }}>
            {item.photo
              ? <img src={item.photo} alt={displayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: "#D4A843" }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          {slug ? (
            <Link href={`/${slug}`} className="font-bold text-white block truncate hover:underline">
              {displayName}
            </Link>
          ) : (
            <p className="font-bold text-white truncate">{displayName}</p>
          )}
          <p className="text-[11px] truncate mt-0.5" style={{ color: "#666" }}>
            {[item.genres[0], item.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full font-bold shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A" }}>
          PRODUCER
        </span>
      </div>

      {/* Top beat */}
      {item.topBeat && (
        <button
          onClick={() => onPlay(item.topBeat!)}
          className="w-full flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-white/5 group/beat"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 relative" style={{ backgroundColor: "#1e1e1e" }}>
            {item.topBeat.coverArtUrl
              ? <img src={item.topBeat.coverArtUrl} alt="" className="w-full h-full object-cover" />
              : <Headphones size={13} className="absolute inset-0 m-auto" style={{ color: "#444" }} />
            }
          </div>
          <p className="flex-1 text-xs text-left text-white truncate">{item.topBeat.title}</p>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-70 group-hover/beat:opacity-100"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
          >
            <Play size={10} fill="#D4A843" style={{ color: "#D4A843", marginLeft: 1 }} />
          </div>
        </button>
      )}

      {/* Beat stats */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-3">
          {item.beatCount > 0 && (
            <span className="text-[10px]" style={{ color: "#555" }}>
              {item.beatCount} beat{item.beatCount !== 1 ? "s" : ""}
            </span>
          )}
          {item.minPrice != null && (
            <span className="text-[10px] font-bold" style={{ color: "#D4A843" }}>
              From ${item.minPrice.toFixed(0)}
            </span>
          )}
          {item.hasStreamLease && (
            <span className="text-[9px] font-bold flex items-center gap-1" style={{ color: "#D4A843" }}>
              <Radio size={8} /> Stream Lease
            </span>
          )}
        </div>
        {slug && (
          <Link href={`/${slug}`} className="text-[9px] hover:underline" style={{ color: "#D4A843" }}>
            More from {displayName} →
          </Link>
        )}
      </div>

      {/* CTA */}
      {slug && (
        <Link
          href={`/${slug}`}
          className="block text-center py-2 rounded-xl text-[11px] font-bold transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#aaa" }}
        >
          View Beats
        </Link>
      )}
    </div>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────

export default function ArtistsClient() {
  const { play } = useAudioStore();

  // Filters
  const [query,     setQuery]     = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab,       setTab]       = useState<TabType>("all");
  const [genre,     setGenre]     = useState("");
  const [city,      setCity]      = useState("");
  const [sort,      setSort]      = useState<SortType>("trending");
  const [sortOpen,  setSortOpen]  = useState(false);
  const sortRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data
  const [results,     setResults]     = useState<ResultItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [tab, genre, city, sort]);

  // Fetch
  const fetchResults = useCallback(async (pg: number, append: boolean) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    const params = new URLSearchParams({
      q:    debounced,
      type: tab,
      sort,
      page: String(pg),
      ...(genre ? { genre } : {}),
      ...(city  ? { city  } : {}),
    });
    try {
      const res  = await fetch(`/api/artists?${params}`);
      const data = await res.json() as {
        results?:   ResultItem[];
        artists?:   ResultItem[];
        producers?: ResultItem[];
        total:      number;
        pages:      number;
      };
      const items = data.results ?? data.artists ?? data.producers ?? [];
      setResults((prev) => append ? [...prev, ...items] : items);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debounced, tab, genre, city, sort]);

  useEffect(() => { void fetchResults(1, false); }, [fetchResults]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void fetchResults(next, true);
  }

  function handlePlayTrack(track: TopTrack) {
    const s = useAudioStore.getState();
    if (s.currentTrack?.id === track.id && s.isPlaying) { s.pause(); return; }
    play({ id: track.id, title: track.title, artist: "", src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined });
  }

  function handlePlayBeat(beat: TopBeat) {
    const s = useAudioStore.getState();
    if (s.currentTrack?.id === beat.id && s.isPlaying) { s.pause(); return; }
    play({ id: beat.id, title: beat.title, artist: "", src: beat.fileUrl, coverArt: beat.coverArtUrl ?? undefined });
  }

  // Sort outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Trending";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>

      {/* Nav */}
      <PublicNav />

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>
          ARTIST DIRECTORY
        </p>
        <h1 className="text-3xl font-black text-white mb-6">Discover Artists</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#555" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, genre, or city..."
            className="w-full rounded-xl border pl-11 pr-10 py-3.5 text-sm text-white outline-none"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: "#555" }} />
            </button>
          )}
        </div>

        {/* Toggle tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl w-fit" style={{ backgroundColor: "#1a1a1a" }}>
          {(["all", "artist", "producer"] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
              style={
                tab === t
                  ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                  : { color: "#888" }
              }
            >
              {t === "all" ? "All" : t === "artist" ? "Artists" : "Producers"}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 pb-4">
          {/* Genre pills */}
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(genre === g ? "" : g)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={
                genre === g
                  ? { backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }
                  : { backgroundColor: "#1a1a1a", color: "#666", border: "1px solid #222" }
              }
            >
              {g}
            </button>
          ))}

          {/* City input */}
          <div className="relative">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Filter by city..."
              className="rounded-full border pl-3 pr-8 py-1.5 text-xs text-white outline-none w-36"
              style={{ backgroundColor: city ? "rgba(212,168,67,0.08)" : "#1a1a1a", borderColor: city ? "rgba(212,168,67,0.3)" : "#2a2a2a", color: city ? "#D4A843" : "#aaa" }}
            />
            {city && (
              <button onClick={() => setCity("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X size={10} style={{ color: "#D4A843" }} />
              </button>
            )}
          </div>

          {/* Clear filters */}
          {(query || genre || city) && (
            <button
              onClick={() => { setQuery(""); setGenre(""); setCity(""); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.2)" }}
            >
              <X size={10} /> Clear filters
            </button>
          )}

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
                className="absolute right-0 top-full mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden min-w-[130px]"
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
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-24">
        {!loading && (
          <p className="text-[11px] mb-5" style={{ color: "#555" }}>
            {total === 0
              ? "No results found"
              : `${total} ${tab === "producer" ? "producer" : "artist"}${total !== 1 ? "s" : ""}`}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
          </div>
        ) : results.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center space-y-3"
            style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}
          >
            <Users size={40} className="mx-auto" style={{ color: "#333" }} />
            <p className="font-semibold text-white">No {tab === "producer" ? "producers" : "artists"} found.</p>
            <p className="text-sm" style={{ color: "#666" }}>
              Try a different search or{" "}
              <button
                onClick={() => { setQuery(""); setGenre(""); setCity(""); }}
                className="underline font-semibold"
                style={{ color: "#D4A843" }}
              >
                clear filters
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((item) =>
                item.type === "producer"
                  ? <ProducerCard key={item.id} item={item} onPlay={handlePlayBeat} />
                  : <ArtistCard   key={item.id} item={item} onPlay={handlePlayTrack} />
              )}
            </div>

            {page < pages && (
              <div className="mt-10 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
