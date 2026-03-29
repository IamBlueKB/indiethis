"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarFilterState {
  loudness:         number;
  energy:           number;
  danceability:     number;
  acousticness:     number;
  instrumentalness: number;
  speechiness:      number;
  liveness:         number;
  valence:          number;
}

export const RADAR_FEATURE_KEYS: (keyof RadarFilterState)[] = [
  "energy", "danceability", "valence", "liveness",
  "loudness", "acousticness", "instrumentalness", "speechiness",
];

const FEATURE_LABELS: Record<keyof RadarFilterState, string> = {
  energy:           "Energy",
  danceability:     "Dance",
  valence:          "Mood",
  liveness:         "Live",
  loudness:         "Loud",
  acousticness:     "Acoustic",
  instrumentalness: "Instru.",
  speechiness:      "Vocal",
};

const DEFAULT_STATE: RadarFilterState = {
  loudness: 0.5, energy: 0.5, danceability: 0.5, acousticness: 0.5,
  instrumentalness: 0.5, speechiness: 0.5, liveness: 0.5, valence: 0.5,
};

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { label: string; values: Partial<RadarFilterState> }[] = [
  {
    label: "Club Banger",
    values: { energy: 0.9, danceability: 0.9, loudness: 0.8, valence: 0.7,
              speechiness: 0.4, acousticness: 0.1, instrumentalness: 0.2, liveness: 0.3 },
  },
  {
    label: "Chill Vibes",
    values: { acousticness: 0.8, valence: 0.7, energy: 0.3, loudness: 0.3,
              danceability: 0.4, speechiness: 0.2, instrumentalness: 0.5, liveness: 0.2 },
  },
  {
    label: "Raw Hip-Hop",
    values: { speechiness: 0.8, energy: 0.7, loudness: 0.7, valence: 0.4,
              danceability: 0.6, acousticness: 0.2, instrumentalness: 0.15, liveness: 0.3 },
  },
  {
    label: "Soulful R&B",
    values: { valence: 0.8, acousticness: 0.5, speechiness: 0.4, liveness: 0.3,
              energy: 0.5, danceability: 0.6, loudness: 0.5, instrumentalness: 0.3 },
  },
  {
    label: "Dark & Moody",
    values: { valence: 0.2, energy: 0.5, acousticness: 0.4, loudness: 0.6,
              danceability: 0.35, speechiness: 0.25, instrumentalness: 0.6, liveness: 0.2 },
  },
];

// ─── SVG geometry helpers ─────────────────────────────────────────────────────

const N = RADAR_FEATURE_KEYS.length; // 8

function angleForIndex(i: number): number {
  // Start from top (-π/2), go clockwise
  return (i * 2 * Math.PI) / N - Math.PI / 2;
}

function getPoint(cx: number, cy: number, angle: number, radius: number, value: number) {
  return {
    x: cx + Math.cos(angle) * radius * value,
    y: cy + Math.sin(angle) * radius * value,
  };
}

function polygonPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
}

// ─── Label offset — push labels outside the max ring ─────────────────────────

