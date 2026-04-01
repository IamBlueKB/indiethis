"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause } from "lucide-react";
import Link from "next/link";
import { FastAverageColor } from "fast-average-color";
import { useExpandedCard, type TrackCardData } from "@/store/expandedCard";
import { useAudioStore } from "@/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardDetail = {
  producer:         string | null;
  songwriter:       string | null;
  digitalProductId: string | null;
  crateCount:       number;
  artistPhoto:      string | null;
  artistSlug:       string | null;
  artistBio:        string | null;
  artistGenre:      string | null;
  artistRole:       string | null;
  artistCity:       string | null;
};

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: "#1A1A1A",
        marginTop: 16,
        marginBottom: 16,
      }}
    />
  );
}

// ── Play / Pause button ───────────────────────────────────────────────────────

function PlayButton({ data }: { data: TrackCardData }) {
  const { play, pause, resume, currentTrack, isPlaying } = useAudioStore();
  const isLoaded      = currentTrack?.id === data.id;
  const isThisPlaying = isLoaded && isPlaying;

  function handlePlayPause() {
    if (!isLoaded) {
      play({
        id:       data.id,
        title:    data.title,
        artist:   data.artist.name,
        src:      data.fileUrl,
        coverArt: data.coverArtUrl ?? undefined,
      });
    } else {
      isThisPlaying ? pause() : resume();
    }
  }

  return (
    <button
      onClick={handlePlayPause}
      className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
      style={{
        border:          "1.5px solid #D4A843",
        color:           "#D4A843",
        backgroundColor: "transparent",
        fontFamily:      "DM Sans, sans-serif",
      }}
    >
      {isThisPlaying ? (
        <><Pause size={14} fill="#D4A843" color="#D4A843" /> Pause</>
      ) : (
        <><Play size={14} fill="#D4A843" color="#D4A843" style={{ marginLeft: 1 }} /> Play</>
      )}
    </button>
  );
}

// ── Panel content (shared desktop + mobile) ───────────────────────────────────

