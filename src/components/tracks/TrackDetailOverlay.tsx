"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useExpandedCard, type TrackCardData } from "@/store/expandedCard";
import { useAudioStore } from "@/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";

// ── Types ─────────────────────────────────────────────────────────────────────

type OverlayDetail = {
  id:             string;
  title:          string;
  fileUrl:        string;
  coverArtUrl:    string | null;
  canvasVideoUrl: string | null;
  bpm:            number | null;
  musicalKey:     string | null;
  genre:          string | null;
  producer:       string | null;
  songwriter:     string | null;
  featuredArtists:string | null;
  artist: { name: string; slug: string | null };
  audioFeatures: {
    energy: number; danceability: number; valence: number;
    acousticness: number; instrumentalness: number;
    liveness: number; speechiness: number; loudness: number;
    mood: string | null; genre: string | null;
  } | null;
  djPickCount:    number;
  digitalProduct: { id: string; price: number; title: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, backgroundColor: "#1A1A1A", margin: "16px 0" }} />;
}

// ── Scrubber with draggable handle ────────────────────────────────────────────

function Scrubber() {
  const { currentTime, duration, seekTo } = useAudioStore();
  const [dragging, setDragging]           = useState(false);
  const [dragPct, setDragPct]             = useState<number | null>(null);
  const trackRef                          = useRef<HTMLDivElement>(null);

  const pct = dragging && dragPct !== null
    ? dragPct
    : duration > 0 ? (currentTime / duration) * 100 : 0;

  function pctFromEvent(clientX: number) {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    setDragPct(pctFromEvent(e.clientX));
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) { setDragPct(pctFromEvent(e.clientX)); }
    function onUp(e: MouseEvent) {
      const p = pctFromEvent(e.clientX);
      seekTo((p / 100) * duration);
      setDragging(false);
      setDragPct(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, duration]);

  return (
    <div
      ref={trackRef}
      className="relative w-full cursor-pointer select-none"
      style={{ height: 18, display: "flex", alignItems: "center" }}
      onMouseDown={onMouseDown}
    >
      {/* Track */}
      <div className="w-full rounded-full" style={{ height: 2, backgroundColor: "#333" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#D4A843", borderRadius: 999 }} />
      </div>
      {/* Handle */}
      <div
        style={{
          position:        "absolute",
          left:            `${pct}%`,
          transform:       "translateX(-50%)",
          width:           10,
          height:          10,
          borderRadius:    "50%",
          backgroundColor: "#D4A843",
          pointerEvents:   "none",
        }}
      />
    </div>
  );
}

// ── Transport (rewind, play/pause, forward + scrubber + time) ─────────────────

function Transport({ data }: { data: TrackCardData }) {
  const { play, pause, resume, seekTo, currentTrack, isPlaying, currentTime, duration } =
    useAudioStore();

  const isLoaded      = currentTrack?.id === data.id;
  const isThisPlaying = isLoaded && isPlaying;

  function handlePlayPause() {
    if (!isLoaded) {
      play({ id: data.id, title: data.title, artist: data.artist.name,
             src: data.fileUrl, coverArt: data.coverArtUrl ?? undefined });
    } else {
      isThisPlaying ? pause() : resume();
    }
  }

  function rewind()  { if (isLoaded) seekTo(Math.max(0, currentTime - 10)); }
  function forward() { if (isLoaded) seekTo(Math.min(duration, currentTime + 10)); }

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {/* Buttons row */}
      <div className="flex items-center justify-center gap-6">
        <button onClick={rewind} aria-label="Rewind 10s"
          className="transition-opacity hover:opacity-70"
          style={{ color: "#888" }}>
          <SkipBack size={22} />
        </button>
        <button onClick={handlePlayPause} aria-label={isThisPlaying ? "Pause" : "Play"}
          className="transition-opacity hover:opacity-80"
          style={{ color: "#D4A843" }}>
          {isThisPlaying
            ? <Pause size={30} fill="#D4A843" />
            : <Play  size={30} fill="#D4A843" style={{ marginLeft: 2 }} />
          }
        </button>
        <button onClick={forward} aria-label="Forward 10s"
          className="transition-opacity hover:opacity-70"
          style={{ color: "#888" }}>
          <SkipForward size={22} />
        </button>
      </div>

      {/* Scrubber + time */}
      <div className="flex items-center gap-2">
        <Scrubber />
        <span className="shrink-0 tabular-nums text-[11px]" style={{ color: "#666", fontFamily: "DM Sans, sans-serif", minWidth: 80, textAlign: "right" }}>
          {isLoaded ? fmt(currentTime) : "0:00"} / {isLoaded && duration > 0 ? fmt(duration) : "--:--"}
        </span>
      </div>
    </div>
  );
}

// ── Panel (desktop + mobile share this layout) ────────────────────────────────

function Panel({
  data,
  detail,
  dominantColor,
  onClose,
}: {
  data:          TrackCardData;
  detail:        OverlayDetail | null;
  dominantColor: [number, number, number] | null;
  onClose:       () => void;
}) {
  const { data: session } = useSession();
  const isDJ = (session?.user as { djMode?: boolean })?.djMode === true;

  // Resolved values — prefer detail (full API data) over TrackCardData
  const artistSlug      = detail?.artist.slug ?? data.artist.artistSlug;
  const bpm             = detail?.bpm          ?? data.bpm;
  const musicalKey      = detail?.musicalKey   ?? data.musicalKey;
  const genre           = detail?.genre ?? detail?.audioFeatures?.genre ?? data.genre;
  const mood            = detail?.audioFeatures?.mood ?? null;
  const producer        = detail?.producer        ?? null;
  const songwriter      = detail?.songwriter      ?? null;
  const featuredArtists = detail?.featuredArtists ?? null;
  const djPickCount     = detail?.djPickCount     ?? 0;
  const dp              = detail?.digitalProduct  ?? null;
  const hasCredits      = !!(producer || songwriter || featuredArtists);

  const pills = [
    bpm        ? `${bpm} BPM`  : null,
    musicalKey ?? null,
    genre      ?? null,
    mood       ?? null,
  ].filter((p): p is string => !!p);

  // Gradient style from dominant color
  const gradientStyle = dominantColor
    ? `linear-gradient(to bottom, transparent 0%, rgba(${dominantColor[0]},${dominantColor[1]},${dominantColor[2]},0.50) 60%, #111111 100%)`
    : "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 60%, #111111 100%)";

  // Scrollable content sections (with dividers between them)
  const sections: React.ReactNode[] = [];

  if (pills.length > 0) {
    sections.push(
      <div key="pills" className="flex flex-wrap justify-center gap-1.5">
        {pills.map(p => (
          <span key={p} style={{ backgroundColor: "#222", color: "#999", fontSize: 11,
            fontFamily: "DM Sans, sans-serif", borderRadius: 999, padding: "6px 12px" }}>
            {p}
          </span>
        ))}
      </div>
    );
  }

  if (hasCredits) {
    sections.push(
      <div key="credits" className="space-y-1.5">
        <p style={{ color: "#D4A843", fontSize: 13, fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>
          Credits
        </p>
        {producer && (
          <p style={{ fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
            <span style={{ color: "#666" }}>Producer  </span>
            <span style={{ color: "#ccc" }}>{producer}</span>
          </p>
        )}
        {songwriter && (
          <p style={{ fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
            <span style={{ color: "#666" }}>Songwriter  </span>
            <span style={{ color: "#ccc" }}>{songwriter}</span>
          </p>
        )}
        {featuredArtists && (
          <p style={{ fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
            <span style={{ color: "#666" }}>Featured  </span>
            <span style={{ color: "#ccc" }}>{featuredArtists}</span>
          </p>
        )}
      </div>
    );
  }

  if (detail?.audioFeatures) {
    sections.push(
      <div key="radar" className="flex justify-center">
        <LazyAudioRadar trackId={data.id} size="sm" />
      </div>
    );
  }

  if (djPickCount >= 3) {
    sections.push(
      <p key="badge" className="text-center"
        style={{ color: "#D4A843", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>
        Picked by {djPickCount} DJs
      </p>
    );
  }

  // Action buttons
  const viewArtistOnly = !dp && !isDJ;
  sections.push(
    <div key="actions"
      className={`flex items-center gap-2 flex-wrap ${viewArtistOnly ? "" : "justify-center"}`}
      style={{ paddingBottom: 8 }}
    >
      {dp && (
        <Link
          href={`/buy/${dp.id}`}
          className="flex items-center justify-center px-5 h-10 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "#E85D4A", color: "#fff", fontFamily: "DM Sans, sans-serif" }}
          onClick={onClose}
        >
          Buy — ${dp.price.toFixed(2)}
        </Link>
      )}
      {isDJ && <AddToCrateButton trackId={data.id} />}
      {artistSlug && (
        <Link
          href={`/${artistSlug}`}
          className={`text-[13px] rounded-lg px-4 h-10 flex items-center hover:opacity-80 ${viewArtistOnly ? "w-full justify-center" : ""}`}
          style={{ backgroundColor: "#222", color: "#aaa", fontFamily: "DM Sans, sans-serif" }}
          onClick={onClose}
        >
          View Artist
        </Link>
      )}
    </div>
  );

  const coverSrc = data.canvasVideoUrl || data.coverArtUrl;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#111111", overflow: "hidden" }}>

      {/* ── Cover art / canvas + gradient + title overlay ── */}
      <div className="relative flex-shrink-0" style={{ maxHeight: 280, overflow: "hidden" }}>

        {/* Media */}
        {data.canvasVideoUrl ? (
          <video
            src={data.canvasVideoUrl}
            autoPlay loop muted playsInline
            className="w-full object-cover"
            style={{ maxHeight: 280, display: "block" }}
          />
        ) : data.coverArtUrl ? (
          <img
            src={data.coverArtUrl}
            alt={data.title}
            crossOrigin="anonymous"
            className="w-full object-cover"
            style={{ maxHeight: 280, display: "block" }}
          />
        ) : (
          <div className="w-full flex items-center justify-center"
            style={{ height: 220, backgroundColor: "#0a0a0a" }}>
            <span style={{ color: "#D4A843", fontSize: 64, fontWeight: 900 }}>♪</span>
          </div>
        )}

        {/* Gradient bleed into panel background */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: "60%", background: gradientStyle, pointerEvents: "none" }}
        />

        {/* X button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/20"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          aria-label="Close"
        >
          <X size={15} color="#fff" />
        </button>

        {/* Title + artist overlapping gradient */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3 text-center">
          <h2
            className="text-[22px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
          >
            {data.title}
          </h2>
          <div className="mt-0.5">
            {artistSlug ? (
              <Link
                href={`/${artistSlug}`}
                className="text-[14px] hover:underline"
                style={{ color: "#aaa", fontFamily: "DM Sans, sans-serif" }}
                onClick={onClose}
              >
                {data.artist.name}
              </Link>
            ) : (
              <span className="text-[14px]" style={{ color: "#aaa", fontFamily: "DM Sans, sans-serif" }}>
                {data.artist.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Transport ── */}
      <div className="flex-shrink-0 pt-3">
        <Transport data={data} />
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-6"
        style={{ scrollbarWidth: "none" }}
      >
        <style>{`.overlay-scroll::-webkit-scrollbar { display: none; }`}</style>
        {sections.map((section, i) => (
          <div key={i}>
            {i > 0 && <Divider />}
            {section}
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TrackDetailOverlay() {
  const { overlayData, close }              = useExpandedCard();
  const isMobile                            = useIsMobile();
  const [detail, setDetail]                 = useState<OverlayDetail | null>(null);
  const [dominantColor, setDominantColor]   = useState<[number, number, number] | null>(null);
  const loadedIdRef                         = useRef<string | null>(null);

  // Fetch overlay data when a track opens
  useEffect(() => {
    if (!overlayData) { setDetail(null); setDominantColor(null); return; }
    if (loadedIdRef.current === overlayData.id) return;
    loadedIdRef.current = overlayData.id;
    setDetail(null);
    fetch(`/api/tracks/${overlayData.id}/overlay`)
      .then(r => r.json())
      .then((d: OverlayDetail) => setDetail(d))
      .catch(() => {});
  }, [overlayData?.id]);

  // Extract dominant color from cover art via manual canvas — no third-party library.
  // Prefer the API-fetched detail URL so cards that open without art still get color.
  useEffect(() => {
    const url = detail?.coverArtUrl ?? overlayData?.coverArtUrl;
    if (!url || !url.trim()) { setDominantColor(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
      try {
        const SIZE = 12;
        const canvas = document.createElement("canvas");
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
        if (!cancelled) setDominantColor([Math.round(r/n), Math.round(g/n), Math.round(b/n)]);
      } catch { if (!cancelled) setDominantColor(null); }
    };
    img.onerror = () => { if (!cancelled) setDominantColor(null); };
    img.src = url;
    return () => { cancelled = true; img.onload = null; img.onerror = null; };
  // Re-run when detail loads (may have cover art the initial card data didn't)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.coverArtUrl ?? overlayData?.coverArtUrl]);

  // Escape key
  useEffect(() => {
    if (!overlayData) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!overlayData]);

  // Scroll lock
  useEffect(() => {
    if (!overlayData) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [!!overlayData]);

  if (typeof window === "undefined") return null;

  const content = overlayData ? (
    <Panel
      data={overlayData}
      detail={detail}
      dominantColor={dominantColor}
      onClose={close}
    />
  ) : null;

  return createPortal(
    <AnimatePresence>
      {overlayData && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[998]"
            style={{ backgroundColor: "rgba(0,0,0,0.70)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />

          {isMobile ? (
            /* Mobile: full-screen bottom sheet */
            <motion.div
              key="sheet"
              className="fixed inset-0 z-[999]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.25 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 400) close();
              }}
            >
              {content}
            </motion.div>
          ) : (
            /* Desktop: centered floating panel */
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="panel"
                className="pointer-events-auto w-full"
                style={{
                  maxWidth:     480,
                  maxHeight:    "85vh",
                  borderRadius: 16,
                  border:       "1px solid #1A1A1A",
                  overflow:     "hidden",
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {content}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
