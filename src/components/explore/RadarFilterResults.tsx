"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sliders } from "lucide-react";
import { motion } from "framer-motion";
import AudioFeaturesRadar from "@/components/audio/AudioFeaturesRadar";
import { type TrackCardData } from "@/store/expandedCard";
import { useTrackOverlay } from "@/hooks/useTrackOverlay";
import { HoverCardCover } from "@/components/tracks/HoverCardCover";
import type { AudioFeatureScores } from "@/lib/audio-features";
import type { RadarFilterState }   from "./InteractiveRadarFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterResult {
  id:         string;
  title:      string;
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  fileUrl:    string;
  type:       "track" | "beat";
  bpm:        number | null;
  key:        string | null;
  genre:      string | null;
  mood:       string | null;
  features:   AudioFeatureScores;
  similarity: number;
}

interface RadarFilterResultsProps {
  profile:    RadarFilterState;
  typeFilter: "track" | "beat" | "both";
  genre:      string | null;
  mood:       string | null;
  isVocal:    boolean | null;
  onPlay:     (id: string, title: string, artist: string, src: string, coverArt?: string) => void;
  /** Trigger re-query — increment to force a new fetch */
  queryKey:   number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadarFilterResults({
  profile,
  typeFilter,
  genre,
  mood,
  isVocal,
  onPlay,
  queryKey,
}: RadarFilterResultsProps) {
  const [results,  setResults]  = useState<FilterResult[]>([]);
  const [total,    setTotal]    = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const offsetRef = useRef(0);

  // ── Build query URL ────────────────────────────────────────────────────────
  function buildUrl(offset: number) {
    const params = new URLSearchParams({
      features: JSON.stringify(profile),
      type:     typeFilter,
      limit:    "20",
      offset:   String(offset),
    });
    if (genre)              params.set("genre",   genre);
    if (mood)               params.set("mood",    mood);
    if (isVocal !== null)   params.set("isVocal", String(isVocal));
    return `/api/explore/radar-filter?${params}`;
  }

  // ── Initial / reset fetch whenever queryKey changes ───────────────────────
  useEffect(() => {
    offsetRef.current = 0;
    setLoading(true);
    fetch(buildUrl(0))
      .then(r => r.json())
      .then(d => {
        setResults(d.results ?? []);
        setTotal(d.total   ?? 0);
        setHasMore(d.hasMore ?? false);
        offsetRef.current = (d.results ?? []).length;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Load more ─────────────────────────────────────────────────────────────
  function fetchMore() {
    setLoadMore(true);
    fetch(buildUrl(offsetRef.current))
      .then(r => r.json())
      .then(d => {
        const next = d.results ?? [];
        setResults(prev => [...prev, ...next]);
        setHasMore(d.hasMore ?? false);
        offsetRef.current += next.length;
      })
      .catch(() => {})
      .finally(() => setLoadMore(false));
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && results.length === 0) {
    return (
      <div className="py-14 flex flex-col items-center gap-3">
        <Sliders size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
        <p className="text-sm" style={{ color: "#666" }}>
          No tracks match this sound profile yet.
        </p>
        <p className="text-xs" style={{ color: "#444" }}>
          Try adjusting the radar or resetting filters.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Loading overlay — keeps existing cards visible */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
          style={{ background: "rgba(10,10,10,0.6)", backdropFilter: "blur(2px)" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      )}

      {/* Result count */}
      {!loading && total > 0 && (
        <p className="text-xs mb-4" style={{ color: "#666" }}>
          {total} result{total !== 1 ? "s" : ""} matched
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {results.map(r => (
          <ResultCard key={r.id} result={r} onPlay={onPlay} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={fetchMore}
            disabled={loadMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ border: "1px solid rgba(212,168,67,0.35)", color: "#D4A843", background: "transparent" }}
          >
            {loadMore
              ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
              : "Load More"
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Individual result card ────────────────────────────────────────────────────

function ResultCard({
  result,
  onPlay,
}: {
  result:  FilterResult;
  onPlay:  RadarFilterResultsProps["onPlay"];
}) {
  const matchPct = Math.round(result.similarity * 100);
  const { openOverlay: open } = useTrackOverlay();

  const cardData: TrackCardData = {
    id:            result.id,
    title:         result.title,
    coverArtUrl:   result.artworkUrl,
    canvasVideoUrl: null,
    fileUrl:       result.fileUrl,
    genre:         result.genre,
    bpm:           result.bpm,
    musicalKey:    result.key,
    artist: {
      id:          "",
      name:        result.artistName,
      artistSlug:  result.artistSlug,
    },
  };

  return (
    <motion.div
      className="rounded-xl border flex flex-col overflow-hidden transition-[border-color] hover:border-[rgba(212,168,67,0.35)] cursor-pointer"
      style={{ background: "#111111", borderColor: "#1A1A1A" }}
      whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={() => open(cardData)}
    >
      {/* Artwork + play overlay */}
      <HoverCardCover
        id={result.id}
        coverArtUrl={result.artworkUrl}
        onPlay={(e) => { e.stopPropagation(); onPlay(result.id, result.title, result.artistName, result.fileUrl, result.artworkUrl ?? undefined); }}
        className="relative aspect-square overflow-hidden"
      >
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(0,0,0,0.7)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.4)" }}>
          {matchPct}% match
        </div>
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
          style={{ background: "rgba(0,0,0,0.7)", color: "#888" }}>
          {result.type}
        </div>
      </HoverCardCover>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold truncate" style={{ color: "#FFFFFF" }}>{result.title}</p>
          {result.artistSlug ? (
            <Link href={`/${result.artistSlug}`} className="text-xs truncate hover:underline block" style={{ color: "#888" }} onClick={e => e.stopPropagation()}>
              {result.artistName}
            </Link>
          ) : (
            <p className="text-xs truncate" style={{ color: "#888" }}>{result.artistName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {result.genre && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(212,168,67,0.1)", color: "#D4A843" }}>{result.genre}</span>}
          {result.mood  && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#666" }}>{result.mood}</span>}
        </div>
        {(result.bpm || result.key) && (
          <p className="text-[10px]" style={{ color: "#555" }}>
            {[result.bpm && `${result.bpm} BPM`, result.key].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex justify-center mt-auto pt-1">
          <AudioFeaturesRadar features={result.features} size="sm" animated={false} />
        </div>
      </div>

    </motion.div>
  );
}
