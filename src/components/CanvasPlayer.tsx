"use client";

import { useEffect, useRef } from "react";

interface CanvasPlayerProps {
  canvasVideoUrl?: string | null;
  coverArtUrl?: string | null;
  className?: string;
  isPlaying?: boolean;
}

export default function CanvasPlayer({
  canvasVideoUrl,
  coverArtUrl,
  className,
  isPlaying = false,
}: CanvasPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isPlaying]);

  // Show canvas video only when actively playing; otherwise static cover art
  const showVideo = isPlaying && !!canvasVideoUrl;

  return (
    <div className={className ?? ""} style={{ position: "relative" }}>
      {/* Static cover art — always rendered, hidden behind video when playing */}
      {coverArtUrl ? (
        <img
          src={coverArtUrl}
          alt="Cover art"
          className="w-full h-full object-cover"
          style={{ display: showVideo ? "none" : "block" }}
        />
      ) : (
        <div className="w-full h-full bg-neutral-900" style={{ display: showVideo ? "none" : "block" }} />
      )}

      {/* Canvas video — only mounted when there is a canvas URL */}
      {canvasVideoUrl && (
        <video
          ref={videoRef}
          src={canvasVideoUrl}
          muted
          loop
          playsInline
          className="w-full h-full object-cover absolute inset-0"
          style={{ opacity: showVideo ? 1 : 0, transition: "opacity 0.3s" }}
        />
      )}
    </div>
  );
}
