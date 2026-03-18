import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/** 2-second (60-frame at 30 fps) IndieThis branded outro card. */
export function OutroCard() {
  const frame = useCurrentFrame();

  // Fade in over first 15 frames (0.5 s), hold, fade out over last 15 frames.
  const opacity = interpolate(frame, [0, 15, 45, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        opacity,
      }}
    >
      <IndieThisIcon size={96} />
      <span
        style={{
          color: "#FFFFFF",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        IndieThis
      </span>
    </AbsoluteFill>
  );
}

// ─── IndieThis icon — gold rounded square + white bar + coral play triangle ──

function IndieThisIcon({ size }: { size: number }) {
  const rx     = Math.round(size * 0.22);
  const barX   = Math.round(size * 0.41);
  const barY   = Math.round(size * 0.31);
  const barW   = Math.round(size * 0.14);
  const barH   = Math.round(size * 0.47);
  const barRx  = Math.round(size * 0.07);
  const triPts = [
    `${Math.round(size * 0.375)},${Math.round(size * 0.155)}`,
    `${Math.round(size * 0.375)},${Math.round(size * 0.390)}`,
    `${Math.round(size * 0.594)},${Math.round(size * 0.273)}`,
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={size} height={size} rx={rx} fill="#D4A843" />
      <rect x={barX} y={barY} width={barW} height={barH} rx={barRx} fill="#FFFFFF" />
      <polygon points={triPts} fill="#E85D4A" />
    </svg>
  );
}
