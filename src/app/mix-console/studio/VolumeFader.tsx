/**
 * VolumeFader — vertical fader with optional real-time level meter.
 *
 * Spec:
 *   - 120px tall, vertical slider
 *   - Range: -inf to +6 dB
 *   - Center (0 dB) = AI's original gain — gold reference line
 *   - Level meter alongside: green / yellow at -6dB / red at -1dB
 *
 * The fader drives a 0–1 normalized `position` internally and exposes
 * the equivalent dB value to the parent via `valueDb` + `onChangeDb`.
 *
 * Position taper (so center = 0dB):
 *   pos ∈ [0, 0.5] → dB ∈ [-60, 0]   (linear in dB)
 *   pos ∈ [0.5, 1] → dB ∈ [0, +6]    (linear in dB)
 */

"use client";

import { useEffect, useRef } from "react";

const MIN_DB     = -60;
const MAX_DB     = 6;
const HEIGHT_PX  = 120;
const TRACK_W    = 4;
const THUMB_H    = 14;
const THUMB_W    = 22;

function dbToPosition(db: number): number {
  if (db <= MIN_DB) return 0;
  if (db >= MAX_DB) return 1;
  if (db <= 0) {
    // -60..0 maps to 0..0.5
    return ((db - MIN_DB) / (0 - MIN_DB)) * 0.5;
  }
  // 0..+6 maps to 0.5..1
  return 0.5 + (db / MAX_DB) * 0.5;
}

function positionToDb(pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (p <= 0.5) {
    return MIN_DB + (p / 0.5) * (0 - MIN_DB);
  }
  return ((p - 0.5) / 0.5) * MAX_DB;
}

interface VolumeFaderProps {
  /** Current gain in dB (relative to AI's setting; AI's level = 0). */
  valueDb:      number;
  onChangeDb:   (db: number) => void;
  /** Optional analyser to drive the level meter — live audio readout. */
  analyser?:    AnalyserNode | null;
  /** Stem color for the level meter peak indicator (matches strip color). */
  color?:       string;
  /** Accessibility label. */
  label?:       string;
}

export function VolumeFader({ valueDb, onChangeDb, analyser, color = "#D4A843", label }: VolumeFaderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // ─── Drag handling ───────────────────────────────────────────────────────
  function startDrag(clientY: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggingRef.current = true;
    update(clientY, rect);
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      update(y, rect);
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

  function update(clientY: number, rect: DOMRect) {
    // Top of track = pos 1 (max). Bottom = pos 0.
    const rel = (clientY - rect.top) / rect.height;
    const pos = 1 - Math.max(0, Math.min(1, rel));
    onChangeDb(positionToDb(pos));
  }

  // Double-click resets to 0 dB (AI's original).
  function onDoubleClick() {
    onChangeDb(0);
  }

  // ─── Live level meter (peak from time-domain) ────────────────────────────
  useEffect(() => {
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    let raf: number | null = null;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : MIN_DB;
      const node = meterRef.current;
      if (node) {
        // Map -60..+6 → 0..100% height for the meter fill.
        const pct = Math.max(0, Math.min(100, ((peakDb - MIN_DB) / (MAX_DB - MIN_DB)) * 100));
        node.style.height = `${pct}%`;
        // Color: green default, yellow at -6dB, red at -1dB
        if (peakDb >= -1)      node.style.backgroundColor = "#E8554A";
        else if (peakDb >= -6) node.style.backgroundColor = "#D4A843";
        else                   node.style.backgroundColor = "#1D9E75";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== null) cancelAnimationFrame(raf); };
  }, [analyser]);

  const pos     = dbToPosition(valueDb);
  const thumbY  = (1 - pos) * (HEIGHT_PX - THUMB_H);
  const centerY = (1 - 0.5) * (HEIGHT_PX - THUMB_H) + THUMB_H / 2;

  return (
    <div className="flex items-end gap-1 select-none" aria-label={label} role="slider"
         aria-valuemin={MIN_DB} aria-valuemax={MAX_DB} aria-valuenow={Math.round(valueDb * 10) / 10}>

      {/* Fader track + thumb */}
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: HEIGHT_PX, width: THUMB_W }}
        onMouseDown={(e) => startDrag(e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientY)}
        onDoubleClick={onDoubleClick}
      >
        {/* Track */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: TRACK_W, height: HEIGHT_PX, backgroundColor: "#1A1A1A", borderRadius: 2 }}
        />
        {/* Gold center reference line (= AI's 0dB) */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: centerY - 0.5,
            width: THUMB_W + 4,
            height: 1,
            marginLeft: -2,
            backgroundColor: color,
            opacity: 0.45,
          }}
        />
        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm"
          style={{
            top: thumbY,
            width: THUMB_W,
            height: THUMB_H,
            backgroundColor: color,
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>

      {/* Level meter — only if analyser provided */}
      {analyser && (
        <div
          className="relative overflow-hidden"
          style={{ height: HEIGHT_PX, width: 4, backgroundColor: "#0A0A0A", borderRadius: 2 }}
        >
          <div
            ref={meterRef}
            className="absolute bottom-0 left-0 right-0"
            style={{ height: "0%", backgroundColor: "#1D9E75", transition: "height 30ms linear" }}
          />
        </div>
      )}
    </div>
  );
}
