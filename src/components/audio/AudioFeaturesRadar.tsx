"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioFeatureScores } from "@/lib/audio-features";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioFeaturesRadarProps {
  features:         AudioFeatureScores;
  size?:            "sm" | "md" | "lg";
  showLabels?:      boolean;
  animated?:        boolean;
  title?:           string;
  subtitle?:        string;
  compareFeatures?: AudioFeatureScores;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_KEYS: (keyof Omit<AudioFeatureScores, "genre" | "mood" | "isVocal">)[] = [
  "energy", "danceability", "valence", "loudness",
  "acousticness", "instrumentalness", "speechiness", "liveness",
];

const LABELS: Record<string, string> = {
  energy:          "Energy",
  danceability:    "Dance",
  valence:         "Valence",
  loudness:        "Loudness",
  acousticness:    "Acoustic",
  instrumentalness:"Instr.",
  speechiness:     "Speech",
  liveness:        "Live",
};

const SIZE_MAP = {
  sm: { px: 200, rings: 2, showLabels: false, showTitle: false, fontSize: 0  },
  md: { px: 300, rings: 4, showLabels: true,  showTitle: true,  fontSize: 11 },
  lg: { px: 400, rings: 4, showLabels: true,  showTitle: true,  fontSize: 11 },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

// ─── Animated SVG Radar (custom — no Recharts for animation) ─────────────────

interface SVGRadarProps {
  data:          number[];   // 0-1 values in FEATURE_KEYS order
  compareData?:  number[];
  size:          number;
  rings:         number;
  showLabels:    boolean;
  fontSize:      number;
  animated:      boolean;
  labels:        string[];
}

function SVGRadar({
  data, compareData, size, rings, showLabels, fontSize, animated, labels,
}: SVGRadarProps) {
  const n       = data.length;
  const cx      = size / 2;
  const cy      = size / 2;
  const padding = showLabels ? 36 : 18;
  const radius  = cx - padding;
  const [progress, setProgress] = useState(animated ? 0 : 1);
  const hasAnimated = useRef(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!animated || hasAnimated.current) return;
    hasAnimated.current = true;
    let start: number | null = null;
    const duration = 1200;

    function easeOutQuart(t: number) {
      return 1 - Math.pow(1 - t, 4);
    }

    function frame(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const t = Math.min(elapsed / duration, 1);
      setProgress(easeOutQuart(t));
      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }, [animated]);

  // Angle for each axis (starting from top, going clockwise)
  function angle(i: number) {
    return (i / n) * 2 * Math.PI - Math.PI / 2;
  }

  function pointOnAxis(i: number, r: number) {
    const a = angle(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  // Build polygon path for a set of values (animated by progress)
  function buildPath(values: number[], p: number) {
    return values
      .map((v, i) => {
        const { x, y } = pointOnAxis(i, v * p * radius);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z";
  }

  // Grid ring paths
  const gridPaths = Array.from({ length: rings }, (_, ri) => {
    const r = ((ri + 1) / rings) * radius;
    return Array.from({ length: n }, (__, i) => {
      const { x, y } = pointOnAxis(i, r);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z";
  });

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const end = pointOnAxis(i, radius);
    return { x1: cx, y1: cy, x2: end.x, y2: end.y };
  });

  // Label positions (outside ring + padding)
  const labelOffset = 14;
  const labelPositions = Array.from({ length: n }, (_, i) => {
    const a = angle(i);
    const r = radius + labelOffset;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), label: labels[i], a };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(212, 168, 67, 0.25))" }}
    >
      <defs>
        <filter id="glow-gold">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Grid rings */}
      {gridPaths.map((d, i) => (
        <path
          key={i} d={d}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((l, i) => (
        <line
          key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
        />
      ))}

      {/* Compare shape */}
      {compareData && (
        <path
          d={buildPath(compareData, progress)}
          fill="rgba(232,93,74,0.15)"
          stroke="#E85D4A"
          strokeWidth={1.5}
        />
      )}

      {/* Primary shape */}
      <path
        d={buildPath(data, progress)}
        fill="rgba(212,168,67,0.18)"
        stroke="rgba(212,168,67,0.9)"
        strokeWidth={2}
        filter="url(#glow-gold)"
      />

      {/* Data point dots — interactive */}
      {data.map((v, i) => {
        const { x, y } = pointOnAxis(i, v * progress * radius);
        const isHovered = hoveredIdx === i;
        return (
          <circle
            key={i} cx={x} cy={y} r={isHovered ? 6 : 4}
            fill="#D4A843"
            stroke="#111111"
            strokeWidth={2}
            style={{ cursor: "pointer", transition: "r 0.15s" }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        );
      })}

      {/* Hover tooltip */}
      {hoveredIdx !== null && (() => {
        const v = data[hoveredIdx];
        const { x, y } = pointOnAxis(hoveredIdx, v * progress * radius);
        const label = labels[hoveredIdx];
        const pct   = Math.round(v * 100) + "%";
        const tipW  = 72;
        const tipH  = 34;
        // Offset so tooltip doesn't overlap the dot; nudge inward if near edges
        const offX  = x > cx ? -(tipW + 8) : 8;
        const offY  = y > cy ? -(tipH + 4) : 4;
        const tx    = Math.max(2, Math.min(size - tipW - 2, x + offX));
        const ty    = Math.max(2, Math.min(size - tipH - 2, y + offY));
        return (
          <g key="tip" style={{ pointerEvents: "none" }}>
            <rect x={tx} y={ty} width={tipW} height={tipH} rx={6}
              fill="#1A1A1A" stroke="#333333" strokeWidth={1} />
            <text x={tx + tipW / 2} y={ty + 12} textAnchor="middle"
              fontSize={10} fontFamily="DM Sans, sans-serif"
              fontWeight={600} fill="#D4A843">{label}</text>
            <text x={tx + tipW / 2} y={ty + 25} textAnchor="middle"
              fontSize={10} fontFamily="DM Sans, sans-serif"
              fill="#FFFFFF">{pct}</text>
          </g>
        );
      })()}

      {/* Labels */}
      {showLabels && labelPositions.map((lp, i) => {
        const cosA = Math.cos(angle(i));
        const anchor = cosA > 0.1 ? "start" : cosA < -0.1 ? "end" : "middle";
        return (
          <text
            key={i}
            x={lp.x} y={lp.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={fontSize}
            fontFamily="DM Sans, sans-serif"
            fontWeight={500}
            fill="#888888"
          >
            {lp.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AudioFeaturesRadar({
  features,
  size    = "md",
  animated = true,
  title,
  subtitle,
  compareFeatures,
}: AudioFeaturesRadarProps) {
  const cfg = SIZE_MAP[size];

  const data    = FEATURE_KEYS.map(k => features[k] as number);
  const compare = compareFeatures
    ? FEATURE_KEYS.map(k => compareFeatures[k] as number)
    : undefined;
  const labels  = FEATURE_KEYS.map(k => LABELS[k]);

  return (
    <div
      className="flex flex-col items-center"
      style={{
        background: "#111111",
        border: "1px solid #1A1A1A",
        borderRadius: "1rem",
        boxShadow: "inset 0 0 60px rgba(212, 168, 67, 0.03)",
        padding: size === "sm" ? "12px" : "24px",
        width: "fit-content",
      }}
    >
      {/* Title block */}
      {cfg.showTitle && (title || subtitle) && (
        <div className="mb-4 text-center">
          {title && (
            <p
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: "18px",
                color: "#FFFFFF",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {title}
            </p>
          )}
          {subtitle && (
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "12px",
                color: "#666666",
                marginTop: "4px",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* SVG Radar */}
      <SVGRadar
        data={data}
        compareData={compare}
        size={cfg.px}
        rings={cfg.rings}
        showLabels={cfg.showLabels}
        fontSize={cfg.fontSize}
        animated={animated}
        labels={labels}
      />

      {/* Genre / Mood badges (md and lg only) */}
      {size !== "sm" && (features.genre || features.mood) && (
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          {features.genre && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843", fontFamily: "DM Sans, sans-serif" }}
            >
              {features.genre}
            </span>
          )}
          {features.mood && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#888888", fontFamily: "DM Sans, sans-serif" }}
            >
              {features.mood}
            </span>
          )}
          {!features.isVocal && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#888888", fontFamily: "DM Sans, sans-serif" }}
            >
              Instrumental
            </span>
          )}
        </div>
      )}
    </div>
  );
}
