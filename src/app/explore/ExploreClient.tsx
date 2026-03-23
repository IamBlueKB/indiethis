"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAudioStore } from "@/store";
import Footer from "@/components/layout/Footer";
import {
  Search, Play, ChevronLeft, ChevronRight, Music2, Users, Building2,
  Headphones, Mic2, Wand2, TrendingUp, Loader2, Zap, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type TrackItem = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  fileUrl: string;
  genre: string | null;
  plays: number;
  createdAt?: string;
  artist: { id: string; name: string; photo?: string | null };
};

type BeatItem = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  fileUrl: string;
  bpm: number | null;
  musicalKey: string | null;
  price: number | null;
  genre: string | null;
  artist: { id: string; name: string };
  beatLeaseSettings: { streamLeaseEnabled: boolean; maxStreamLeases: number | null } | null;
  _count: { beatLicenses: number; streamLeases: number };
};

type ArtistItem = {
  id: string;
  name: string;
  photo: string | null;
  topTrack: TrackItem | null;
  genre: string | null;
  score: number;
};

type StudioItem = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  tagline: string | null;
  logoUrl: string | null;
  heroImage: string | null;
  photos: string[];
};

type FeaturedCard = {
  id: string;
  type: string;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  gradient: string | null;
  ctaText: string;
  ctaUrl: string;
  linkedArtist: { id: string; name: string; photo: string | null } | null;
};

