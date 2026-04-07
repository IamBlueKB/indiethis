"use client";

/**
 * DemoReel — looping demo video for the /video-studio landing page.
 *
 * Attempts to play /videos/video-studio-demo.mp4 from the public directory.
 * Falls back to a dark gradient placeholder when the file is not yet present.
 * Swap to the real video automatically by dropping the MP4 at:
 *   /public/videos/video-studio-demo.mp4
 */

import { useState } from "react";
import { Film }     from "lucide-react";

export default function DemoReel() {
  // Start as placeholder; switch to real video once it can play.
  // This avoids the race condition where onError fires before React hydrates.
  const [videoReady, setVideoReady] = useState(false);

  const containerStyle: React.CSSProperties = {
    position:        "relative",
    width:           "100%",
    aspectRatio:     "16/9",
    borderRadius:    "16px",
    overflow:        "hidden",
    border:          "1px solid #1E1E1E",
    backgroundColor: "#0A0A0A",
  };

  return (
    <div style={containerStyle}>

      {/* ── Real video (hidden until canplay fires) ── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        src="/videos/video-studio-demo.mp4"
        onCanPlay={() => setVideoReady(true)}
        style={{
          position:   "absolute",
          inset:      0,
          width:      "100%",
          height:     "100%",
          objectFit:  "cover",
          display:    "block",
          opacity:    videoReady ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />

      {/* ── Placeholder — visible until video is ready ── */}
      {!videoReady && (
        <>
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #0D0D0D 0%, #111 40%, #0A0A0A 100%)" }}
          />
          <FilmStrip position="top" />
          <FilmStrip position="bottom" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)" }}
            >
              <Film size={22} style={{ color: "#D4A843" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
              Demo reel coming soon
            </p>
            <p className="text-xs" style={{ color: "#444" }}>
              Drop your track in and see what we make
            </p>
          </div>
        </>
      )}

    </div>
  );
}

// ─── Film strip decoration ────────────────────────────────────────────────────

function FilmStrip({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className="absolute left-0 right-0 flex gap-1.5 px-2 opacity-[0.08]"
      style={{ [position]: "0", padding: "6px 8px" }}
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: "#888" }} />
      ))}
    </div>
  );
}
