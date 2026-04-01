"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ShoppingCart, Users, Music2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store";
import type { TrackCardData } from "@/store/expandedCard";
import LazyAudioRadar from "@/components/audio/LazyAudioRadar";
import AddToCrateButton from "@/components/dj/AddToCrateButton";
import { HoverCardCover } from "./HoverCardCover";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardDetail {
  producer: string | null;
  songwriter: string | null;
  digitalProductId: string | null;
  crateCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpandedCardContent({
  data,
  onClose,
}: {
  data: TrackCardData;
  onClose: () => void;
}) {
  const { play, pause, resume, currentTrack, isPlaying } = useAudioStore();
  const [detail, setDetail] = useState<CardDetail | null>(null);

  const isThis = currentTrack?.id === data.id;
  const isThisPlaying = isThis && isPlaying;

  const artistSlug = data.artist.artistSite?.isPublished ? data.artist.artistSlug : null;

  // Fetch credits + crate count when card opens
  useEffect(() => {
    fetch(`/api/tracks/${data.id}/card-detail`)
      .then(r => r.json())
      .then(d => setDetail(d as CardDetail))
      .catch(() => {});
  }, [data.id]);

  function handlePlayPause() {
    if (!isThis) {
      play({
        id: data.id,
        title: data.title,
        artist: data.artist.name,
        src: data.fileUrl,
        coverArt: data.coverArtUrl ?? undefined,
        canvasVideoUrl: data.canvasVideoUrl,
      });
    } else if (isThisPlaying) {
      pause();
    } else {
      resume();
    }
  }

  const hasCredits = detail && (detail.producer || detail.songwriter);
  const djBadge = detail && detail.crateCount >= 3;

  return (
    <div
      className="border-t"
      style={{ borderColor: "rgba(212,168,67,0.15)", backgroundColor: "#0f0f0f" }}
    >
      {/* Close button */}
      <div className="flex justify-end px-3 pt-3">
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: "#666" }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-3 pb-4 space-y-3">
        {/* Canvas / cover at top */}
        <HoverCardCover
          id={`expanded-${data.id}`}
          coverArtUrl={data.coverArtUrl}
          canvasVideoUrl={data.canvasVideoUrl}
          isPlaying={isThisPlaying}
          onPlay={handlePlayPause}
          className="w-full aspect-video rounded-lg overflow-hidden"
        />

        {/* Track info */}
        <div>
          <p className="font-bold text-white leading-tight" style={{ fontSize: 20 }}>{data.title}</p>
          {artistSlug ? (
            <Link
              href={`/${artistSlug}`}
              className="block mt-0.5 hover:underline"
              style={{ fontSize: 16, color: "#888" }}
            >
              {data.artist.name}
            </Link>
          ) : (
            <p className="mt-0.5" style={{ fontSize: 16, color: "#888" }}>{data.artist.name}</p>
          )}

          {/* Genre + mood pills */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {data.genre && (
              <span
                className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ border: "1px solid rgba(212,168,67,0.5)", color: "#D4A843" }}
              >
                {data.genre}
              </span>
            )}
          </div>
        </div>

        {/* Play/pause button */}
        <button
          onClick={handlePlayPause}
          className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            backgroundColor: isThisPlaying ? "rgba(232,93,74,0.15)" : "rgba(212,168,67,0.12)",
            color: isThisPlaying ? "#E85D4A" : "#D4A843",
            border: `1px solid ${isThisPlaying ? "rgba(232,93,74,0.3)" : "rgba(212,168,67,0.25)"}`,
          }}
        >
          <Music2 size={14} />
          {isThisPlaying ? "Now Playing" : (isThis ? "Resume" : "Play in Player")}
        </button>

        {/* BPM + key metadata pills */}
        {(data.bpm || data.musicalKey) && (
          <div className="flex flex-wrap gap-1.5">
            {data.bpm && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: "#1e1e1e", color: "#999" }}
              >
                {data.bpm} BPM
              </span>
            )}
            {data.musicalKey && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: "#1e1e1e", color: "#999" }}
              >
                {data.musicalKey}
              </span>
            )}
            {data.plays != null && (
              <span
                className="text-[11px] px-2 py-0.5 rounded"
                style={{ backgroundColor: "#1e1e1e", color: "#555" }}
              >
                {data.plays.toLocaleString()} plays
              </span>
            )}
          </div>
        )}

        {/* Credits */}
        {hasCredits && (
          <div>
            <p className="text-[13px] font-bold mb-1.5" style={{ color: "#D4A843" }}>Credits</p>
            <div className="space-y-0.5">
              {detail?.producer && (
                <p className="text-xs" style={{ color: "#888" }}>
                  <span style={{ color: "#666" }}>Producer: </span>{detail.producer}
                </p>
              )}
              {detail?.songwriter && (
                <p className="text-xs" style={{ color: "#888" }}>
                  <span style={{ color: "#666" }}>Songwriter: </span>{detail.songwriter}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Audio features radar */}
        <LazyAudioRadar trackId={data.id} size="sm" animated />

        {/* DJ badge */}
        {djBadge && (
          <div className="flex items-center gap-1.5">
            <Users size={11} style={{ color: "#D4A843" }} />
            <span className="text-[11px] font-bold" style={{ color: "#D4A843" }}>
              Picked by {detail!.crateCount} DJ{detail!.crateCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {detail?.digitalProductId && (
            <Link
              href={`/store/${detail.digitalProductId}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <ShoppingCart size={12} />
              Buy
            </Link>
          )}
          <AddToCrateButton trackId={data.id} />
          {artistSlug && (
            <Link
              href={`/${artistSlug}`}
              className="text-[12px] px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "#888", border: "1px solid #2a2a2a" }}
            >
              View Artist →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