type SearchResults = {
  artists: { id: string; name: string; photo: string | null }[];
  tracks: { id: string; title: string; coverArtUrl: string | null; fileUrl: string; genre: string | null; artist: { id: string; name: string } }[];
  studios: { id: string; name: string; slug: string; city: string | null; state: string | null; logoUrl: string | null }[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const GENRES = ["Hip-Hop", "R&B", "Pop", "Rock", "Gospel", "Spoken Word", "Electronic", "Country", "Afrobeats", "Latin", "Jazz", "Alternative"];

const GENRE_COLORS: Record<string, string> = {
  "Hip-Hop": "#D4A843",
  "R&B": "#c084fc",
  "Pop": "#f472b6",
  "Rock": "#f97316",
  "Gospel": "#34d399",
  "Spoken Word": "#60a5fa",
  "Electronic": "#22d3ee",
  "Country": "#fbbf24",
  "Afrobeats": "#4ade80",
  "Latin": "#fb923c",
  "Jazz": "#a78bfa",
  "Alternative": "#94a3b8",
};

const FEATURED_FALLBACKS: FeaturedCard[] = [
  {
    id: "f1",
    type: "AI_SHOWCASE",
    headline: "Make Your Vision Real",
    description: "AI cover art, lyric videos, mastering, and more. Create professional content in minutes.",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #1a0a2e 0%, #0a0a1a 50%, #1a1a0a 100%)",
    ctaText: "Explore AI Tools",
    ctaUrl: "/dashboard/ai/video",
    linkedArtist: null,
  },
  {
    id: "f2",
    type: "ANNOUNCEMENT",
    headline: "Release Planner is Here",
    description: "Coordinate your entire release rollout with auto-generated timelines and integrated tasks.",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #0a1a0a 0%, #0a0a0a 50%, #1a0a0a 100%)",
    ctaText: "Plan Your Release",
    ctaUrl: "/dashboard/release-planner",
    linkedArtist: null,
  },
  {
    id: "f3",
    type: "BEAT_PACK",
    headline: "Beat Marketplace",
    description: "License professional beats or stream lease them for your next project.",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #0a0a1a 0%, #1a0a0a 50%, #0a1a1a 100%)",
    ctaText: "Browse Beats",
    ctaUrl: "/dashboard/marketplace",
    linkedArtist: null,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p className={`text-[10px] font-black uppercase tracking-[0.15em] mb-1 ${className}`} style={{ color: "#D4A843" }}>
      {label}
    </p>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-4">
      <SectionLabel label={label} />
      <h2 className="text-xl font-bold text-white">{title}</h2>
    </div>
  );
}

// ── Track Card ─────────────────────────────────────────────────────────────

function TrackCard({ track, onPlay, isNew }: { track: TrackItem; onPlay: (t: TrackItem) => void; isNew?: boolean }) {
  return (
    <div
      className="shrink-0 w-40 group cursor-pointer"
      onClick={() => onPlay(track)}
    >
      <div className="relative w-40 h-40 rounded-xl overflow-hidden mb-2.5" style={{ backgroundColor: "#1a1a1a" }}>
        {track.coverArtUrl
          ? <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 size={28} style={{ color: "#444" }} /></div>
        }
        {isNew && (
          <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            NEW
          </span>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
            <Play size={16} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-white truncate">{track.title}</p>
      <p className="text-[11px] truncate mt-0.5" style={{ color: "#888" }}>{track.artist.name}</p>
      <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{track.plays.toLocaleString()} plays</p>
    </div>
  );
}

// ── Featured Carousel ──────────────────────────────────────────────────────

function FeaturedCarousel({ cards }: { cards: FeaturedCard[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const all = cards.length > 0 ? cards : FEATURED_FALLBACKS;

  const next = useCallback(() => setIdx((i) => (i + 1) % all.length), [all.length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + all.length) % all.length), [all.length]);

  useEffect(() => {
    timerRef.current = setTimeout(next, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, next]);

  const card = all[idx];

  return (
    <div className="relative h-72 md:h-80 rounded-2xl overflow-hidden">
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: card.imageUrl ? `url(${card.imageUrl}) center/cover no-repeat` : (card.gradient ?? "#1a1a1a"),
        }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)" }} />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-14 pb-6 pt-4">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-70" style={{ color: "#D4A843" }}>
          {card.type.replace(/_/g, " ")}
        </p>
        <h3 className="text-2xl font-black text-white mb-1.5 leading-tight">{card.headline}</h3>
        {card.description && (
          <p className="text-sm text-white/70 mb-4 line-clamp-2 max-w-md">{card.description}</p>
        )}
        <Link
          href={card.ctaUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          onClick={(e) => e.stopPropagation()}
        >
          {card.ctaText} →
        </Link>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      >
        <ChevronLeft size={16} className="text-white" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      >
        <ChevronRight size={16} className="text-white" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 right-6 flex items-center gap-1.5">
        {all.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              backgroundColor: i === idx ? "#D4A843" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Track Scroll ─────────────────────────────────────────────────

function TrackScroll({ tracks, onPlay, isNew }: { tracks: TrackItem[]; onPlay: (t: TrackItem) => void; isNew?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });

  if (tracks.length === 0) return (
    <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
      <p className="text-sm" style={{ color: "#555" }}>No tracks yet — be the first to drop something here.</p>
    </div>
  );

  return (
    <div className="relative group/scroll">
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity"
        style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}
      >
        <ChevronLeft size={14} className="text-white" />
      </button>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
        {tracks.map((t) => (
          <div key={t.id} style={{ scrollSnapAlign: "start" }}>
            <TrackCard track={t} onPlay={onPlay} isNew={isNew} />
          </div>
        ))}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity"
        style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}
      >
        <ChevronRight size={14} className="text-white" />
      </button>
    </div>
  );
}

// ── Beat Card ──────────────────────────────────────────────────────────────

function BeatCard({ beat, onPlay }: { beat: BeatItem; onPlay: (b: BeatItem) => void }) {
  const totalUses = beat._count.beatLicenses + beat._count.streamLeases;
  return (
    <div
      className="rounded-xl border p-3 cursor-pointer group transition-all hover:border-accent/40"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
      onClick={() => onPlay(beat)}
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5" style={{ backgroundColor: "#1a1a1a" }}>
        {beat.coverArtUrl
          ? <img src={beat.coverArtUrl} alt={beat.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Headphones size={24} style={{ color: "#444" }} /></div>
        }
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
            <Play size={14} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
          </div>
        </div>
        {beat.beatLeaseSettings?.streamLeaseEnabled && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.15)", color: "#34C759", border: "1px solid rgba(52,199,89,0.3)" }}>
            LEASE
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-white truncate">{beat.title}</p>
      <p className="text-[10px] truncate mb-1.5" style={{ color: "#888" }}>{beat.artist.name}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {beat.bpm && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>{beat.bpm}</span>}
          {beat.musicalKey && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: "#1e1e1e", color: "#888" }}>{beat.musicalKey}</span>}
        </div>
        {beat.price != null && <span className="text-xs font-bold" style={{ color: "#D4A843" }}>${beat.price.toFixed(0)}</span>}
      </div>
      {totalUses > 0 && (
        <p className="text-[9px] mt-1" style={{ color: "#555" }}>{totalUses} artist{totalUses !== 1 ? "s" : ""} on this beat</p>
      )}
    </div>
  );
}

// ── Studio Card ────────────────────────────────────────────────────────────

function StudioCard({ studio }: { studio: StudioItem }) {
  const photo = studio.heroImage ?? studio.logoUrl ?? (studio.photos?.[0]);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
      <div className="w-full h-28 overflow-hidden" style={{ backgroundColor: "#1a1a1a" }}>
        {photo
          ? <img src={photo} alt={studio.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Building2 size={28} style={{ color: "#333" }} /></div>
        }
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-white truncate">{studio.name}</p>
        {(studio.city || studio.state) && (
          <p className="text-[11px] mt-0.5" style={{ color: "#888" }}>{[studio.city, studio.state].filter(Boolean).join(", ")}</p>
        )}
        {studio.tagline && <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "#666" }}>{studio.tagline}</p>}
        <Link
          href={`/${studio.slug}`}
          className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors"
          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
        >
          <Mic2 size={10} /> Book a Session
        </Link>
      </div>
    </div>
  );
}

// ── Artist Card ────────────────────────────────────────────────────────────

function ArtistCard({ artist, onPlay }: { artist: ArtistItem; onPlay: (t: TrackItem) => void }) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
          {artist.photo
            ? <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Users size={18} style={{ color: "#444" }} /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{artist.name}</p>
          {artist.genre && <p className="text-[11px]" style={{ color: "#888" }}>{artist.genre}</p>}
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
          <TrendingUp size={9} className="inline mr-1" />Rising
        </span>
      </div>
      {artist.topTrack && (
        <button
          onClick={() => onPlay(artist.topTrack!)}
          className="w-full flex items-center gap-2.5 rounded-lg p-2 transition-all group/track hover:bg-white/5"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "#1e1e1e" }}>
            {artist.topTrack.coverArtUrl
              ? <img src={artist.topTrack.coverArtUrl} alt="" className="w-full h-full object-cover" />
              : <Music2 size={14} className="m-auto" style={{ color: "#444" }} />
            }
          </div>
          <p className="flex-1 text-xs text-left text-white truncate">{artist.topTrack.title}</p>
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Play size={9} fill="#D4A843" style={{ color: "#D4A843" }} />
          </div>
        </button>
      )}
    </div>
  );
}

