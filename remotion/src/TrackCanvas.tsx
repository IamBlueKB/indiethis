import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

export interface TrackCanvasProps {
  coverArtUrl: string;
  audioUrl: string;
  accentColor?: string;
}

const TOTAL_FRAMES = 180; // 6s @ 30fps

export function TrackCanvas({ coverArtUrl }: TrackCanvasProps) {
  const frame = useCurrentFrame();
  const loopFrame = frame % TOTAL_FRAMES;
  const t = loopFrame / TOTAL_FRAMES; // 0 → 1, loops

  // Slow Ken Burns: 1.0 → 1.05 zoom + slight pan
  const scale = interpolate(t, [0, 1], [1.0, 1.05]);
  const panX = interpolate(t, [0, 1], [0, 12]);
  const panY = interpolate(t, [0, 1], [0, -6]);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* Cover art with Ken Burns */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={coverArtUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Static dark vignette — no pulsing */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 20%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* Bottom fade */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)",
        }}
      />
    </AbsoluteFill>
  );
}
