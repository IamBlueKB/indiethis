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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvasVideoUrl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "200px" }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [canvasVideoUrl]);

  useEffect(() => {
    if (isVisible && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsLoaded(true);
    }
  }, [isVisible]);

  return (
    <div ref={containerRef} className={className ?? ""}>
      {canvasVideoUrl ? (
        <video
          ref={videoRef}
          src={isVisible ? canvasVideoUrl : undefined}
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setIsLoaded(true)}
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
