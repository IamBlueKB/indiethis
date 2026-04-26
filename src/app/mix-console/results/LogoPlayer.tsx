"use client";

/**
 * LogoPlayer — rounded-square SVG ring with coral play/pause + gold sweep.
 *
 * Visual DNA matches the mastering preview player (do NOT modify that file).
 * The audio element is owned by the parent (MixResultsClient) so the
 * FrequencyVisualizer in Step 4 can attach a Web Audio AnalyserNode to it.
 *
 * Props:
 *   controller — useAudioController() instance from the parent
 *   maxTime?   — optional hard cap on the displayed total (e.g. 30 for previews)
 */

import { useEffect, useRef, useState } from "react";
import { fmtTime, type AudioController } from "@/lib/mix-console/audio-utils";

const GOLD  = "#D4AF37";
const CORAL = "#E8735A";

// Rounded-square ring path: viewBox 0 0 200 200, corner radius 60
const SQ = 200;
const R  = 60;
const RING_PATH = [
  `M ${SQ / 2},0`,
  `L ${SQ - R},0`,
  `Q ${SQ},0 ${SQ},${R}`,
  `L ${SQ},${SQ - R}`,
  `Q ${SQ},${SQ} ${SQ - R},${SQ}`,
  `L ${R},${SQ}`,
  `Q 0,${SQ} 0,${SQ - R}`,
  `L 0,${R}`,
  `Q 0,0 ${R},0`,
  `Z`,
].join(" ");

export interface LogoPlayerProps {
  controller: AudioController;
  /** Hard cap for displayed total + sweep denominator. Default = audio duration. */
  maxTime?:   number;
  /** Render size. Spec: 72px on mobile, defaults work for both. */
  size?:      number;
}

export function LogoPlayer({ controller, maxTime, size = 180 }: LogoPlayerProps) {
  const { isPlaying, currentTime, duration, toggle, seek } = controller;

  const svgPathRef       = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);

  // Measure SVG ring length for stroke-dashoffset
  useEffect(() => {
    if (svgPathRef.current) {
      setPathLen(svgPathRef.current.getTotalLength());
    }
  }, []);

  const total      = maxTime ?? (duration > 0 ? duration : 0);
  const progress   = total > 0 ? Math.min(1, currentTime / total) : 0;
  const dashOffset = pathLen > 0 ? pathLen * (1 - progress) : pathLen;

  // Single click handler — covers the whole player surface. Hit-tests by
  // distance from center so the button's inset-0 hitbox doesn't swallow
  // ring clicks any more:
  //   • near the center (≤ 30% of half-size) → toggle play/pause
  //   • out toward the ring                  → scrub to that angle
  function handlePlayerClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = e.clientX - cx;
    const dy   = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const half = rect.width / 2;
    if (dist <= half * 0.30) {
      toggle();
      return;
    }
    if (total > 0) {
      // 0 at 12 o'clock, increasing clockwise to 1.
      // atan2(dx, -dy): top=0, right=+π/2, bottom=±π, left=-π/2.
      let t = Math.atan2(dx, -dy) / (2 * Math.PI);
      if (t < 0) t += 1;
      seek(t * total);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative cursor-pointer"
        style={{ width: size, height: size }}
        onClick={handlePlayerClick}
        role="button"
        aria-label={isPlaying ? "Pause (click center) or scrub (click ring)" : "Play (click center) or scrub (click ring)"}
      >
        <svg
          viewBox={`0 0 ${SQ} ${SQ}`}
          width={size}
          height={size}
          style={{ display: "block", pointerEvents: "none" }}
          aria-hidden="true"
        >
          {/* Background ring */}
          <path
            d={RING_PATH}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={6}
          />
          {/* Gold progress sweep */}
          <path
            ref={svgPathRef}
            d={RING_PATH}
            fill="none"
            stroke={GOLD}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={pathLen}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>

        {/* Coral play / pause button — visually identical to original
            (absolute inset-0). Pointer events disabled so the parent
            handlePlayerClick gets every click and routes by hit-test:
            center → toggle, ring → scrub. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center rounded-[30%]"
          style={{
            background: "transparent",
            boxShadow: isPlaying ? "none" : "0 0 20px 4px rgba(232,115,90,0.25)",
            animation: isPlaying ? "none" : "mixPlayerPulse 2s ease-in-out infinite",
            pointerEvents: "none",
          }}
        >
          {isPlaying ? (
            <svg width={size * 0.18} height={size * 0.22} viewBox="0 0 28 36" aria-hidden="true">
              <rect x="2"  y="2" width="9" height="32" rx="2" fill={CORAL} />
              <rect x="17" y="2" width="9" height="32" rx="2" fill={CORAL} />
            </svg>
          ) : (
            <svg width={size * 0.2} height={size * 0.22} viewBox="0 0 32 36" aria-hidden="true">
              <polygon points="2,2 30,18 2,34" fill={CORAL} />
            </svg>
          )}
        </div>
      </div>

      {/* Track time */}
      <p style={{ fontSize: 12, color: "#777" }} className="font-mono tabular-nums">
        {fmtTime(currentTime)} / {fmtTime(total)}
      </p>

      {/* Idle pulse keyframe */}
      <style>{`
        @keyframes mixPlayerPulse {
          0%, 100% { box-shadow: 0 0 16px 4px rgba(232,115,90,0.20); }
          50%      { box-shadow: 0 0 28px 8px rgba(232,115,90,0.40); }
        }
      `}</style>
    </div>
  );
}