function labelOffset(angle: number, labelRadius: number) {
  // Nudge label away from center based on angle quadrant
  const x = Math.cos(angle) * labelRadius;
  const y = Math.sin(angle) * labelRadius;
  const anchor = Math.abs(Math.cos(angle)) < 0.3 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
  return { x, y, anchor };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InteractiveRadarFilterProps {
  onChange: (state: RadarFilterState) => void;
  onCommit: (state: RadarFilterState) => void; // fires after drag ends (debounced)
}

export default function InteractiveRadarFilter({ onChange, onCommit }: InteractiveRadarFilterProps) {
  const [state, setState]           = useState<RadarFilterState>(DEFAULT_STATE);
  const [dragging, setDragging]     = useState<number | null>(null);  // index of dragged vertex
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Sizes ──────────────────────────────────────────────────────────────────
  const SIZE        = 320;
  const CX          = SIZE / 2;
  const CY          = SIZE / 2;
  const MAX_R       = 118; // max radius for value=1
  const LABEL_R     = MAX_R + 22;
  const RINGS       = [0.25, 0.5, 0.75, 1.0];
  const DOT_R       = 8;  // draggable dot radius

  // ── Compute current polygon points ────────────────────────────────────────
  const getPoints = useCallback((s: RadarFilterState) =>
    RADAR_FEATURE_KEYS.map((key, i) =>
      getPoint(CX, CY, angleForIndex(i), MAX_R, s[key])
    ),
  [CX, CY, MAX_R]);

  // ── Drag math: project mouse onto feature axis ─────────────────────────────
  const projectOnAxis = useCallback((mx: number, my: number, axisIndex: number): number => {
    const angle = angleForIndex(axisIndex);
    const dx = mx - CX;
    const dy = my - CY;
    // Dot product with unit axis direction
    const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
    return Math.max(0, Math.min(1, projection / MAX_R));
  }, [CX, CY, MAX_R]);

  // ── Get SVG-space coordinates from a pointer event ────────────────────────
  const getSVGCoords = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }, [SIZE]);

  // ── Pointer move handler (attached to window during drag) ─────────────────
  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (dragging === null) return;
    const coords = getSVGCoords(e);
    if (!coords) return;

    const featureKey = RADAR_FEATURE_KEYS[dragging];
    const value = projectOnAxis(coords.x, coords.y, dragging);

    const next = { ...stateRef.current, [featureKey]: value };
    stateRef.current = next;
    setState(next);
    onChange(next);
  }, [dragging, getSVGCoords, projectOnAxis, onChange]);

  // ── Pointer up handler ────────────────────────────────────────────────────
  const handlePointerUp = useCallback(() => {
    if (dragging === null) return;
    setDragging(null);
    // Debounced commit
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      onCommit(stateRef.current);
    }, 300);
  }, [dragging, onCommit]);

  // ── Attach / detach global pointer listeners ──────────────────────────────
  useEffect(() => {
    if (dragging === null) return;
    window.addEventListener("mousemove",  handlePointerMove);
    window.addEventListener("touchmove",  handlePointerMove, { passive: false });
    window.addEventListener("mouseup",    handlePointerUp);
    window.addEventListener("touchend",   handlePointerUp);
    return () => {
      window.removeEventListener("mousemove",  handlePointerMove);
      window.removeEventListener("touchmove",  handlePointerMove);
      window.removeEventListener("mouseup",    handlePointerUp);
      window.removeEventListener("touchend",   handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  // ── Prevent page scroll while dragging on touch ───────────────────────────
  useEffect(() => {
    if (dragging === null) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragging]);

  // ── Dot mousedown/touchstart ───────────────────────────────────────────────
  function startDrag(index: number, e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setActivePreset(null);
    setDragging(index);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    setActivePreset(null);
    setState(DEFAULT_STATE);
    onChange(DEFAULT_STATE);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onCommit(DEFAULT_STATE), 300);
  }

  // ── Apply preset ──────────────────────────────────────────────────────────
  function applyPreset(preset: typeof PRESETS[number]) {
    const next = { ...DEFAULT_STATE, ...preset.values } as RadarFilterState;
    setActivePreset(preset.label);
    setState(next);
    onChange(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onCommit(next), 300);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const points   = getPoints(state);
  const polyPath = polygonPath(points);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Title */}
      <div className="text-center">
        <p style={{ fontFamily: "Playfair Display, serif", fontSize: 22, color: "#FFFFFF", fontWeight: 700, lineHeight: 1.2 }}>
          Find Your Sound
        </p>
        <p className="mt-1 text-sm" style={{ color: "#666666", fontFamily: "DM Sans, sans-serif" }}>
          Drag the points to describe what you&apos;re looking for
        </p>
      </div>

      {/* SVG radar */}
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ touchAction: "none", userSelect: "none", maxWidth: "100%", overflow: "visible" }}
      >
        {/* Axis lines */}
        {RADAR_FEATURE_KEYS.map((_, i) => {
          const angle = angleForIndex(i);
          const end   = getPoint(CX, CY, angle, MAX_R, 1);
          return (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={end.x} y2={end.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          );
        })}

        {/* Grid rings */}
        {RINGS.map((r) => {
          const ringPoints = RADAR_FEATURE_KEYS.map((_, i) =>
            getPoint(CX, CY, angleForIndex(i), MAX_R, r)
          );
          return (
            <path
              key={r}
              d={polygonPath(ringPoints)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Filled polygon */}
        <path
          d={polyPath}
          fill="rgba(212,168,67,0.18)"
          stroke="rgba(212,168,67,0.9)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(212,168,67,0.3))" }}
        />

        {/* Labels */}
        {RADAR_FEATURE_KEYS.map((key, i) => {
          const angle  = angleForIndex(i);
          const { x, y, anchor } = labelOffset(angle, LABEL_R);
          const val    = state[key];
          const color  = val > 0.7 ? "#D4A843" : val < 0.3 ? "#555555" : "#888888";
          const label  = FEATURE_LABELS[key];
          const pct    = Math.round(val * 100);

          return (
            <text
              key={key}
              x={CX + x}
              y={CY + y + 4}
              textAnchor={anchor}
              fontSize={11}
              fontFamily="DM Sans, sans-serif"
              fill={color}
              style={{ transition: "fill 0.2s" }}
            >
              {label}: {pct}%
            </text>
          );
        })}

        {/* Draggable dots */}
        {points.map((pt, i) => {
          const isDragging = dragging === i;
          const isHot      = state[RADAR_FEATURE_KEYS[i]] > 0.7;
          const r = isDragging ? 12 : isHot ? 9 : DOT_R;
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={r}
              fill={isDragging ? "#D4A843" : "#D4A843"}
              stroke="#0A0A0A"
              strokeWidth={2.5}
              style={{
                cursor: isDragging ? "grabbing" : "grab",
                filter: isDragging
                  ? "drop-shadow(0 0 10px rgba(212,168,67,0.8))"
                  : isHot
                  ? "drop-shadow(0 0 4px rgba(212,168,67,0.5))"
                  : "none",
                transition: "r 0.1s, filter 0.1s",
              }}
              onMouseDown={(e) => startDrag(i, e)}
              onTouchStart={(e) => startDrag(i, e)}
            />
          );
        })}
      </svg>

      {/* Reset button */}
      <button
        onClick={reset}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
        style={{ border: "1px solid rgba(212,168,67,0.35)", color: "#D4A843", background: "transparent" }}
      >
        <RotateCcw size={11} />
        Reset
      </button>

      {/* Preset pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map((preset) => {
          const active = activePreset === preset.label;
          return (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                border: `1px solid ${active ? "#D4A843" : "rgba(212,168,67,0.25)"}`,
                backgroundColor: active ? "rgba(212,168,67,0.15)" : "transparent",
                color: active ? "#D4A843" : "#888",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
