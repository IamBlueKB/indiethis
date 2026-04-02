"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { useExpandedCard, type TrackCardData } from "@/store/expandedCard";
import { useAudioStore } from "@/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";
import BeatLicenseModal from "@/components/beats/BeatLicenseModal";

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
  price:          number | null;
  beatLeaseSettings: { streamLeaseEnabled: boolean } | null;
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

  // Fix 4: BPM-synced pulse — one beat = 60/bpm seconds; default 120 BPM
  const beatDuration = 60 / (data.bpm || 120);

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
      {/* BPM pulse keyframes — injected once per Transport render */}
      <style>{`
        @keyframes bpm-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(212,168,67,0.45); }
          50%  { box-shadow: 0 0 18px 8px rgba(212,168,67,0.12); }
          100% { box-shadow: 0 0 0 0 rgba(212,168,67,0); }
        }
      `}</style>

      {/* Buttons row */}
      <div className="flex items-center justify-center gap-6">
        <button onClick={rewind} aria-label="Rewind 10s"
          className="transition-opacity hover:opacity-70"
          style={{ color: "#888" }}>
          <SkipBack size={22} />
        </button>

        {/* Fix 4: glow wrapper pulses at BPM tempo only when paused */}
        <div
          style={{
            borderRadius: "50%",
            padding: 6,
            animation: !isThisPlaying ? `bpm-pulse ${beatDuration}s ease-in-out infinite` : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button onClick={handlePlayPause} aria-label={isThisPlaying ? "Pause" : "Play"}
            className="transition-opacity hover:opacity-80"
            style={{ color: "#D4A843" }}>
            {isThisPlaying
              ? <Pause size={30} fill="#D4A843" />
              : <Play  size={30} fill="#D4A843" style={{ marginLeft: 2 }} />
            }
          </button>
        </div>

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
  const [showLicense, setShowLicense] = useState(false);
  // Fix 5: parallax — artwork ref driven by scroll position
  const artworkRef = useRef<HTMLDivElement>(null);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (artworkRef.current) {
      const offset = Math.min(e.currentTarget.scrollTop * 0.5, 100);
      artworkRef.current.style.transform = `translateY(-${offset}px)`;
    }
  }

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
  const isBeat          = !!(detail?.beatLeaseSettings || detail?.price);

  const pills = [
    bpm        ? `${bpm} BPM`  : null,
    musicalKey ?? null,
    genre      ?? null,
    mood       ?? null,
  ].filter((p): p is string => !!p);

  // Fix 2: stronger gradient — color washes further down into the panel
  const [r, g, b] = dominantColor ?? [0, 0, 0];
  const gradientStyle = dominantColor
    ? `linear-gradient(to bottom, transparent 0%, rgba(${r},${g},${b},0.4) 40%, rgba(${r},${g},${b},0.25) 70%, #111111 100%)`
    : "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 70%, #111111 100%)";
  // Continuation bleed into the content area below the artwork
  const bleedGradient = dominantColor
    ? `linear-gradient(to bottom, rgba(${r},${g},${b},0.15) 0%, transparent 100%)`
    : null;

  // Scrollable-only sections: credits, DJ badge (radar moved up — Fix 3)
  const scrollSections: React.ReactNode[] = [];

  if (hasCredits) {
    scrollSections.push(
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

  if (djPickCount >= 3) {
    scrollSections.push(
      <p key="badge" className="text-center"
        style={{ color: "#D4A843", fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>
        Picked by {djPickCount} DJs
      </p>
    );
  }

  // Fix 1: prefer API-loaded detail URL so tracks without canvas in store still show video
  const canvasVideoUrl = detail?.canvasVideoUrl || data.canvasVideoUrl || null;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: "#111111", overflow: "hidden" }}>

      {/* ── Fix 5: Artwork — parallax target, NOT inside scroll container ── */}
      <div
        ref={artworkRef}
        className="relative flex-shrink-0"
        style={{ maxHeight: "min(280px, 40vh)", overflow: "hidden", willChange: "transform" }}
      >
        {/* Media */}
        {canvasVideoUrl ? (
          <video
            src={canvasVideoUrl}
            autoPlay loop muted playsInline
            className="w-full object-cover"
            style={{ maxHeight: "min(280px, 40vh)", display: "block" }}
          />
        ) : data.coverArtUrl ? (
          <img
            src={data.coverArtUrl}
            alt={data.title}
            crossOrigin="anonymous"
            className="w-full object-cover"
            style={{ maxHeight: "min(280px, 40vh)", display: "block" }}
          />
        ) : (
          <div className="w-full flex items-center justify-center"
            style={{ height: 220, backgroundColor: "#0a0a0a" }}>
            <span style={{ color: "#D4A843", fontSize: 64, fontWeight: 900 }}>♪</span>
          </div>
        )}

        {/* Fix 2: Gradient bleed — stronger, reaches further down */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: "80%", background: gradientStyle, pointerEvents: "none" }}
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

      {/* ── Fix 5: Scrollable content — everything below artwork ── */}
      {/* Fix 2: bleedGradient as background so it's always visible at the top of the scroll area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          scrollbarWidth: "none",
          backgroundColor: "#111111",
          backgroundImage: bleedGradient ?? undefined,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 150px",
        }}
        onScroll={handleScroll}
      >
        {/* ── Transport ── */}
        <div className="pt-3" style={{ position: "relative" }}>
          <Transport data={data} />
        </div>

        {/* ── Pills ── */}
        {pills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-3 pb-1">
            {pills.map(p => (
              <span key={p} style={{ backgroundColor: "#222", color: "#999", fontSize: 11,
                fontFamily: "DM Sans, sans-serif", borderRadius: 999, padding: "6px 12px" }}>
                {p}
              </span>
            ))}
          </div>
        )}

        {/* ── Fix 3: Sound DNA radar — above action buttons ── */}
        {detail?.audioFeatures && (
          <div className="flex flex-col items-center px-4 pt-4 pb-2">
            <p style={{ color: "#D4A843", fontSize: 13, fontFamily: "DM Sans, sans-serif",
              fontWeight: 600, marginBottom: 10 }}>
              Sound DNA
            </p>
            <LazyAudioRadar trackId={data.id} size="sm" />
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex items-center justify-center gap-2 flex-wrap px-4 pt-2 pb-2">
          {isBeat && (
            <button
              onClick={() => setShowLicense(true)}
              className="flex items-center justify-center px-5 h-10 rounded-lg text-sm font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "#E85D4A", color: "#fff", fontFamily: "DM Sans, sans-serif" }}
            >
              License{detail?.price ? ` — $${detail.price.toFixed(2)}` : ""}
            </button>
          )}
          {dp && !isBeat && (
            <Link
              href={`/buy/${dp.id}`}
              className="flex items-center justify-center px-5 h-10 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#E85D4A", color: "#fff", fontFamily: "DM Sans, sans-serif" }}
              onClick={onClose}
            >
              Buy — ${dp.price.toFixed(2)}
            </Link>
          )}
          <AddToCrateButton trackId={data.id} />
          {artistSlug && (
            <Link
              href={`/${artistSlug}`}
              className="text-[13px] rounded-lg px-4 h-10 flex items-center hover:opacity-80"
              style={{ backgroundColor: "#222", color: "#aaa", fontFamily: "DM Sans, sans-serif" }}
              onClick={onClose}
            >
              View Artist
            </Link>
          )}
        </div>

        {/* ── Credits + DJ badge — scrollable content below action buttons ── */}
        {scrollSections.length > 0 && (
          <div className="px-4 pb-6" style={{ borderTop: "1px solid #1a1a1a" }}>
            {scrollSections.map((section, i) => (
              <div key={i}>
                {i > 0 && <Divider />}
                {i === 0 && <div style={{ height: 12 }} />}
                {section}
              </div>
            ))}
          </div>
        )}

        {/* Bottom breathing room */}
        <div style={{ height: 24 }} />
      </div>

      {/* ── Beat license modal — portaled above overlay ── */}
      {showLicense && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1100 }}>
          <BeatLicenseModal
            track={{
              id:                 data.id,
              title:              data.title,
              price:              detail?.price ?? null,
              coverArtUrl:        data.coverArtUrl ?? null,
              streamLeaseEnabled: detail?.beatLeaseSettings?.streamLeaseEnabled ?? false,
              artist: {
                name:       data.artist.name,
                artistName: null,
                artistSlug: artistSlug ?? null,
              },
            }}
            onClose={() => setShowLicense(false)}
          />
        </div>,
        document.body
      )}

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
    if (!overlayData) { setDetail(null); setDominantColor(null); loadedIdRef.current = null; return; }
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

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
              style={{ display: "flex", flexDirection: "column" }}
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
                  height:       "85vh",
                  maxHeight:    "85vh",
                  borderRadius: 16,
                  border:       "1px solid #1A1A1A",
                  overflow:     "hidden",
                  display:      "flex",
                  flexDirection: "column",
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