// ── Search Bar + Dropdown ──────────────────────────────────────────────────

function SearchBar({ onFilter }: { onFilter: (tab: FilterTab) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) { setResults(null); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/explore/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } finally { setSearching(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const hasResults = results && (results.artists.length > 0 || results.tracks.length > 0 || results.studios.length > 0);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search artists, tracks, studios…"
          className="w-full rounded-xl border pl-10 pr-10 py-3 text-sm bg-transparent text-white outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
          style={{ borderColor: "#2a2a2a", backgroundColor: "#111" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults(null); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} style={{ color: "#666" }} />
          </button>
        )}
        {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "#D4A843" }} />}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden"
          style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {!hasResults ? (
            <p className="px-4 py-3 text-sm" style={{ color: "#666" }}>No results for "{query}"</p>
          ) : (
            <div className="p-2 space-y-1">
              {results!.artists.map((a) => (
                <Link key={a.id} href={`/artists/${a.id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(false)}>
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1e1e1e" }}>
                    {a.photo ? <img src={a.photo} className="w-full h-full object-cover" /> : <Users size={13} className="m-auto text-gray-600" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{a.name}</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>Artist</p>
                  </div>
                </Link>
              ))}
              {results!.tracks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => { setOpen(false); onFilter("music"); }}>
                  <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "#1e1e1e" }}>
                    {t.coverArtUrl ? <img src={t.coverArtUrl} className="w-full h-full object-cover" /> : <Music2 size={13} className="m-auto text-gray-600" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t.title}</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>Track · {t.artist.name}</p>
                  </div>
                </div>
              ))}
              {results!.studios.map((s) => (
                <Link key={s.id} href={`/${s.slug}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => setOpen(false)}>
                  <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: "#1e1e1e" }}>
                    {s.logoUrl ? <img src={s.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={13} className="m-auto text-gray-600" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{s.name}</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>Studio · {[s.city, s.state].filter(Boolean).join(", ")}</p>
                  </div>
                </Link>
              ))}
              <div className="pt-1 border-t" style={{ borderColor: "#2a2a2a" }}>
                <p className="px-3 py-2 text-[11px] text-center" style={{ color: "#555" }}>
                  Showing top results · Press Enter to search all
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter Pills ───────────────────────────────────────────────────────────

type FilterTab = "all" | "artists" | "music" | "beats" | "studios" | "ai";

type FilterTabDef = { key: FilterTab; label: string; icon?: React.ElementType };

const FILTER_TABS: FilterTabDef[] = [
  { key: "all",     label: "All" },
  { key: "artists", label: "Artists", icon: Users },
  { key: "music",   label: "Music",   icon: Music2 },
  { key: "beats",   label: "Beats",   icon: Headphones },
  { key: "studios", label: "Studios", icon: Building2 },
  { key: "ai",      label: "AI Tools", icon: Wand2 },
];

// ── AI Tools Showcase ──────────────────────────────────────────────────────

function AIShowcase({ loggedIn }: { loggedIn: boolean }) {
  const cta = (path: string) => loggedIn ? path : `/signup?next=${path}`;

  const items = [
    {
      icon: <Wand2 size={20} style={{ color: "#D4A843" }} />,
      title: "AI Cover Art",
      desc: "Generate stunning cover artwork from a simple text prompt. Professional quality in seconds.",
      cta: "Create yours",
      price: "$4.99",
      link: cta("/dashboard/ai/cover-art"),
      gradient: "linear-gradient(135deg, #1a0a2e, #0a0a1a)",
    },
    {
      icon: <Play size={20} style={{ color: "#D4A843" }} />,
      title: "AI Music Video",
      desc: "Turn your track into a professional AI-generated music video. Share-worthy in minutes.",
      cta: "Create yours",
      price: "from $19",
      link: cta("/dashboard/ai/video"),
      gradient: "linear-gradient(135deg, #0a1a0a, #0a0a0a)",
    },
    {
      icon: <Zap size={20} style={{ color: "#D4A843" }} />,
      title: "AI Mastering",
      desc: "Pro-quality mastering powered by AI. Upload your mix, download a release-ready master.",
      cta: "Master your track",
      price: "$9.99",
      link: cta("/dashboard/ai/mastering"),
      gradient: "linear-gradient(135deg, #1a0a00, #0a0a0a)",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border p-5 space-y-3"
          style={{ background: item.gradient, borderColor: "#2a2a2a" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
            {item.icon}
          </div>
          <div>
            <p className="font-bold text-white">{item.title}</p>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: "#aaa" }}>{item.desc}</p>
          </div>
          <Link
            href={item.link}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {item.cta} — {item.price}
          </Link>
        </div>
      ))}
    </div>
  );
}

