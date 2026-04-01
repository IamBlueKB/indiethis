"use client";

import { useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { useExpandedCard } from "@/store/expandedCard";

interface Props {
  id: string;
  coverArtUrl: string | null;
  canvasVideoUrl?: string | null;
  isPlaying?: boolean;
  onPlay?: (e: React.MouseEvent) => void;
  /** "sm" = 32px button for small thumbnails; "md" = 48px default */
  buttonSize?: "sm" | "md";
  className?: string;
  /** Badges, stream-lease tags, etc. rendered on top of the cover */
  children?: React.ReactNode;
}

/**
 * Reusable card cover area with:
 *  - Canvas video lazy-loaded on hover (desktop only, one at a time globally)
 *  - Circular play/pause button that fades in on hover
 * The parent card is responsible for the Framer Motion lift effect.
 */
export function HoverCardCover({
  id,
  coverArtUrl,
  canvasVideoUrl,
  isPlaying = false,
  onPlay,
  buttonSize = "md",
  className = "",
  children,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeCanvasId, setActiveCanvas } = useExpandedCard();
  const isCanvasActive = activeCanvasId === id;

  // When another card becomes active, stop this card's video
  useEffect(() => {
    if (!isCanvasActive && videoRef.current && canvasVideoUrl) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isCanvasActive, canvasVideoUrl]);

  const handleMouseEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    if (!canvasVideoUrl) return;
    setActiveCanvas(id);
    videoRef.current?.play().catch(() => {});
  }, [id, canvasVideoUrl, setActiveCanvas]);

  const handleMouseLeave = useCallback(() => {
    if (activeCanvasId === id) setActiveCanvas(null);
  }, [id, activeCanvasId, setActiveCanvas]);

  const btnCls =
    buttonSize === "sm"
      ? "w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-opacity"
      : "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-opacity";

  const iconSize = buttonSize === "sm" ? 12 : 18;

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Static cover art */}
      {coverArtUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverArtUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{
            opacity: isCanvasActive && canvasVideoUrl ? 0 : 1,
            transition: "opacity 0.2s",
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#1a1a1a" }} />
      )}

      {/* Canvas video — lazy-loaded, only rendered when URL present */}
      {canvasVideoUrl && (
        <video
          ref={videoRef}
          src={canvasVideoUrl}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: isCanvasActive ? 1 : 0, transition: "opacity 0.2s" }}
          loop
          muted
          playsInline
          preload="none"
        />
      )}

      {/* Dark overlay + play/pause button */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-all">
        <button
          className={`${btnCls} ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={{ backgroundColor: isPlaying ? "#E85D4A" : "#D4A843" }}
          onClick={(e) => { e.stopPropagation(); onPlay?.(e); }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying
            ? <Pause size={iconSize} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
            : <Play  size={iconSize} fill="#0A0A0A" style={{ color: "#0A0A0A", marginLeft: buttonSize === "sm" ? 1 : 2 }} />
          }
        </button>
      </div>

      {/* Pass-through children (badges, stream-lease tags, etc.) */}
      {children}
    </div>
  );
}
