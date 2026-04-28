/**
 * VolumeFader — vertical OR horizontal fader with optional level meter.
 *
 * Spec:
 *   - Range: -inf to +6 dB (taper: 0..0.5 → -60..0, 0.5..1 → 0..+6)
 *   - Center (0 dB) = AI's original gain — gold reference line
 *   - Level meter alongside (vertical) or below (horizontal):
 *     green / amber at -6dB / red at -1dB
 *   - Double-click resets to 0 dB (AI's original)
 *
 * Orientation:
 *   - "vertical" (default, legacy): 120px tall column. Top = +6, bottom = -inf.
 *   - "horizontal": stretches to fill its container width. Left = -inf, right = +6.
 *     The thumb is a wide bevelled bar, gold center reference is a thin vertical
 *     line, level meter sits as a thin strip below the track.
 */

"use client";

import { useEffect, useRef, useState } from "react";

const MIN_DB     = -60;
const MAX_DB     = 6;
const V_HEIGHT   = 120;
const TRACK_T    = 4;              // track thickness (height in horizontal, width in vertical)
const THUMB_LONG = 22;             // along the track
const THUMB_SHORT= 14;             // across the track

function dbToPosition(db: number): number {
  if (db <= MIN_DB) return 0;
  if (db >= MAX_DB) return 1;
  if (db <= 0) return ((db - MIN_DB) / (0 - MIN_DB)) * 0.5;
  return 0.5 + (db / MAX_DB) * 0.5;
}

function positionToDb(pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (p <= 0.5) return MIN_DB + (p / 0.5) * (0 - MIN_DB);
  return ((p - 0.5) / 0.5) * MAX_DB;
}

interface VolumeFaderProps {
  /** Current gain in dB (relative to AI's setting; AI's level = 0). */
  valueDb:      number;
  onChangeDb:   (db: number) => void;
  /** Optional analyser to drive the level meter — live audio readout. */
  analyser?:    AnalyserNode | null;
  /** Stem color for the thumb + center reference. */
  color?:       string;
  /** Accessibility label. */
  label?:       string;
  /** Layout. Defaults to vertical for backward compatibility. */
  orientation?: "vertical" | "horizontal";
  /** Horizontal mode only — pixel height of the entire control. Default 36. */
  height?:      number;
  /** Show dB readout when hovering / dragging. Defaults to true. */
  showReadout?: boolean;
  /** AI's original gain in dB. Renders as a gold reference tick on the track. */
  aiOriginalDb?: number;
}

