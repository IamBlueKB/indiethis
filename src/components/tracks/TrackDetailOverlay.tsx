"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { useExpandedCard, type TrackCardData } from "@/store/expandedCard";
import { useAudioStore } from "@/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";

// ── Types ──────────────────────────────────────────────────────────────────────

type CardDetail = {
  producer:         string | null;
  songwriter:       string | null;
  digitalProductId: string | null;
  crateCount:       number;
};

// ── Shared panel content ───────────────────────────────────────────────────────

function PanelContent({
  data,
  detail,
  onClose,
}: {
  data:    TrackCardData;
  detail:  CardDetail | null;
  onClose: () => void;
}) {
  const { play, pause, currentTrack, isPlaying } = useAudioStore();
  const isThisPlaying = currentTrack?.id === data.id && isPlaying;

  // Respect artistSite.isPublished if provided; otherwise use slug as-is
  const artistSlug =
    data.artist.artistSite != null
      ? data.artist.artistSite.isPublished ? data.artist.artistSlug : null
      : data.artist.artistSlug;

  const pills = [
    data.bpm       ? `${data.bpm} BPM` : null,
    data.musicalKey ?? null,
    data.genre     ?? null,
    data.mood      ?? null,
  ].filter((p): p is string => !!p);

  const hasBuyButton = !!detail?.digitalProductId;
  const showDJBadge  = (detail?.crateCount ?? 0) >= 3;
  const hasCredits   = !!(detail?.producer || detail?.songwriter);

  function handlePlay() {
    if (isThisPlaying) {
      pause();
    } else {
      play({
        id:       data.id,
        title:    data.title,
        artist:   data.artist.name,
        src:      data.fileUrl,
        coverArt: data.coverArtUrl ?? undefined,
      });
    }
  }

  return (
    <div className="relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <X size={16} style={{ color: "#ccc" }} />
      </button>

      {/* Cover art / canvas video — shown once, full width */}
      <div className="w-full aspect-square overflow-hidden">
        {data.canvasVideoUrl ? (
          <video
            src={data.canvasVideoUrl}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
          />
        ) : data.coverArtUrl ? (
          <img src={data.coverArtUrl} alt={data.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0f0f0f" }}>
            <span className="text-6xl font-black" style={{ color: "#D4A843" }}>♪</span>
          </div>
        )}
      </div>

      {/* All detail content */}
      <div className="px-4 py-4 space-y-4">

        {/* Track title + artist */}
        <div>
          <h2
            className="text-xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {data.title}
          </h2>
          {artistSlug ? (
            <Link
              href={`/${artistSlug}`}
              className="text-sm hover:underline mt-0.5 block"
              style={{ color: "#888" }}
              onClick={onClose}
            >
              {data.artist.name}
            </Link>
          ) : (
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>{data.artist.name}</p>
          )}
        </div>

        {/* Play button */}
        <button
          onClick={handlePlay}
          className="w-full h-11 rounded-lg text-sm font-semibold transition-colors hover:bg-[rgba(212,168,67,0.08)]"
          style={{ border: "1px solid #D4A843", color: "#D4A843" }}
        >
          {isThisPlaying ? "Pause" : "Play in Player"}
        </button>

        {/* Metadata pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((p) => (
              <span
                key={p}
                className="text-[11px] px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "#222", color: "#999" }}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Credits */}
        {hasCredits && (
          <div className="space-y-1">
            <p className="text-[13px] font-semibold" style={{ color: "#D4A843" }}>Credits</p>
            {detail!.producer && (
              <p className="text-[13px]">
                <span style={{ color: "#666" }}>Producer  </span>
                <span style={{ color: "#ccc" }}>{detail!.producer}</span>
              </p>
            )}
            {detail!.songwriter && (
              <p className="text-[13px]">
                <span style={{ color: "#666" }}>Songwriter  </span>
                <span style={{ color: "#ccc" }}>{detail!.songwriter}</span>
              </p>
            )}
          </div>
        )}

        {/* Audio radar */}
        <div className="flex justify-center">
          <LazyAudioRadar trackId={data.id} size="sm" />
        </div>

        {/* DJ badge */}
        {showDJBadge && (
          <p className="text-center text-[12px]" style={{ color: "#D4A843" }}>
            Picked by {detail!.crateCount} DJs
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap pb-2">
          {hasBuyButton && (
            <Link
              href={`/buy/${detail!.digitalProductId}`}
              className="flex items-center justify-center px-5 h-10 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              onClick={onClose}
            >
              Buy
            </Link>
          )}
          <AddToCrateButton trackId={data.id} />
          {artistSlug && (
            <Link
              href={`/${artistSlug}`}
              className={`text-[13px] hover:underline${!hasBuyButton ? " mx-auto" : " ml-auto"}`}
              style={{ color: "#888" }}
              onClick={onClose}
            >
              View Artist
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Main overlay export ────────────────────────────────────────────────────────

export function TrackDetailOverlay() {
  const { overlayData, close } = useExpandedCard();
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<CardDetail | null>(null);

  // Fetch card detail when a track is opened
  useEffect(() => {
    if (!overlayData) { setDetail(null); return; }
    fetch(`/api/tracks/${overlayData.id}/card-detail`)
      .then(r => r.json())
      .then((d: CardDetail) => setDetail(d))
      .catch(() => setDetail(null));
  }, [overlayData?.id]);

  // Escape key to close
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

  return createPortal(
    <AnimatePresence>
      {overlayData && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[998]"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />

          {isMobile ? (
            /* Mobile: bottom sheet */
            <motion.div
              key="sheet"
              className="fixed bottom-0 left-0 right-0 z-[999] rounded-t-2xl"
              style={{ backgroundColor: "#111111", maxHeight: "92dvh" }}
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
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
              </div>
              {/* Scrollable content */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(92dvh - 24px)" }}>
                <PanelContent data={overlayData} detail={detail} onClose={close} />
              </div>
            </motion.div>
          ) : (
            /* Desktop: centered floating panel */
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="overlay"
                className="pointer-events-auto w-full overflow-y-auto"
                style={{
                  maxWidth: 480,
                  maxHeight: "85vh",
                  backgroundColor: "#111111",
                  border: "1px solid #1A1A1A",
                  borderRadius: 16,
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <PanelContent data={overlayData} detail={detail} onClose={close} />
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
