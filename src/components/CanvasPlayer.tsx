"use client";

import { useEffect, useRef, useState } from "react";

interface CanvasPlayerProps {
  canvasVideoUrl?: string | null;
  coverArtUrl?: string | null;
  className?: string;
}

export default function CanvasPlayer({
  canvasVideoUrl,
  coverArtUrl,
  className,
}: CanvasPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !canvasVideoUrl) return;
    v.play().catch(() => {});
  }, [canvasVideoUrl]);

  return (
    <div className={className ?? ""}>
      {canvasVideoUrl ? (
        <video
          ref={videoRef}
          src={canvasVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0, transition: "opacity 0.4s" }}
          className="w-full h-full object-cover"
        />
      ) : coverArtUrl ? (
        <img
          src={coverArtUrl}
          alt="Cover art"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-neutral-900" />
      )}
    </div>
  );
}
