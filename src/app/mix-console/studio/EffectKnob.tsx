/**
 * EffectKnob — circular drag knob for stem effects (reverb, delay, comp, brightness).
 *
 * Spec:
 *   - 36px diameter, vertical drag to change value
 *   - Range: 0..100 (UI domain — predict.py + useStudioAudio map to real units)
 *   - 50 = "AI's setting" (gold reference tick on the outer ring)
 *   - Double-click to reset to AI's setting
 *   - Color-coded fill arc per stem
 *   - Tiny label below + numeric readout above on hover
 *
 * Drag sensitivity: 200px of vertical drag = full 0→100 sweep.
 *
 * The knob value is purely UI; mapping to dB / ms / Hz / dryWet happens
 * at the audio-graph layer (steps 8–11) and at predict.py for the
 * server render (step 26).
 */

"use client";

import { useRef, useState } from "react";

const SIZE      = 42;       // bumped from 36 — easier touch target on tablet
const RADIUS    = SIZE / 2 - 3;
const STROKE    = 3;        // thicker arc to match the larger knob
const ARC_START = 135;   // degrees, bottom-left
const ARC_END   = 45;    // degrees, bottom-right (sweeping clockwise = 270deg total)
const ARC_SWEEP = 270;
const DRAG_PX   = 200;   // px of vertical drag = full 0→100

interface EffectKnobProps {
  /** Current value 0..100. */
  value:        number;
  onChange:     (v: number) => void;
  /** AI's original value (50 by default). Shown as a gold reference tick. */
  aiOriginal?:  number;
  /** Color-coded arc fill (matches stem strip color). */
  color?:       string;
  /** Two-line label under the knob. */
  label:        string;
  /** Optional sublabel (e.g. "REV", "DLY"). */
  shortLabel?:  string;
  /** Disabled / unavailable in current view (renders dimmed, no interaction). */
  disabled?:    boolean;
}

export function EffectKnob({
  value,
  onChange,
  aiOriginal = 50,
  color = "#D4A843",
  label,
  shortLabel,
  disabled = false,
}: EffectKnobProps) {
  const [hovering, setHovering] = useState(false);
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  function startDrag(clientY: number) {
    if (disabled) return;
    dragRef.current = { startY: clientY, startVal: value };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dy = dragRef.current.startY - y;       // up = positive
      const delta = (dy / DRAG_PX) * 100;
      const next  = Math.max(0, Math.min(100, dragRef.current.startVal + delta));
      onChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend",  onUp);
  }

  function onDoubleClick() {
    if (disabled) return;
    onChange(aiOriginal);
  }

  // ─── Arc geometry ───────────────────────────────────────────────────────
  const cx       = SIZE / 2;
  const cy       = SIZE / 2;
  // Convert (0..100) → angle along 270° sweep starting at 135°
  function valueToAngle(v: number) {
    const t = Math.max(0, Math.min(1, v / 100));
    return ARC_START + t * ARC_SWEEP;
  }
  function polar(angleDeg: number, r: number) {
    const a = (angleDeg - 90) * (Math.PI / 180);  // SVG: 0° = right; we offset so 0 = top
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  function arcPath(fromDeg: number, toDeg: number) {
    const start = polar(fromDeg, RADIUS);
    const end   = polar(toDeg, RADIUS);
    const sweep = toDeg - fromDeg;
    const large = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  const valueAngle = valueToAngle(value);
  const aiAngle    = valueToAngle(aiOriginal);
  const tickInner  = polar(aiAngle, RADIUS - 1);
  const tickOuter  = polar(aiAngle, RADIUS + 3);

  // Pointer line from center → current value angle
  const pointerOuter = polar(valueAngle, RADIUS - 2);
  const pointerInner = polar(valueAngle, RADIUS - 9);

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ opacity: disabled ? 0.35 : 1 }}
      aria-label={label}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      {/* Numeric readout — only on hover */}
      <div className="text-[8px] font-mono leading-none" style={{ color: hovering ? color : "transparent", height: 8 }}>
        {Math.round(value)}
      </div>

      <svg
        width={SIZE}
        height={SIZE}
        onMouseDown={(e) => startDrag(e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientY)}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{ cursor: disabled ? "default" : "pointer" }}
      >
        {/* Background arc (full sweep, dim) */}
        <path
          d={arcPath(ARC_START, ARC_START + ARC_SWEEP)}
          stroke="#2A2824"
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
        />
        {/* Value arc (filled portion, color) */}
        {value > 0 && (
          <path
            d={arcPath(ARC_START, valueAngle)}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* AI-original tick (gold, always visible behind value) */}
        <line
          x1={tickInner.x} y1={tickInner.y}
          x2={tickOuter.x} y2={tickOuter.y}
          stroke="#D4A843"
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill="#1A1A1A" stroke={color} strokeWidth={0.5} />
        {/* Pointer line from center toward current value */}
        <line
          x1={pointerInner.x} y1={pointerInner.y}
          x2={pointerOuter.x} y2={pointerOuter.y}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>

      {/* Label */}
      <span className="text-[8px] uppercase tracking-wider mt-0.5 leading-none" style={{ color: "#888" }}>
        {shortLabel ?? label}
      </span>
    </div>
  );
}
