"use client";

import { useRef, useEffect } from "react";

export default function HeroCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  return (
    <div className="relative hidden sm:flex flex-col items-center shrink-0" style={{ width: 220 }}>
      {/* Video with gradient fades */}
      <div className="relative overflow-hidden rounded-3xl" style={{ width: 220, height: 390 }}>
        <video
          ref={videoRef}
          src="/videos/hero-canvas.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "100%", height: 390, objectFit: "cover", display: "block" }}
        />
        {/* Fade top and bottom into dark background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, #0A0A0A 0%, transparent 12%, transparent 85%, #0A0A0A 100%)"
        }} />
      </div>

      {/* Label */}
      <div className="mt-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D4A843" }} />
        <span className="text-xs font-semibold tracking-wide" style={{ color: "#888" }}>
          Canvas Video · Made with IndieThis
        </span>
      </div>
    </div>
  );
}
