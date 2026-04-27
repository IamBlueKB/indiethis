/**
 * PanKnob — horizontal pan control with AI-original reference dot.
 *
 * Spec:
 *   - Range: L100 to R100 (-1 to +1 internally)
 *   - Default: AI's pan position
 *   - Gold dot indicator showing AI's original setting (always visible
 *     so the artist can see what Claude decided)
 *   - Drag horizontally to set value; double-click resets to AI original
 *
 * Style: small horizontal slider with a circular thumb. Compact enough
 * to sit in an 80px channel strip.
 */

"use client";

import { useRef } from "react";

const WIDTH_PX  = 56;
const HEIGHT_PX = 22;
const TRACK_H   = 3;
const THUMB_D   = 14;

interface PanKnobProps {
  /** Current pan, -1 (full L) to +1 (full R). */
  value:        number;
  onChange:     (pan: number) => void;
  /** AI's original pan position — shown as a gold reference dot. */
  aiOriginal?:  number;
  /** Color of the active thumb (defaults to gold). */
  color?:       string;
  label?:       string;
}

function clamp(n: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, n));
}

function panLabel(pan: number): string {
  const v = Math.round(pan * 100);
  if (v === 0)  return "C";
  if (v < 0)    return `L${Math.abs(v)}`;
  return `R${v}`;
}

export function PanKnob({ value, onChange, aiOriginal = 0, color = "#D4A843", label }: PanKnobProps) {
  const trackRef    = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  function startDrag(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggingRef.current = true;
    update(clientX, rect);
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      update(x, rect);
    };
    const onUp = () => {
      draggingRef.current = false;
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

  function update(clientX: number, rect: DOMRect) {
    // Map left edge → -1, right edge → +1.
    const rel = (clientX - rect.left) / rect.width;
    const pan = clamp(rel * 2 - 1);
    onChange(pan);
  }

  function onDoubleClick() {
    onChange(aiOriginal);
  }

  const valuePct  = ((clamp(value) + 1) / 2) * 100;        // 0..100
  const aiPct     = ((clamp(aiOriginal) + 1) / 2) * 100;

  return (
    <div className="flex flex-col items-center select-none gap-0.5">
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ width: WIDTH_PX, height: HEIGHT_PX }}
        onMouseDown={(e) => startDrag(e.clientX)}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onDoubleClick={onDoubleClick}
        role="slider"
        aria-label={label ?? "Pan"}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        {/* Track */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-full"
          style={{ height: TRACK_H, backgroundColor: "#1A1A1A", borderRadius: 1.5 }}
        />
        {/* Center tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: "calc(50% - 0.5px)", width: 1, height: HEIGHT_PX - 8, backgroundColor: "#333" }}
        />
        {/* AI original — small gold dot behind the thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
          style={{
            left: `${aiPct}%`,
            width: 4,
            height: 4,
            backgroundColor: color,
            opacity: 0.55,
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
          style={{
            left: `${valuePct}%`,
            width: THUMB_D,
            height: THUMB_D,
            backgroundColor: color,
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <span className="text-[9px] font-mono" style={{ color: "#888" }}>{panLabel(value)}</span>
    </div>
  );
}
