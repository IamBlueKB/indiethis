/**
 * MasterEqRow — 5-band master EQ as a graphic-EQ slider strip.
 *
 * Bands match the persistent biquad chain in useStudioAudio.ts:
 *   0  Bass      60 Hz    lowshelf
 *   1  Warmth    250 Hz   peaking
 *   2  Body      1 kHz    peaking
 *   3  Presence  4 kHz    peaking
 *   4  Sparkle   12 kHz   highshelf
 *
 * Plain-English names so the artist isn't reading "1kHz peaking" — frequency
 * labels live in the hover tooltip for anyone who wants the technical detail.
 *
 * Vertical sliders (graphic-EQ style) — five of them fit comfortably in the
 * 120px master strip and feel familiar (car stereo / iTunes EQ). ±6 dB range,
 * gold center reference line at 0 dB (= flat = AI's setting). Double-click a
 * thumb to reset that band to flat.
 */

"use client";

import { useRef } from "react";

const BANDS = [
  { name: "Bass",     freq: "60 Hz" },
  { name: "Warmth",   freq: "250 Hz" },
  { name: "Body",     freq: "1 kHz" },
  { name: "Presence", freq: "4 kHz" },
  { name: "Sparkle",  freq: "12 kHz" },
] as const;

const GOLD       = "#D4A843";
const SLIDER_H   = 70;        // px — track height
const SLIDER_W   = 18;        // px — column width per band
const THUMB_H    = 8;
const THUMB_W    = 14;
const MIN_DB     = -6;
const MAX_DB     = 6;

interface MasterEqRowProps {
  /** Current ±6 dB gain per band. */
  values:   readonly [number, number, number, number, number];
  /** Called when a band's dB value changes. */
  onChange: (index: 0 | 1 | 2 | 3 | 4, gainDb: number) => void;
}

function dbToY(db: number): number {
  // 0 dB sits at the center of the track; +6 at top, -6 at bottom.
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  const pos     = (clamped - MIN_DB) / (MAX_DB - MIN_DB);  // 0..1, bottom→top
  return (1 - pos) * (SLIDER_H - THUMB_H);
}

export function MasterEqRow({ values, onChange }: MasterEqRowProps) {
  return (
    <div className="flex justify-between items-stretch w-full">
      {BANDS.map((band, i) => (
        <Band
          key={band.name}
          name={band.name}
          freq={band.freq}
          db={values[i]}
          onChange={(db) => onChange(i as 0 | 1 | 2 | 3 | 4, db)}
        />
      ))}
    </div>
  );
}

interface BandProps {
  name:     string;
  freq:     string;
  db:       number;
  onChange: (db: number) => void;
}

function Band({ name, freq, db, onChange }: BandProps) {
  const trackRef    = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

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
    const rel = (clientY - rect.top) / rect.height;
    const pos = 1 - Math.max(0, Math.min(1, rel));   // 0..1 bottom→top
    const newDb = MIN_DB + pos * (MAX_DB - MIN_DB);
    onChange(newDb);
  }

  function onDoubleClick() {
    onChange(0);  // reset to flat
  }

  const thumbY = dbToY(db);
  const fillTop    = db > 0 ? thumbY + THUMB_H / 2 : SLIDER_H / 2;
  const fillBottom = db > 0 ? SLIDER_H / 2         : thumbY + THUMB_H / 2;
  const fillHeight = Math.max(0, fillBottom - fillTop);

  return (
    <div
      className="flex flex-col items-center gap-1 select-none"
      style={{ width: SLIDER_W }}
      title={`${name} — ${freq}`}
    >
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: SLIDER_H, width: SLIDER_W }}
        onMouseDown={(e)  => startDrag(e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientY)}
        onDoubleClick={onDoubleClick}
        role="slider"
        aria-label={`${name} (${freq})`}
        aria-valuemin={MIN_DB}
        aria-valuemax={MAX_DB}
        aria-valuenow={Math.round(db * 10) / 10}
      >
        {/* Track */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: 4, height: SLIDER_H, backgroundColor: "#1A1A1A", borderRadius: 2 }}
        />
        {/* Gold center reference line — 0 dB / flat */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: SLIDER_H / 2 - 0.5,
            width: SLIDER_W + 4,
            marginLeft: -2,
            height: 1,
            backgroundColor: GOLD,
            opacity: 0.45,
          }}
        />
        {/* Color-fill bar from center toward thumb */}
        {fillHeight > 0 && (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: fillTop,
              width: 4,
              height: fillHeight,
              backgroundColor: GOLD,
              opacity: 0.7,
              borderRadius: 2,
            }}
          />
        )}
        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm"
          style={{
            top: thumbY,
            width: THUMB_W,
            height: THUMB_H,
            backgroundColor: GOLD,
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      {/* Band name (full word, plain English) */}
      <span
        className="text-[7px] uppercase tracking-wider leading-none text-center"
        style={{ color: "#888", marginTop: 1 }}
      >
        {name}
      </span>
    </div>
  );
}
