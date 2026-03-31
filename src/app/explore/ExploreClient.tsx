"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAudioStore } from "@/store";
import Footer from "@/components/layout/Footer";
import BeatLicenseModal from "@/components/beats/BeatLicenseModal";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";
import SimilarTracks from "@/components/audio/SimilarTracks";
import SimilarArtists from "@/components/audio/SimilarArtists";
import InteractiveRadarFilter, { type RadarFilterState } from "@/components/explore/InteractiveRadarFilter";
import RadarFilterResults from "@/components/explore/RadarFilterResults";
import PublicNav from "@/components/layout/PublicNav";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import {
  Search, Play, ChevronLeft, ChevronRight, Music2, Users, Building2,
  Headphones, Mic2, Wand2, TrendingUp, Loader2, Zap, X, Radar, ShoppingBag,
  Disc, Disc3,
} from "lucide-react";
import { parseNaturalLanguageSearch, hasNLPSignals, type NLPPill, type SearchFeatureProfile } from "@/lib/natural-language-search";

// ── Types ──────────────────────────────────────────────────────────────────

type TrackItem = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  canvasVideoUrl?: string | null;
  fileUrl: string;
  genre: string | null;
  plays: number;
  createdAt?: string;
  artist: { id: string; name: string; photo?: string | null; artistSlug?: string | null; artistSite?: { isPublished: boolean } | null };
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
  artist: { id: string; name: string; artistSlug?: string | null; artistSite?: { isPublished: boolean } | null };
  beatLeaseSettings: { streamLeaseEnabled: boolean; maxStreamLeases: number | null } | null;
  _count: { beatLicenses: number; streamLeases: number };
};

type ArtistItem = {
  id: string;
  name: string;
  photo: string | null;
  slug: string | null;
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

type DJItem = {
  id: string;
  slug: string;
  genres: string[];
  city: string | null;
  profilePhotoUrl: string | null;
  isVerified: boolean;
  user: { name: string; artistName: string | null; photo: string | null };
  totalCrateItems: number;
};

type MerchItem = {
  id: string;
  title: string;
  imageUrl: string;
  imageUrls: string[];
  fulfillmentType: string;
  artist: { id: string; name: string; artistName: string | null; artistSlug: string | null };
  variants: { id: string; retailPrice: number }[];
};

type DigitalProductItem = {
  id: string;
  title: string;
  type: "SINGLE" | "ALBUM";
  price: number;
  coverArtUrl: string | null;
  user: {
    id: string;
    name: string;
    artistName: string | null;
    artistSlug: string | null;
    artistSite: { isPublished: boolean } | null;
  };
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
    imageUrl: "/images/brand/Make%20Your%20Vision%20Real.png",
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
    imageUrl: "/images/brand/Release%20Planner%20is%20Here.png",
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
    imageUrl: "/images/brand/Beat%20Marketplace%202.png",
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
  const artistSlug = track.artist.artistSite?.isPublished ? track.artist.artistSlug : null;
  return (
    <div className="shrink-0 w-40 group">
      <div
        className="relative w-40 h-40 rounded-xl overflow-hidden mb-2.5 cursor-pointer"
        style={{ backgroundColor: "#1a1a1a" }}
        onClick={() => onPlay(track)}
      >
        {track.coverArtUrl
          ? <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music2 size={28} style={{ color: "#444" }} /></div>
        }
        {isNew && (
          <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            NEW
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center transition-all bg-black/0 group-hover:bg-black/40">
          <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "#D4A843" }}>
            <Play size={16} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-white truncate cursor-pointer" onClick={() => onPlay(track)}>{track.title}</p>
      {artistSlug ? (
        <Link href={`/${artistSlug}`} className="text-[11px] truncate mt-0.5 block hover:underline" style={{ color: "#888" }}>
          {track.artist.name}
        </Link>
      ) : (
        <p className="text-[11px] truncate mt-0.5" style={{ color: "#888" }}>{track.artist.name}</p>
      )}
      <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{track.plays.toLocaleString()} plays</p>
      <div className="mt-1.5">
        <AddToCrateButton trackId={track.id} />
      </div>
      {artistSlug && (
        <Link href={`/${artistSlug}`} className="text-[9px] mt-1 block hover:underline" style={{ color: "#555" }}>
          More from {track.artist.name} →
        </Link>
      )}
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
          background: card.imageUrl ? `url(${card.imageUrl}) top center / cover no-repeat` : (card.gradient ?? "#1a1a1a"),
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: card.imageUrl ? "linear-gradient(to top, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.05) 100%)" : "linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)" }} />

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

function BeatCard({ beat, isPlaying, onPlay, onLicense }: { beat: BeatItem; isPlaying: boolean; onPlay: (b: BeatItem) => void; onLicense: (b: BeatItem) => void }) {
  const totalUses = beat._count.beatLicenses + beat._count.streamLeases;
  const artistSlug = beat.artist.artistSite?.isPublished ? beat.artist.artistSlug : null;
  return (
    <div
      className="rounded-xl border p-3 group transition-all hover:border-accent/40"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      <div
        className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 cursor-pointer"
        style={{ backgroundColor: "#1a1a1a" }}
        onClick={() => onPlay(beat)}
      >
        {beat.coverArtUrl
          ? <img src={beat.coverArtUrl} alt={beat.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Headphones size={24} style={{ color: "#444" }} /></div>
        }
        <div className="absolute inset-0 flex items-center justify-center transition-all bg-black/0 group-hover:bg-black/50">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: isPlaying ? "#E85D4A" : "#D4A843" }}
          >
            {isPlaying ? (
              <span className="flex gap-0.5">
                <span className="w-0.5 h-3 rounded-sm animate-pulse" style={{ backgroundColor: "#0A0A0A" }} />
                <span className="w-0.5 h-3 rounded-sm animate-pulse delay-75" style={{ backgroundColor: "#0A0A0A" }} />
              </span>
            ) : (
              <Play size={14} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
            )}
          </div>
        </div>
        {beat.beatLeaseSettings?.streamLeaseEnabled && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.15)", color: "#34C759", border: "1px solid rgba(52,199,89,0.3)" }}>
            LEASE
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-white truncate cursor-pointer" onClick={() => onPlay(beat)}>{beat.title}</p>
      {artistSlug ? (
        <Link href={`/${artistSlug}`} className="text-[10px] truncate mb-1 block hover:underline" style={{ color: "#888" }}>
          {beat.artist.name}
        </Link>
      ) : (
        <p className="text-[10px] truncate mb-1" style={{ color: "#888" }}>{beat.artist.name}</p>
      )}
      {artistSlug && (
        <Link href={`/${artistSlug}`} className="text-[9px] block mb-1.5 hover:underline" style={{ color: "#555" }}>
          More from {beat.artist.name} →
        </Link>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {beat.bpm && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>{beat.bpm}</span>}
          {beat.musicalKey && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: "#1e1e1e", color: "#888" }}>{beat.musicalKey}</span>}
        </div>
        {beat.price != null && <span className="text-xs font-bold" style={{ color: "#D4A843" }}>${beat.price.toFixed(0)}</span>}
      </div>
      {totalUses > 0 && (
        <p className="text-[9px] mb-2" style={{ color: "#555" }}>{totalUses} artist{totalUses !== 1 ? "s" : ""} on this beat</p>
      )}
      <div className="flex justify-center my-2">
        <LazyAudioRadar trackId={beat.id} size="sm" animated={false} />
      </div>
      <SimilarTracks sourceId={beat.id} sourceType="beat" limit={3} />
      <button
        onClick={() => onLicense(beat)}
        className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-colors"
        style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
      >
        License
      </button>
    </div>
  );
}