function Panel({
  data,
  detail,
  dominantColor,
  onClose,
}: {
  data:          TrackCardData;
  detail:        CardDetail | null;
  dominantColor: [number, number, number] | null;
  onClose:       () => void;
}) {
  // artistSlug: prefer the one from card-detail (respects isPublished),
  // fall back to the one already in TrackCardData
  const artistSlug =
    detail?.artistSlug ??
    (data.artist.artistSite != null
      ? data.artist.artistSite.isPublished ? data.artist.artistSlug : null
      : data.artist.artistSlug);

  const pills = [
    data.bpm       ? `${data.bpm} BPM` : null,
    data.musicalKey ?? null,
    data.genre     ?? null,
    data.mood      ?? null,
  ].filter((p): p is string => !!p);

  const hasBuyButton = !!detail?.digitalProductId;
  const showDJBadge  = (detail?.crateCount ?? 0) >= 3;
  const hasCredits   = !!(detail?.producer || detail?.songwriter);
  const hasArtistInfo = !!(detail?.artistBio || detail?.artistGenre || detail?.artistRole || detail?.artistCity);

  // Build scroll sections to interleave dividers correctly
  const sections: React.ReactNode[] = [];

  if (pills.length > 0) {
    sections.push(
      <div key="pills" className="flex flex-wrap justify-center gap-1.5">
        {pills.map((p) => (
          <span
            key={p}
            className="text-[11px] px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "#222", color: "#999", fontFamily: "DM Sans, sans-serif" }}
          >
            {p}
          </span>
        ))}
      </div>
    );
  }

  if (hasCredits) {
    sections.push(
      <div key="credits" className="space-y-1.5">
        <p className="text-[13px] font-semibold" style={{ color: "#D4A843", fontFamily: "DM Sans, sans-serif" }}>
          Credits
        </p>
        {detail!.producer && (
          <p className="text-[13px]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            <span style={{ color: "#666" }}>Producer  </span>
            <span style={{ color: "#ccc" }}>{detail!.producer}</span>
          </p>
        )}
        {detail!.songwriter && (
          <p className="text-[13px]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            <span style={{ color: "#666" }}>Songwriter  </span>
            <span style={{ color: "#ccc" }}>{detail!.songwriter}</span>
          </p>
        )}
      </div>
    );
  }

  // Radar — always include; LazyAudioRadar renders null if no features exist
  sections.push(
    <div key="radar" className="flex justify-center">
      <LazyAudioRadar trackId={data.id} size="sm" />
    </div>
  );

  if (showDJBadge) {
    sections.push(
      <p key="badge" className="text-center text-[12px]" style={{ color: "#D4A843", fontFamily: "DM Sans, sans-serif" }}>
        Picked by {detail!.crateCount} DJs
      </p>
    );
  }

  if (hasArtistInfo) {
    sections.push(
      <div key="artist-info" className="space-y-2">
        <p className="text-[13px] font-semibold" style={{ color: "#D4A843", fontFamily: "DM Sans, sans-serif" }}>
          About the Artist
        </p>
        {detail!.artistPhoto && (
          <div className="flex items-center gap-3">
            <img
              src={detail!.artistPhoto}
              alt={data.artist.name}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
            <div>
              <p className="text-[13px] font-medium text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
                {data.artist.name}
              </p>
              {(detail!.artistRole || detail!.artistCity) && (
                <p className="text-[11px]" style={{ color: "#666", fontFamily: "DM Sans, sans-serif" }}>
                  {[detail!.artistRole, detail!.artistCity].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        )}
        {detail!.artistBio && (
          <p
            className="text-[13px] leading-relaxed line-clamp-4"
            style={{ color: "#888", fontFamily: "DM Sans, sans-serif" }}
          >
            {detail!.artistBio}
          </p>
        )}
      </div>
    );
  }

  // Actions — Buy, Add to Crate, View Artist
  sections.push(
    <div key="actions" className="flex items-center justify-center gap-3 flex-wrap">
      {hasBuyButton && (
        <Link
          href={`/buy/${detail!.digitalProductId}`}
          className="flex items-center justify-center px-5 h-10 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "#E85D4A", color: "#fff", fontFamily: "DM Sans, sans-serif" }}
          onClick={onClose}
        >
          Buy
        </Link>
      )}
      <AddToCrateButton trackId={data.id} />
      {artistSlug && (
        <Link
          href={`/${artistSlug}`}
          className="text-[13px] hover:underline"
          style={{ color: "#888", fontFamily: "DM Sans, sans-serif" }}
          onClick={onClose}
        >
          View Artist
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: "#111111" }}>

      {/* Gradient bleed from artwork dominant color */}
      {dominantColor && (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: 300,
            zIndex: 0,
            background: `linear-gradient(to bottom, rgba(${dominantColor[0]},${dominantColor[1]},${dominantColor[2]},0.30) 0%, transparent 100%)`,
          }}
        />
      )}

      {/* ── Fixed header (does not scroll) ── */}
      <div className="relative z-10 flex-shrink-0 px-4 pt-4 pb-4">

        {/* X button — fixed top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 20 }}
        >
          <X size={15} style={{ color: "#ccc" }} />
        </button>

        {/* Cover art / canvas — 200×200, centered */}
        <div className="flex justify-center mb-3">
          <div
            className="overflow-hidden"
            style={{ width: 200, height: 200, borderRadius: 12, flexShrink: 0 }}
          >
            {data.canvasVideoUrl ? (
              <video
                src={data.canvasVideoUrl}
                autoPlay loop muted playsInline
                className="w-full h-full object-cover"
              />
            ) : data.coverArtUrl ? (
              <img
                src={data.coverArtUrl}
                alt={data.title}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: "#0f0f0f" }}
              >
                <span className="text-4xl font-black" style={{ color: "#D4A843" }}>♪</span>
              </div>
            )}
          </div>
        </div>

        {/* Track title */}
        <h2
          className="text-[20px] font-bold text-white text-center leading-tight mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {data.title}
        </h2>

        {/* Artist name */}
        <div className="text-center mb-3">
          {artistSlug ? (
            <Link
              href={`/${artistSlug}`}
              className="text-[14px] hover:underline"
              style={{ color: "#888", fontFamily: "DM Sans, sans-serif" }}
              onClick={onClose}
            >
              {data.artist.name}
            </Link>
          ) : (
            <p className="text-[14px]" style={{ color: "#888", fontFamily: "DM Sans, sans-serif" }}>
              {data.artist.name}
            </p>
          )}
        </div>

        {/* Play / Pause */}
        <PlayButton data={data} />
      </div>

      {/* ── Scrollable body ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6">
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
  const { overlayData, close } = useExpandedCard();
  const isMobile               = useIsMobile();
  const [detail, setDetail]    = useState<CardDetail | null>(null);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);

  // Fetch card detail when a track is opened
  useEffect(() => {
    if (!overlayData) { setDetail(null); return; }
    fetch(`/api/tracks/${overlayData.id}/card-detail`)
      .then(r => r.json())
      .then((d: CardDetail) => setDetail(d))
      .catch(() => setDetail(null));
  }, [overlayData?.id]);

  // Extract dominant color from cover art
  useEffect(() => {
    if (!overlayData?.coverArtUrl) { setDominantColor(null); return; }
    const fac = new FastAverageColor();
    fac.getColorAsync(overlayData.coverArtUrl)
      .then(color => setDominantColor([color.value[0], color.value[1], color.value[2]]))
      .catch(() => setDominantColor(null));
  }, [overlayData?.id]);

  // Escape key
  useEffect(() => {
    if (!overlayData) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!overlayData]);

  // Body scroll lock
  useEffect(() => {
    if (!overlayData) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [!!overlayData]);

  if (typeof window === "undefined") return null;

  const panelContent = overlayData ? (
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
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />

          {isMobile ? (
            /* Mobile: full-screen slide-up, swipe down to dismiss */
            <motion.div
              key="mobile-panel"
              className="fixed inset-0 z-[999] overflow-hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_e, info) => {
                if (info.velocity.y > 400 || info.offset.y > 100) close();
              }}
            >
              {panelContent}
            </motion.div>
          ) : (
            /* Desktop: centered floating panel */
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="desktop-panel"
                className="pointer-events-auto w-full overflow-hidden"
                style={{
                  maxWidth:     480,
                  maxHeight:    "85vh",
                  borderRadius: 16,
                  border:       "1px solid #1A1A1A",
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {panelContent}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