// ── Main Explore Client ────────────────────────────────────────────────────

export default function ExploreClient() {
  const { data: session } = useSession();
  const { play } = useAudioStore();
  const loggedIn = !!session?.user;

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const [featured, setFeatured] = useState<FeaturedCard[]>([]);
  const [trending, setTrending] = useState<TrackItem[]>([]);
  const [newReleases, setNewReleases] = useState<TrackItem[]>([]);
  const [beats, setBeats] = useState<BeatItem[]>([]);
  const [studios, setStudios] = useState<StudioItem[]>([]);
  const [rising, setRising] = useState<ArtistItem[]>([]);
  const [recentPlays, setRecentPlays] = useState<TrackItem[]>([]);

  const [studioQuery, setStudioQuery] = useState("");
  const [studioSearching, setStudioSearching] = useState(false);

  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingBeats, setLoadingBeats] = useState(true);
  const [loadingStudios, setLoadingStudios] = useState(true);
  const [loadingRising, setLoadingRising] = useState(true);

  // Section refs for scroll-to
  const sectionRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    music:   useRef<HTMLElement>(null),
    beats:   useRef<HTMLElement>(null),
    studios: useRef<HTMLElement>(null),
    artists: useRef<HTMLElement>(null),
    ai:      useRef<HTMLElement>(null),
  };

  useEffect(() => {
    // Load all sections in parallel
    fetch("/api/explore/featured").then(r => r.json()).then(d => setFeatured(d.cards ?? []));

    fetch("/api/explore/trending").then(r => r.json()).then(d => { setTrending(d.tracks ?? []); setLoadingTrending(false); });
    fetch("/api/explore/new-releases").then(r => r.json()).then(d => { setNewReleases(d.tracks ?? []); setLoadingNew(false); });
    fetch("/api/explore/beats").then(r => r.json()).then(d => { setBeats(d.beats ?? []); setLoadingBeats(false); });
    fetch("/api/explore/studios").then(r => r.json()).then(d => { setStudios(d.studios ?? []); setLoadingStudios(false); });
    fetch("/api/explore/rising").then(r => r.json()).then(d => { setRising(d.artists ?? []); setLoadingRising(false); });

    if (loggedIn) {
      fetch("/api/explore/recently-played").then(r => r.json()).then(d => setRecentPlays(d.plays ?? []));
    }
  }, [loggedIn]);

  // Genre-filtered re-fetch
  useEffect(() => {
    if (activeGenre === null) return;
    const q = `?genre=${encodeURIComponent(activeGenre)}`;
    setLoadingTrending(true); setLoadingNew(true);
    fetch(`/api/explore/trending${q}`).then(r => r.json()).then(d => { setTrending(d.tracks ?? []); setLoadingTrending(false); });
    fetch(`/api/explore/new-releases${q}`).then(r => r.json()).then(d => { setNewReleases(d.tracks ?? []); setLoadingNew(false); });
  }, [activeGenre]);

  // When genre cleared
  useEffect(() => {
    if (activeGenre !== null) return;
    setLoadingTrending(true); setLoadingNew(true);
    fetch("/api/explore/trending").then(r => r.json()).then(d => { setTrending(d.tracks ?? []); setLoadingTrending(false); });
    fetch("/api/explore/new-releases").then(r => r.json()).then(d => { setNewReleases(d.tracks ?? []); setLoadingNew(false); });
  }, [activeGenre]);

  function handlePlay(track: TrackItem) {
    play({ id: track.id, title: track.title, artist: track.artist.name, src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined });
    if (loggedIn) {
      fetch("/api/explore/record-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
    }
  }

  function handleFilterTab(tab: FilterTab) {
    setActiveFilter(tab);
    const key = tab === "music" ? "music" : tab;
    const ref = sectionRefs[key];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleStudioSearch() {
    if (!studioQuery.trim()) return;
    setStudioSearching(true);
    const res = await fetch(`/api/explore/studios?q=${encodeURIComponent(studioQuery)}`);
    const data = await res.json();
    setStudios(data.studios ?? []);
    setStudioSearching(false);
  }

  const showSection = (key: string) => activeFilter === "all" || activeFilter === key || key === "featured";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1a1a1a" }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          {/* Top row */}
          <div className="h-14 flex items-center justify-between gap-4">
            <Link href="/" className="shrink-0 flex items-center">
              <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "32px", width: "auto" }} />
            </Link>
            <div className="flex-1 max-w-xl">
              <SearchBar onFilter={handleFilterTab} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {loggedIn ? (
                <Link href="/dashboard" className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#1a1a1a", color: "#D4A843" }}>Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ color: "#aaa" }}>Log in</Link>
                  <Link href="/signup" className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>Sign up</Link>
                </>
              )}
            </div>
          </div>

          {/* Filter pills */}
          <div className="pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {FILTER_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleFilterTab(key)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
                style={activeFilter === key
                  ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                  : { backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }
                }
              >
                {Icon && <Icon size={11} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Page Content ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-14">

        {/* Section 2: Featured Carousel */}
        {showSection("featured") && (
          <section>
            <FeaturedCarousel cards={featured} />
          </section>
        )}

        {/* Section 3: Trending */}
        {showSection("music") && (
          <section ref={sectionRefs.music as React.RefObject<HTMLElement>}>
            <SectionHeader label="TRENDING" title="What's hot right now" />
            {loadingTrending
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : <TrackScroll tracks={trending} onPlay={handlePlay} />
            }
          </section>
        )}

        {/* Section 4: New Releases */}
        {showSection("music") && (
          <section>
            <SectionHeader label="NEW" title="Just dropped" />
            {loadingNew
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : <TrackScroll tracks={newReleases} onPlay={handlePlay} isNew />
            }
          </section>
        )}

        {/* Recently Played (logged-in, after section 4) */}
        {showSection("music") && loggedIn && recentPlays.length > 0 && (
          <section>
            <SectionHeader label="CONTINUE" title="Pick up where you left off" />
            <TrackScroll tracks={recentPlays} onPlay={handlePlay} />
          </section>
        )}

        {/* Section 5: Genre Filter */}
        {showSection("music") && (
          <section>
            <SectionLabel label="GENRE" />
            <div className="flex flex-wrap gap-2 mt-2">
              {activeGenre && (
                <button
                  onClick={() => setActiveGenre(null)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
                  style={{ backgroundColor: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }}
                >
                  <X size={10} /> Clear
                </button>
              )}
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
                  style={{
                    backgroundColor: activeGenre === g ? GENRE_COLORS[g] + "22" : "#1a1a1a",
                    color: activeGenre === g ? GENRE_COLORS[g] : "#aaa",
                    border: `1px solid ${activeGenre === g ? GENRE_COLORS[g] + "55" : "#2a2a2a"}`,
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Section 6: Beat Marketplace */}
        {showSection("beats") && (
          <section ref={sectionRefs.beats as React.RefObject<HTMLElement>}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <SectionLabel label="BEATS" />
                <h2 className="text-xl font-bold text-white">Browse Beats</h2>
              </div>
              <Link href="/dashboard/marketplace" className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                View All →
              </Link>
            </div>
            {loadingBeats
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : beats.length === 0
                ? <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
                    <p className="text-sm" style={{ color: "#555" }}>No beats in the marketplace yet.</p>
                  </div>
                : <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {beats.map((b) => <BeatCard key={b.id} beat={b} onPlay={(beat) => handlePlay({ ...beat, plays: 0, artist: beat.artist })} />)}
                  </div>
            }
          </section>
        )}

        {/* Section 7: Studios */}
        {showSection("studios") && (
          <section ref={sectionRefs.studios as React.RefObject<HTMLElement>}>
            <SectionHeader label="STUDIOS" title="Studios near you" />
            {loadingStudios
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : studios.length === 0
                ? <div className="rounded-2xl border p-6 flex flex-col items-center gap-4" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
                    <Building2 size={32} style={{ color: "#333" }} />
                    <div className="text-center">
                      <p className="font-semibold text-white">Find a Studio</p>
                      <p className="text-sm mt-1" style={{ color: "#666" }}>Search by city or studio name</p>
                    </div>
                    <div className="flex gap-2 w-full max-w-xs">
                      <input
                        value={studioQuery}
                        onChange={(e) => setStudioQuery(e.target.value)}
                        placeholder="City, state, or studio name"
                        onKeyDown={(e) => e.key === "Enter" && handleStudioSearch()}
                        className="flex-1 rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none"
                        style={{ borderColor: "#2a2a2a", backgroundColor: "#1a1a1a" }}
                      />
                      <button
                        onClick={handleStudioSearch}
                        disabled={studioSearching}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold"
                        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                      >
                        {studioSearching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
                      </button>
                    </div>
                  </div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {studios.map((s) => <StudioCard key={s.id} studio={s} />)}
                  </div>
            }
          </section>
        )}

        {/* Section 8: Rising Artists */}
        {showSection("artists") && (
          <section ref={sectionRefs.artists as React.RefObject<HTMLElement>}>
            <SectionHeader label="RISING" title="Artists on the move" />
            {loadingRising
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : rising.length === 0
                ? <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
                    <p className="text-sm" style={{ color: "#555" }}>Check back soon — artists are making moves.</p>
                  </div>
                : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {rising.map((a) => <ArtistCard key={a.id} artist={a} onPlay={handlePlay} />)}
                  </div>
            }
          </section>
        )}

        {/* Section 9: AI Tools Showcase */}
        {showSection("ai") && (
          <section ref={sectionRefs.ai as React.RefObject<HTMLElement>}>
            <SectionHeader label="CREATE" title="Make something with AI" />
            <AIShowcase loggedIn={loggedIn} />
          </section>
        )}

        {/* Footer CTA */}
        <div
          className="rounded-2xl border p-8 text-center space-y-4"
          style={{ backgroundColor: "#111", borderColor: "#1e1e1e" }}
        >
          <p className="text-2xl font-black text-white">Your music business, on one platform.</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: "#888" }}>
            Create, promote, sell, and get paid. Everything an independent artist needs.
          </p>
          {!loggedIn && (
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              Join IndieThis Free →
            </Link>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