// ── Studio Card ────────────────────────────────────────────────────────────

function StudioCard({ studio }: { studio: StudioItem }) {
  const photo = studio.heroImage ?? studio.logoUrl ?? (studio.photos?.[0]);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
      <Link href={`/${studio.slug}`} className="block">
        <div className="w-full h-28 overflow-hidden group" style={{ backgroundColor: "#1a1a1a" }}>
          {photo
            ? <img src={photo} alt={studio.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 size={28} style={{ color: "#333" }} /></div>
          }
        </div>
        <div className="px-3 pt-3">
          <p className="text-sm font-bold text-white truncate hover:underline">{studio.name}</p>
          {(studio.city || studio.state) && (
            <p className="text-[11px] mt-0.5" style={{ color: "#888" }}>{[studio.city, studio.state].filter(Boolean).join(", ")}</p>
          )}
          {studio.tagline && <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "#666" }}>{studio.tagline}</p>}
        </div>
      </Link>
      <div className="px-3 pb-3 pt-2">
        <Link
          href={`/${studio.slug}`}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors"
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
        {artist.slug ? (
          <Link href={`/${artist.slug}`} className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
            {artist.photo
              ? <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Users size={18} style={{ color: "#444" }} /></div>
            }
          </Link>
        ) : (
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
            {artist.photo
              ? <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Users size={18} style={{ color: "#444" }} /></div>
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          {artist.slug ? (
            <Link href={`/${artist.slug}`} className="font-bold text-white truncate block hover:underline">{artist.name}</Link>
          ) : (
            <p className="font-bold text-white truncate">{artist.name}</p>
          )}
          {artist.genre && <p className="text-[11px]" style={{ color: "#888" }}>{artist.genre}</p>}
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
          <TrendingUp size={9} className="inline mr-1" />Rising
        </span>
      </div>
      {artist.topTrack && (
        <button
          onClick={() => onPlay({ ...artist.topTrack!, artist: { id: artist.id, name: artist.name, artistSlug: artist.slug } })}
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
      {artist.slug && (
        <Link href={`/${artist.slug}`} className="text-[9px] block hover:underline" style={{ color: "#555" }}>
          More from {artist.name} →
        </Link>
      )}
      <SimilarArtists artistId={artist.id} limit={4} />
    </div>
  );
}

// ── Search Bar + Dropdown ──────────────────────────────────────────────────

type SearchBarProps = {
  onFilter: (tab: FilterTab) => void;
  onNLPParsed: (profile: SearchFeatureProfile) => void;
  onClearNLP: () => void;
  nlpPills: NLPPill[];
  onRemovePill: (key: string) => void;
};

function SearchBar({ onFilter, onNLPParsed, onClearNLP, nlpPills = [], onRemovePill }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nlpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(value: string) {
    setQuery(value);

    // NLP parse on debounce (separate from text search debounce)
    if (nlpTimerRef.current) clearTimeout(nlpTimerRef.current);
    if (!value.trim()) { onClearNLP(); return; }
    nlpTimerRef.current = setTimeout(() => {
      const profile = parseNaturalLanguageSearch(value);
      onNLPParsed(profile);
    }, 250);
  }

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

  function handleClear() {
    setQuery("");
    setResults(null);
    setOpen(false);
    onClearNLP();
  }

  const hasResults = results && (results.artists.length > 0 || results.tracks.length > 0 || results.studios.length > 0);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search artists, tracks, or describe a vibe…"
          className="w-full rounded-xl border pl-10 pr-10 py-3 text-sm bg-transparent text-white outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
          style={{ borderColor: "#2a2a2a", backgroundColor: "#111" }}
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} style={{ color: "#666" }} />
          </button>
        )}
        {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "#D4A843" }} />}
      </div>

      {/* NLP pills */}
      {nlpPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 px-0.5">
          {nlpPills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #333", color: "#D4A843" }}
            >
              {pill.label}
              <button
                onClick={() => onRemovePill(pill.key)}
                className="ml-0.5 transition-colors"
                style={{ color: "#666" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#E85D4A")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden"
          style={{ backgroundColor: "#141414", borderColor: "#2a2a2a", marginTop: nlpPills.length > 0 ? "0.25rem" : "0.375rem" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {!hasResults ? (
            <p className="px-4 py-3 text-sm" style={{ color: "#666" }}>No results for &quot;{query}&quot;</p>
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

type FilterTab = "all" | "artists" | "music" | "beats" | "studios" | "ai" | "sound" | "store" | "djs" | "merch";

type FilterTabDef = { key: FilterTab; label: string; icon?: React.ElementType };

const FILTER_TABS: FilterTabDef[] = [
  { key: "all",     label: "All" },
  { key: "sound",   label: "Find Your Sound", icon: Radar },
  { key: "artists", label: "Artists",  icon: Users },
  { key: "music",   label: "Music",    icon: Music2 },
  { key: "beats",   label: "Beats",    icon: Headphones },
  { key: "djs",     label: "DJs",      icon: Disc3 },
  { key: "store",   label: "Store",    icon: ShoppingBag },
  { key: "merch",   label: "Merch",    icon: ShoppingBag },
  { key: "studios", label: "Studios",  icon: Building2 },
  { key: "ai",      label: "AI Tools", icon: Wand2 },
];

// ── Digital Product Checkout Modal ─────────────────────────────────────────

function DigitalProductCheckoutModal({ product, onClose }: { product: DigitalProductItem; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/digital-products/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, buyerEmail: email }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setError(data.error ?? "Something went wrong."); return; }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  const artistName = product.user.artistName || product.user.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
              {product.coverArtUrl
                ? <img src={product.coverArtUrl} alt={product.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Disc3 size={20} style={{ color: "#444" }} /></div>
              }
            </div>
            <div>
              <p className="text-sm font-bold text-white">{product.title}</p>
              <p className="text-xs" style={{ color: "#888" }}>{artistName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-b" style={{ borderColor: "#2a2a2a" }}>
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-lg font-bold" style={{ color: "#D4A843" }}>${(product.price / 100).toFixed(2)}</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#888" }}>Your email (download link sent here)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
            placeholder="you@example.com"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "#2a2a2a", backgroundColor: "#1a1a1a" }}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading || !email.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin inline" /> : `Buy for $${(product.price / 100).toFixed(2)} →`}
        </button>
      </div>
    </div>
  );
}

// ── Digital Product Card ────────────────────────────────────────────────────

function DigitalProductCard({ product, onBuy }: { product: DigitalProductItem; onBuy: (p: DigitalProductItem) => void }) {
  const artistSlug = product.user.artistSite?.isPublished ? product.user.artistSlug : null;
  const artistName = product.user.artistName || product.user.name;

  return (
    <div
      className="rounded-xl border overflow-hidden group"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
    >
      <div className="relative w-full aspect-square overflow-hidden" style={{ backgroundColor: "#1a1a1a" }}>
        {product.coverArtUrl
          ? <img src={product.coverArtUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center">
              {product.type === "ALBUM"
                ? <Disc size={36} style={{ color: "#333" }} />
                : <Disc3 size={36} style={{ color: "#333" }} />
              }
            </div>
        }
        <span
          className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: product.type === "ALBUM" ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.1)", color: product.type === "ALBUM" ? "#D4A843" : "#aaa", border: `1px solid ${product.type === "ALBUM" ? "rgba(212,168,67,0.4)" : "#333"}` }}
        >
          {product.type}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-white truncate">{product.title}</p>
        {artistSlug ? (
          <Link href={`/${artistSlug}`} className="text-[11px] block hover:underline truncate" style={{ color: "#888" }}>
            {artistName}
          </Link>
        ) : (
          <p className="text-[11px] truncate" style={{ color: "#888" }}>{artistName}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold" style={{ color: "#D4A843" }}>${(product.price / 100).toFixed(2)}</span>
          <button
            onClick={() => onBuy(product)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

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
      price: "$7.99",
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
  const { play, currentTrack } = useAudioStore();
  const loggedIn = !!session?.user;
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [licenseBeat, setLicenseBeat] = useState<BeatItem | null>(null);

  const [featured, setFeatured] = useState<FeaturedCard[]>([]);
  const [trending, setTrending] = useState<TrackItem[]>([]);
  const [newReleases, setNewReleases] = useState<TrackItem[]>([]);
  const [beats, setBeats] = useState<BeatItem[]>([]);
  const [studios, setStudios] = useState<StudioItem[]>([]);
  const [rising, setRising] = useState<ArtistItem[]>([]);
  const [recentPlays, setRecentPlays] = useState<TrackItem[]>([]);
  const [digitalProducts, setDigitalProducts] = useState<DigitalProductItem[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [buyProduct, setBuyProduct] = useState<DigitalProductItem | null>(null);

  const [merch, setMerch] = useState<MerchItem[]>([]);
  const [loadingMerch, setLoadingMerch] = useState(true);

  const [studioQuery, setStudioQuery] = useState("");
  const [studioSearching, setStudioSearching] = useState(false);

  // ── Radar filter state ─────────────────────────────────────────────────────
  const [radarQueryKey, setRadarQueryKey] = useState(0);
  const [radarProfile, setRadarProfile]   = useState<RadarFilterState | null>(null);
  const [radarType, setRadarType]         = useState<"track" | "beat" | "both">("both");
  const [radarGenre, setRadarGenre]       = useState<string | null>(null);
  const [radarMood, setRadarMood]         = useState<string | null>(null);
  const [radarVocal, setRadarVocal]       = useState<boolean | null>(null);

  // ── NLP search state ────────────────────────────────────────────────────────
  const [nlpPills, setNlpPills]           = useState<NLPPill[]>([]);
  const [nlpProfile, setNlpProfile]       = useState<SearchFeatureProfile | null>(null);

  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingBeats, setLoadingBeats] = useState(true);
  const [loadingStudios, setLoadingStudios] = useState(true);
  const [loadingRising, setLoadingRising] = useState(true);

  // DJ directory state
  const [djs, setDjs] = useState<DJItem[]>([]);
  const [risingDjs, setRisingDjs] = useState<DJItem[]>([]);
  const [loadingDjs, setLoadingDjs] = useState(true);
  const [djGenreFilter, setDjGenreFilter] = useState<string>("");
  const [djCityFilter, setDjCityFilter] = useState<string>("");
  const [djSort, setDjSort] = useState<"crates" | "newest">("crates");

  // Section refs for scroll-to
  const sectionRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    music:   useRef<HTMLElement>(null),
    beats:   useRef<HTMLElement>(null),
    studios: useRef<HTMLElement>(null),
    artists: useRef<HTMLElement>(null),
    ai:      useRef<HTMLElement>(null),
    sound:   useRef<HTMLElement>(null),
    store:   useRef<HTMLElement>(null),
    djs:     useRef<HTMLElement>(null),
    merch:   useRef<HTMLElement>(null),
  };

  useEffect(() => {
    // Load all sections in parallel
    fetch("/api/explore/featured").then(r => r.json()).then(d => setFeatured(d.cards ?? []));

    fetch("/api/explore/trending").then(r => r.json()).then(d => { setTrending(d.tracks ?? []); setLoadingTrending(false); });
    fetch("/api/explore/new-releases").then(r => r.json()).then(d => { setNewReleases(d.tracks ?? []); setLoadingNew(false); });
    fetch("/api/explore/beats").then(r => r.json()).then(d => { setBeats(d.beats ?? []); setLoadingBeats(false); });
    fetch("/api/explore/studios").then(r => r.json()).then(d => { setStudios(d.studios ?? []); setLoadingStudios(false); });
    fetch("/api/explore/rising").then(r => r.json()).then(d => { setRising(d.artists ?? []); setLoadingRising(false); });
    fetch("/api/explore/digital-products").then(r => r.json()).then(d => { setDigitalProducts(d.products ?? []); setLoadingStore(false); });
    fetch("/api/explore/merch").then(r => r.json()).then(d => { setMerch(d.products ?? []); setLoadingMerch(false); });
    fetch("/api/explore/djs").then(r => r.json()).then((d: { djs?: DJItem[]; rising?: DJItem[] }) => {
      setDjs(d.djs ?? []);
      setRisingDjs(d.rising ?? []);
      setLoadingDjs(false);
    });

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

  // Shared scroll helper — accounts for both the sticky nav and the pills bar
  function scrollToSection(ref: React.RefObject<HTMLElement | null>) {
    if (!ref?.current) return;
    const navH   = (document.querySelector("header") as HTMLElement)?.offsetHeight ?? 56;
    const pillsH = (document.getElementById("explore-pills-bar") as HTMLElement)?.offsetHeight ?? 44;
    const top    = ref.current.getBoundingClientRect().top + window.scrollY - navH - pillsH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  // URL param filter — auto-scroll to section on load (e.g. /explore?filter=studios)
  useEffect(() => {
    const filter = searchParams.get("filter") as FilterTab | null;
    if (!filter || filter === "all") return;
    setActiveFilter(filter);
    setTimeout(() => scrollToSection(sectionRefs[filter]), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handlePlay(track: TrackItem) {
    play({ id: track.id, title: track.title, artist: track.artist.name, src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined, canvasVideoUrl: track.canvasVideoUrl ?? null });
    if (loggedIn) {
      fetch("/api/explore/record-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
    }
  }

  function handleBeatPlay(beat: BeatItem) {
    play({
      id:       beat.id,
      title:    beat.title,
      artist:   beat.artist.name,
      src:      beat.fileUrl,
      coverArt: beat.coverArtUrl ?? undefined,
    });
  }

  function handleNLPParsed(profile: SearchFeatureProfile) {
    setNlpProfile(profile);
    setNlpPills(profile.pills);

    if (!hasNLPSignals(profile)) return;

    // Build a RadarFilterState from NLP features (default 0.5 for unspecified)
    const DEFAULT_RADAR = { loudness: 0.5, energy: 0.5, danceability: 0.5, acousticness: 0.5, instrumentalness: 0.5, speechiness: 0.5, liveness: 0.5, valence: 0.5 };
    const merged: RadarFilterState = { ...DEFAULT_RADAR, ...profile.features };

    setRadarProfile(merged);
    if (profile.genre)        setRadarGenre(profile.genre);
    if (profile.mood)         setRadarMood(profile.mood);
    if (profile.isVocal !== null) setRadarVocal(profile.isVocal);
    setRadarQueryKey(k => k + 1);
    setActiveFilter("sound");
    setTimeout(() => scrollToSection(sectionRefs.sound), 20);
  }

  function handleClearNLP() {
    setNlpPills([]);
    setNlpProfile(null);
  }

  function handleRemovePill(key: string) {
    if (!nlpProfile) return;

    const updatedPills = nlpPills.filter(p => p.key !== key);
    setNlpPills(updatedPills);

    // Reset the corresponding filter
    const updated = { ...nlpProfile };
    if (key === "energy")        { delete updated.features.energy; }
    if (key === "danceability")  { delete updated.features.danceability; }
    if (key === "valence")       { delete updated.features.valence; }
    if (key === "acousticness")  { delete updated.features.acousticness; }
    if (key === "speechiness")   { delete updated.features.speechiness; }
    if (key === "isVocal")       { updated.isVocal = null; delete updated.features.instrumentalness; }
    if (key === "genre")         { updated.genre = null; setRadarGenre(null); }
    if (key === "mood")          { updated.mood = null; setRadarMood(null); }
    updated.pills = updatedPills;
    setNlpProfile(updated);

    if (key === "isVocal") setRadarVocal(null);

    if (!hasNLPSignals(updated)) {
      setRadarProfile(null);
      setActiveFilter("all");
      return;
    }

    const DEFAULT_RADAR = { loudness: 0.5, energy: 0.5, danceability: 0.5, acousticness: 0.5, instrumentalness: 0.5, speechiness: 0.5, liveness: 0.5, valence: 0.5 };
    setRadarProfile({ ...DEFAULT_RADAR, ...updated.features });
    setRadarQueryKey(k => k + 1);
  }

  function handleFilterTab(tab: FilterTab) {
    setActiveFilter(tab);

    if (tab === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Wait one tick for React to flush the state update and render the target
    // section (it may have been hidden under a previous specific filter).
    setTimeout(() => scrollToSection(sectionRefs[tab]), 20);
  }

  async function handleStudioSearch() {
    if (!studioQuery.trim()) return;
    setStudioSearching(true);
    const res = await fetch(`/api/explore/studios?q=${encodeURIComponent(studioQuery)}`);
    const data = await res.json();
    setStudios(data.studios ?? []);
    setStudioSearching(false);
  }

  function fetchDjsFiltered() {
    setLoadingDjs(true);
    const params = new URLSearchParams();
    if (djGenreFilter) params.set("genre", djGenreFilter);
    if (djCityFilter) params.set("city", djCityFilter);
    params.set("sort", djSort);
    fetch(`/api/explore/djs?${params.toString()}`)
      .then(r => r.json())
      .then((d: { djs?: DJItem[]; rising?: DJItem[] }) => {
        setDjs(d.djs ?? []);
        setRisingDjs(d.rising ?? []);
        setLoadingDjs(false);
      });
  }

  const showSection = (key: string) => activeFilter !== "sound" && (activeFilter === "all" || activeFilter === key || key === "featured");

  // Store section — shown on "all" or "store" filter only (not cluttering music/beats views)
  const showStore  = activeFilter !== "sound" && (activeFilter === "all" || activeFilter === "store");
  const showMerch  = activeFilter !== "sound" && (activeFilter === "all" || activeFilter === "merch");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#f5f5f5" }}>
      {/* ── Nav ── */}
      <PublicNav
        onLogoClick={() => { setActiveFilter("all"); setNlpPills([]); setNlpProfile(null); setRadarProfile(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        center={
          <SearchBar
            onFilter={handleFilterTab}
            onNLPParsed={handleNLPParsed}
            onClearNLP={handleClearNLP}
            nlpPills={nlpPills}
            onRemovePill={handleRemovePill}
          />
        }
      />

      {/* Filter pills */}
      <div
        id="explore-pills-bar"
        className="sticky top-14 z-30 border-b"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", borderColor: "#1a1a1a" }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
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

      {/* ── Page Content ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-14">

        {/* ── Find Your Sound ── */}
        {activeFilter === "sound" && (
          <section ref={sectionRefs.sound as React.RefObject<HTMLElement>}>
            <div className="rounded-2xl border p-6 md:p-8" style={{ background: "#111111", borderColor: "#1A1A1A" }}>
              <div className="flex flex-col lg:flex-row gap-8 items-start">

                {/* Left: interactive radar */}
                <div className="w-full lg:w-auto flex-shrink-0 flex justify-center">
                  <InteractiveRadarFilter
                    onChange={(s) => setRadarProfile(s)}
                    onCommit={(s) => {
                      setRadarProfile(s);
                      setRadarQueryKey(k => k + 1);
                    }}
                  />
                </div>

                {/* Right: filters */}
                <div className="flex-1 min-w-0 space-y-5">
                  {/* Content type */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>Content Type</p>
                    <div className="flex gap-2 flex-wrap">
                      {(["both", "track", "beat"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setRadarType(t); setRadarQueryKey(k => k + 1); }}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all capitalize"
                          style={{
                            background:  radarType === t ? "rgba(212,168,67,0.15)" : "#1a1a1a",
                            color:       radarType === t ? "#D4A843" : "#888",
                            border:      `1px solid ${radarType === t ? "#D4A843" : "#2a2a2a"}`,
                          }}
                        >
                          {t === "both" ? "Tracks & Beats" : t === "track" ? "Tracks" : "Beats"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Genre */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>Genre</p>
                    <div className="flex gap-2 flex-wrap">
                      {radarGenre && (
                        <button
                          onClick={() => { setRadarGenre(null); setRadarQueryKey(k => k + 1); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }}
                        >
                          <X size={9} /> Clear
                        </button>
                      )}
                      {["Hip-Hop","R&B","Pop","Electronic","Country","Afrobeats","Gospel","Jazz"].map(g => (
                        <button
                          key={g}
                          onClick={() => { setRadarGenre(radarGenre === g ? null : g); setRadarQueryKey(k => k + 1); }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={{
                            background: radarGenre === g ? "rgba(212,168,67,0.12)" : "#1a1a1a",
                            color:      radarGenre === g ? "#D4A843" : "#888",
                            border:     `1px solid ${radarGenre === g ? "rgba(212,168,67,0.4)" : "#2a2a2a"}`,
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>Mood</p>
                    <div className="flex gap-2 flex-wrap">
                      {radarMood && (
                        <button
                          onClick={() => { setRadarMood(null); setRadarQueryKey(k => k + 1); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a" }}
                        >
                          <X size={9} /> Clear
                        </button>
                      )}
                      {["Energetic","Melancholic","Upbeat","Dark","Peaceful","Angry","Romantic","Euphoric"].map(m => (
                        <button
                          key={m}
                          onClick={() => { setRadarMood(radarMood === m ? null : m); setRadarQueryKey(k => k + 1); }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={{
                            background: radarMood === m ? "rgba(212,168,67,0.12)" : "#1a1a1a",
                            color:      radarMood === m ? "#D4A843" : "#888",
                            border:     `1px solid ${radarMood === m ? "rgba(212,168,67,0.4)" : "#2a2a2a"}`,
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Has Vocals */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: "#D4A843" }}>Vocals</p>
                    <div className="flex gap-2">
                      {([
                        { label: "Either",       value: null },
                        { label: "Vocal",        value: true },
                        { label: "Instrumental", value: false },
                      ] as const).map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => { setRadarVocal(opt.value); setRadarQueryKey(k => k + 1); }}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={{
                            background: radarVocal === opt.value ? "rgba(212,168,67,0.15)" : "#1a1a1a",
                            color:      radarVocal === opt.value ? "#D4A843" : "#888",
                            border:     `1px solid ${radarVocal === opt.value ? "#D4A843" : "#2a2a2a"}`,
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results (only show after user has interacted / commit fired) */}
              {radarProfile && radarQueryKey > 0 && (
                <div className="mt-8 border-t pt-6" style={{ borderColor: "#1A1A1A" }}>
                  <RadarFilterResults
                    profile={radarProfile}
                    typeFilter={radarType}
                    genre={radarGenre}
                    mood={radarMood}
                    isVocal={radarVocal}
                    queryKey={radarQueryKey}
                    onPlay={(id, title, artist, src, coverArt) =>
                      play({ id, title, artist, src, coverArt })
                    }
                  />
                </div>
              )}
            </div>
          </section>
        )}

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
            <div className="mt-5 text-center">
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
              >
                Discover Artists →
              </Link>
            </div>
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
            </div>
            {loadingBeats
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : beats.length === 0
                ? <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
                    <p className="text-sm" style={{ color: "#555" }}>No beats in the marketplace yet.</p>
                  </div>
                : <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {beats.map((b) => (
                      <BeatCard
                        key={b.id}
                        beat={b}
                        isPlaying={currentTrack?.id === b.id}
                        onPlay={handleBeatPlay}
                        onLicense={(beat) => setLicenseBeat(beat)}
                      />
                    ))}
                  </div>
            }
            <div className="mt-5 text-center">
              <Link
                href="/beats"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
              >
                Search All Beats →
              </Link>
            </div>
          </section>
        )}

        {/* Section: Digital Products Store */}
        {showStore && (
          <section ref={sectionRefs.store as React.RefObject<HTMLElement>}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>STORE</p>
                <h2 className="text-xl font-bold text-white">Music &amp; Merch</h2>
              </div>
            </div>
            {loadingStore
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : digitalProducts.length === 0
                ? <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
                    <p className="text-sm" style={{ color: "#555" }}>No products available yet — check back soon.</p>
                  </div>
                : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {digitalProducts.map((p) => (
                      <DigitalProductCard key={p.id} product={p} onBuy={setBuyProduct} />
                    ))}
                  </div>
            }
          </section>
        )}

        {/* Section: Merch */}
        {showMerch && (
          <section ref={sectionRefs.merch as React.RefObject<HTMLElement>}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>MERCH</p>
                <h2 className="text-xl font-bold text-white">Artist Merch</h2>
              </div>
            </div>
            {loadingMerch
              ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /></div>
              : merch.length === 0
                ? <div className="py-8 text-center rounded-xl" style={{ backgroundColor: "#141414" }}>
                    <p className="text-sm" style={{ color: "#555" }}>No merch available yet — check back soon.</p>
                  </div>
                : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {merch.map((item) => {
                      const artistName = item.artist.artistName || item.artist.name;
                      const price = item.variants[0]?.retailPrice;
                      const thumb = item.imageUrls?.[0] ?? item.imageUrl;
                      return (
                        <a
                          key={item.id}
                          href={`/${item.artist.artistSlug}`}
                          className="group block rounded-xl overflow-hidden no-underline"
                          style={{ backgroundColor: "#141414" }}
                        >
                          <div className="relative w-full aspect-square overflow-hidden">
                            {thumb
                              ? <img src={thumb} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#1a1a1a" }}>
                                  <ShoppingBag size={32} style={{ color: "#333" }} />
                                </div>
                            }
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                            <p className="text-[11px] truncate mt-0.5" style={{ color: "#888" }}>{artistName}</p>
                            {price !== undefined && (
                              <p className="text-xs font-bold mt-1" style={{ color: "#D4A843" }}>${price.toFixed(2)}</p>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
            }
          </section>
        )}

        {/* Section 7: Studios */}
        {showSection("studios") && (
          <section id="studios" ref={sectionRefs.studios as React.RefObject<HTMLElement>}>
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
            <div className="mt-5 text-center">
              <Link
                href="/studios"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
              >
                Find a Studio →
              </Link>
            </div>
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
            <div className="mt-5 text-center">
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843", backgroundColor: "transparent" }}
              >
                Discover More Artists →
              </Link>
            </div>
          </section>
        )}

        {/* Section: DJ Directory */}
        {showSection("djs") && (
          <section ref={sectionRefs.djs as React.RefObject<HTMLElement>}>
            <SectionHeader label="DJ DIRECTORY" title="Find DJs" />

            {/* Rising DJs */}
            {risingDjs.length > 0 && (activeFilter === "all" || activeFilter === "djs") && (
              <div className="mb-8">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "#D4A843" }}>Rising DJs</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {risingDjs.map(dj => {
                    const name = dj.user.artistName ?? dj.user.name;
                    const photo = dj.profilePhotoUrl ?? dj.user.photo;
                    return (
                      <Link
                        key={dj.id}
                        href={`/dj/${dj.slug}`}
                        className="shrink-0 w-32 group text-center"
                      >
                        <div
                          className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-2 flex items-center justify-center text-2xl font-black border-2 border-transparent group-hover:border-[#D4A843] transition-colors"
                          style={{ backgroundColor: "#1a1a1a" }}
                        >
                          {photo
                            ? <img src={photo} alt={name} className="w-full h-full object-cover" />
                            : <span style={{ color: "#D4A843" }}>{name[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <p className="text-xs font-semibold text-white truncate group-hover:text-[#D4A843] transition-colors">{name}</p>
                        {dj.city && <p className="text-[10px] truncate mt-0.5" style={{ color: "#666" }}>{dj.city}</p>}
                        <p className="text-[10px] mt-0.5" style={{ color: "#D4A843" }}>{dj.totalCrateItems} tracks</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            {activeFilter === "djs" && (
              <div className="flex flex-wrap gap-3 mb-6 items-end">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#666" }}>Genre</label>
                  <select
                    value={djGenreFilter}
                    onChange={e => setDjGenreFilter(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white border outline-none"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  >
                    <option value="">All Genres</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#666" }}>City</label>
                  <input
                    className="rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                    placeholder="Atlanta, GA"
                    value={djCityFilter}
                    onChange={e => setDjCityFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#666" }}>Sort By</label>
                  <select
                    value={djSort}
                    onChange={e => setDjSort(e.target.value as "crates" | "newest")}
                    className="rounded-lg px-3 py-2 text-sm text-white border outline-none"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  >
                    <option value="crates">Most Tracks in Crates</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>
                <button
                  onClick={fetchDjsFiltered}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  Filter
                </button>
              </div>
            )}

            {loadingDjs ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
              </div>
            ) : djs.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#555" }}>No DJs found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(activeFilter === "all" ? djs.slice(0, 10) : djs).map(dj => {
                  const name = dj.user.artistName ?? dj.user.name;
                  const photo = dj.profilePhotoUrl ?? dj.user.photo;
                  return (
                    <Link
                      key={dj.id}
                      href={`/dj/${dj.slug}`}
                      className="group rounded-xl border p-3 text-center transition-colors hover:border-[#D4A843]"
                      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
                    >
                      <div
                        className="w-16 h-16 rounded-xl overflow-hidden mx-auto mb-2.5 flex items-center justify-center text-xl font-black"
                        style={{ backgroundColor: "#1a1a1a" }}
                      >
                        {photo
                          ? <img src={photo} alt={name} className="w-full h-full object-cover" />
                          : <span style={{ color: "#D4A843" }}>{name[0]?.toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-[#D4A843] transition-colors">{name}</p>
                        {dj.isVerified && <span style={{ color: "#D4A843" }}>✓</span>}
                      </div>
                      {dj.city && <p className="text-[10px] truncate" style={{ color: "#666" }}>{dj.city}</p>}
                      <div className="flex flex-wrap justify-center gap-1 my-1.5">
                        {dj.genres.slice(0, 3).map(g => (
                          <span
                            key={g}
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px]" style={{ color: "#555" }}>{dj.totalCrateItems} tracks in crates</p>
                    </Link>
                  );
                })}
              </div>
            )}
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
              Join IndieThis →
            </Link>
          )}
        </div>
      </div>

      <Footer />

      {buyProduct && (
        <DigitalProductCheckoutModal product={buyProduct} onClose={() => setBuyProduct(null)} />
      )}

      {licenseBeat && (
        <BeatLicenseModal
          track={{
            id:                 licenseBeat.id,
            title:              licenseBeat.title,
            price:              licenseBeat.price,
            coverArtUrl:        licenseBeat.coverArtUrl,
            streamLeaseEnabled: licenseBeat.beatLeaseSettings?.streamLeaseEnabled ?? true,
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