export function VolumeFader({
  valueDb,
  onChangeDb,
  analyser,
  color = "#D4A843",
  label,
  orientation = "vertical",
  height,
  showReadout = true,
  aiOriginalDb,
}: VolumeFaderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const aiTickRef   = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [hover, setHover]     = useState(false);
  const [pressed, setPressed] = useState(false);

  // ─── Drift pulse on the AI tick (horizontal mode only) ─────────────────
  // The further the user's gain drifts from AI's setting (in track-position
  // space), the more the gold tick breathes on a 3s cycle. Below a 15%
  // threshold it stays static at its baseline opacity.
  const valueRef = useRef(valueDb);    valueRef.current = valueDb;
  const aiRef    = useRef(aiOriginalDb); aiRef.current  = aiOriginalDb;
  useEffect(() => {
    let raf = 0;
    const THRESHOLD = 0.15;             // 15% of full track
    const RANGE     = 1;
    const BASE_OP   = 0.95;             // existing static opacity
    const tick = () => {
      const el = aiTickRef.current;
      if (el) {
        const ai = aiRef.current;
        if (typeof ai === "number") {
          const drift = Math.abs(dbToPosition(valueRef.current) - dbToPosition(ai));
          if (drift <= THRESHOLD) {
            el.style.opacity = String(BASE_OP);
          } else {
            const f    = Math.min(1, (drift - THRESHOLD) / (RANGE - THRESHOLD));
            const sinv = 0.5 + 0.5 * Math.sin(performance.now() / 3000 * Math.PI * 2);
            const min  = 0.5, max = 1.0;
            const amp  = (max - min) * f;
            const center = (min + max) / 2;
            el.style.opacity = String(center - amp / 2 + sinv * amp);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─── Drag handling ───────────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggingRef.current = true;
    setPressed(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY, rect);
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      update(ev.clientX, ev.clientY, rect);
    };
    const onUp = () => {
      draggingRef.current = false;
      setPressed(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup",   onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup",   onUp);
  }

  function update(clientX: number, clientY: number, rect: DOMRect) {
    let pos: number;
    if (orientation === "vertical") {
      const rel = (clientY - rect.top) / rect.height;
      pos = 1 - Math.max(0, Math.min(1, rel));
    } else {
      const rel = (clientX - rect.left) / rect.width;
      pos = Math.max(0, Math.min(1, rel));
    }
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
        const pct = Math.max(0, Math.min(100, ((peakDb - MIN_DB) / (MAX_DB - MIN_DB)) * 100));
        if (orientation === "vertical") node.style.height = `${pct}%`;
        else                            node.style.width  = `${pct}%`;
        if (peakDb >= -1)      node.style.backgroundColor = "#E8554A";
        else if (peakDb >= -6) node.style.backgroundColor = "#D4A843";
        else                   node.style.backgroundColor = "#1D9E75";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== null) cancelAnimationFrame(raf); };
  }, [analyser, orientation]);

  const pos = dbToPosition(valueDb);

  // ─────────────────────────────── HORIZONTAL ───────────────────────────────
  if (orientation === "horizontal") {
    const H = height ?? 36;
    return (
      <div
        className="relative w-full select-none"
        style={{ height: H }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={label}
        role="slider"
        aria-valuemin={MIN_DB}
        aria-valuemax={MAX_DB}
        aria-valuenow={Math.round(valueDb * 10) / 10}
      >
        {/* Track row (clickable) */}
        <div
          ref={trackRef}
          className="absolute left-0 right-0 cursor-pointer"
          style={{ top: H / 2 - TRACK_T / 2 - 6, height: TRACK_T + 12 /* enlarge hit area */ }}
          onPointerDown={startDrag}
          onDoubleClick={onDoubleClick}
        >
          {/* Track */}
          <div
            className="absolute left-0 right-0"
            style={{ top: 6, height: TRACK_T, backgroundColor: "#1A1816", borderRadius: 2 }}
          />
          {/* Played fill from left edge to thumb (in stem color, low alpha) */}
          <div
            className="absolute left-0"
            style={{
              top:    6,
              height: TRACK_T,
              width:  `${pos * 100}%`,
              background: `linear-gradient(90deg, ${color}33 0%, ${color}aa 100%)`,
              borderRadius: 2,
              transition: draggingRef.current ? "none" : "width 50ms ease-out",
            }}
          />
          {/* Gold center reference (= AI's 0dB delta) */}
          <div
            className="absolute"
            style={{
              left: `${dbToPosition(0) * 100}%`,
              top:  2,
              width:  1,
              height: TRACK_T + 8,
              backgroundColor: "#D4A843",
              opacity: 0.32,
            }}
          />
          {/* AI's original gain — taller bright gold tick. Opacity is
              driven by the drift-pulse rAF — see `aiTickRef` effect above. */}
          {typeof aiOriginalDb === "number" && (
            <div
              ref={aiTickRef}
              className="absolute pointer-events-none"
              style={{
                left:    `${dbToPosition(aiOriginalDb) * 100}%`,
                top:     0,
                width:   2,
                height:  TRACK_T + 14,
                marginLeft: -1,
                background: "linear-gradient(180deg, #F1D27A 0%, #D4A843 100%)",
                boxShadow:  "0 0 4px rgba(212,168,67,0.65)",
                borderRadius: 1,
                opacity: 0.95,
              }}
              title={`AI set ${aiOriginalDb >= 0 ? "+" : ""}${aiOriginalDb.toFixed(1)} dB`}
            />
          )}
          {/* Thumb */}
          <div
            className="absolute rounded"
            style={{
              left: `calc(${pos * 100}% - ${THUMB_LONG / 2}px)`,
              top:  6 + TRACK_T / 2 - THUMB_SHORT / 2,
              width:  THUMB_LONG,
              height: THUMB_SHORT,
              background: `linear-gradient(180deg, ${color} 0%, ${shade(color, -0.25)} 100%)`,
              boxShadow: pressed
                ? `0 1px 0 rgba(255,255,255,0.28) inset, 0 3px 9px rgba(0,0,0,0.6), 0 0 8px ${color}88`
                : "0 1px 0 rgba(255,255,255,0.18) inset, 0 2px 6px rgba(0,0,0,0.55)",
              border: `0.5px solid ${shade(color, -0.4)}`,
              transform: pressed ? "scale(1.05)" : "scale(1)",
              transformOrigin: "center",
              // Position transition disabled while dragging (scrubs feel laggy
              // otherwise). Transform + shadow always animate so the
              // grab/release pop has its 50ms soft landing.
              transition: `${draggingRef.current ? "" : "left 50ms ease-out, "}transform 50ms ease-out, box-shadow 50ms ease-out`,
            }}
          />
        </div>

        {/* Inline level meter — thin strip below the track */}
        {analyser && (
          <div
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              bottom: 2,
              height: 3,
              backgroundColor: "#0A0A0A",
              borderRadius: 2,
            }}
          >
            <div
              ref={meterRef}
              className="absolute left-0 top-0 bottom-0"
              style={{ width: "0%", backgroundColor: "#1D9E75", transition: "width 30ms linear" }}
            />
          </div>
        )}

        {/* dB readout — only on hover/drag */}
        {showReadout && (
          <span
            className="absolute font-mono text-[9px] pointer-events-none"
            style={{
              right: 0,
              top:   0,
              color:    hover || draggingRef.current ? "#D4A843" : "#444",
              opacity:  hover || draggingRef.current ? 1 : 0,
              transition: "opacity 150ms ease",
            }}
          >
            {valueDb >= 0 ? `+${valueDb.toFixed(1)}` : valueDb.toFixed(1)} dB
          </span>
        )}
      </div>
    );
  }

  // ─────────────────────────────── VERTICAL (legacy) ────────────────────────
  const thumbY  = (1 - pos) * (V_HEIGHT - THUMB_SHORT);
  const centerY = (1 - 0.5) * (V_HEIGHT - THUMB_SHORT) + THUMB_SHORT / 2;

  return (
    <div className="flex items-end gap-1 select-none" aria-label={label} role="slider"
         aria-valuemin={MIN_DB} aria-valuemax={MAX_DB} aria-valuenow={Math.round(valueDb * 10) / 10}>

      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: V_HEIGHT, width: THUMB_LONG }}
        onPointerDown={startDrag}
        onDoubleClick={onDoubleClick}
      >
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: TRACK_T, height: V_HEIGHT, backgroundColor: "#1A1A1A", borderRadius: 2 }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: centerY - 0.5,
            width: THUMB_LONG + 4,
            height: 1,
            marginLeft: -2,
            backgroundColor: color,
            opacity: 0.45,
          }}
        />
        <div
          className="absolute left-1/2 rounded-sm"
          style={{
            top: thumbY,
            width: THUMB_LONG,
            height: THUMB_SHORT,
            backgroundColor: color,
            boxShadow: pressed
              ? `0 3px 8px rgba(0,0,0,0.55), 0 0 8px ${color}88`
              : "0 1px 3px rgba(0,0,0,0.4)",
            transform:       pressed ? "translateX(-50%) scale(1.05)" : "translateX(-50%)",
            transformOrigin: "center",
            transition:      "transform 50ms ease-out, box-shadow 50ms ease-out",
          }}
        />
      </div>

      {analyser && (
        <div
          className="relative overflow-hidden"
          style={{ height: V_HEIGHT, width: 4, backgroundColor: "#0A0A0A", borderRadius: 2 }}
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

/** Lighten/darken a hex color by `amount` in [-1..1]. */
function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  const k = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c * (1 - t) + k * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
