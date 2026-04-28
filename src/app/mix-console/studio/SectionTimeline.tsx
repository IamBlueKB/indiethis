/**
 * SectionTimeline — bottom strip showing song sections + playhead.
 *
 * Three jobs:
 *   1. Navigation — click any section to seek to its start; click/drag the
 *      timeline anywhere to scrub.
 *   2. Editing scope — click selects a section as the editing context; knob
 *      changes from then on write to the sections[name] override map instead
 *      of the global per-stem state. "Global Mix" pill resets to global.
 *   3. Visual map — full song waveform sits behind the section labels so the
 *      artist sees energy + structure together. Past playhead is colored,
 *      future is dim.
 *
 * Section labels use proper title case (Intro / Verse 1 / Chorus) and grow
 * to fill their proportional width — auto-truncation only kicks in when a
 * section is genuinely too short to fit. Section buttons are translucent
 * overlays so the waveform shows through behind them.
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SongSection } from "./types";

interface SectionTimelineProps {
  sections:        SongSection[];
  duration:        number;
  currentTime:     number;
  selectedSection: string | null;
  onSelect:        (name: string | null) => void;
  onSeek:          (seconds: number) => void;
  /** Returns combined max-abs peaks for the song (any bins ≥ 1). Null until decode. */
  getPeaks?:       (bins: number) => Float32Array | null;
}

const GOLD = "#D4A843";

function prettyName(raw: string): string {
  // "verse1" → "Verse 1", "chorus" → "Chorus"
  const m = raw.match(/^([a-z]+)(\d+)?$/i);
  if (!m) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const word = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return m[2] ? `${word} ${m[2]}` : word;
}

export function SectionTimeline(props: SectionTimelineProps) {
  const { sections, duration, currentTime, selectedSection, onSelect, onSeek, getPeaks } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef  = useRef<HTMLDivElement | null>(null);

  const activeSection = useMemo(() => {
    for (const s of sections) {
      if (currentTime >= s.start && currentTime < s.end) return s.name;
    }
    return null;
  }, [sections, currentTime]);

  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Draw combined waveform behind the section row.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w   = c.clientWidth;
    const h   = c.clientHeight;
    if (w === 0 || h === 0) return;
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width  = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bins  = Math.max(40, Math.min(400, Math.floor(w / 3)));
    const peaks = getPeaks ? getPeaks(bins) : null;
    if (!peaks) return;

    const barW     = w / peaks.length;
    const playedPx = w * (duration > 0 ? Math.min(1, currentTime / duration) : 0);

    for (let i = 0; i < peaks.length; i++) {
      const x    = i * barW;
      const amp  = Math.max(0.04, peaks[i]);
      const barH = amp * (h * 0.85);
      const y    = (h - barH) / 2;
      ctx.fillStyle = x + barW <= playedPx
        ? "rgba(212,168,67,0.55)"
        : "rgba(255,255,255,0.13)";
      ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
    }
  }, [getPeaks, currentTime, duration, sections.length]);

  // Click + drag to scrub anywhere on the timeline track.
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    onSeek((x / rect.width) * duration);
  };

  return (
    <div
      className="flex items-center px-4 py-2 border-t gap-2"
      style={{
        backgroundColor: "#141210",
        borderColor:     "#1f1d1a",
        minHeight:       64,
      }}
    >
      {/* "Global mix" pill — null selection = edit globals. */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors shrink-0"
        style={{
          backgroundColor: selectedSection === null ? GOLD       : "transparent",
          color:           selectedSection === null ? "#0A0A0A"  : "#888",
          border:          `1px solid ${selectedSection === null ? GOLD : "#2A2824"}`,
        }}
        title="Edit the whole song. Knob changes apply globally."
      >
        Global Mix
      </button>

      {sections.length === 0 && !getPeaks ? (
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#444" }}>
          No sections detected
        </span>
      ) : (
        <div
          ref={trackRef}
          className="relative flex-1"
          style={{ height: 48 }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            handlePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handlePointer(e);
          }}
        >
          {/* Waveform canvas — fills the entire track. */}
          <canvas
            ref={canvasRef}
            style={{
              position:        "absolute",
              inset:           0,
              width:           "100%",
              height:          "100%",
              borderRadius:    6,
              backgroundColor: "rgba(0,0,0,0.35)",
              pointerEvents:   "none",
            }}
          />

          {/* Section overlays — translucent so waveform shows through.
              Widths sum to exactly 100% (no padding/gap) and shrink is
              disabled so every section renders even when there are many. */}
          <div className="absolute inset-0 flex items-stretch">
            {sections.map((s) => {
              const w        = duration > 0 ? ((s.end - s.start) / duration) * 100 : 0;
              const selected = selectedSection === s.name;
              const playing  = activeSection  === s.name;
              return (
                <button
                  key={s.name + s.start}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(s.name);
                    onSeek(s.start);
                  }}
                  className="relative text-[10px] font-semibold transition-all overflow-hidden whitespace-nowrap flex items-center justify-center"
                  style={{
                    width:           `${w}%`,
                    minWidth:        0,
                    flexShrink:      0,
                    flexGrow:        0,
                    backgroundColor: selected ? "rgba(212,168,67,0.72)"
                                    : playing  ? "rgba(212,168,67,0.18)"
                                               : "rgba(20,18,16,0.45)",
                    color:           selected ? "#0A0A0A"
                                    : playing  ? "#F5E6B3"
                                               : "#CFCAC2",
                    borderRight:     "1px solid rgba(212,168,67,0.18)",
                    borderTop:       `1px solid ${selected ? GOLD
                                                  : playing ? "rgba(212,168,67,0.55)"
                                                            : "rgba(212,168,67,0.12)"}`,
                    borderBottom:    `1px solid ${selected ? GOLD
                                                  : playing ? "rgba(212,168,67,0.55)"
                                                            : "rgba(212,168,67,0.12)"}`,
                    backdropFilter:  "blur(2px)",
                    cursor:          "pointer",
                    padding:         "0 4px",
                    textShadow:      selected ? "none" : "0 1px 1px rgba(0,0,0,0.6)",
                  }}
                  title={`${prettyName(s.name)} · ${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s`}
                >
                  <span
                    className="truncate"
                    style={{ maxWidth: "100%", letterSpacing: "0.02em" }}
                  >
                    {prettyName(s.name)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Playhead — thin gold line with a soft layered halo so it reads
              like a warm light source crossing the timeline rather than a
              hard neon stripe. Three stacked shadows: tight inner core
              (~5px @ 35%), mid bloom (~12px @ 22%), wide warm wash
              (~22px @ 10%). */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left:            `${playheadPct}%`,
                width:           1.5,
                backgroundColor: GOLD,
                boxShadow: [
                  "0 0 5px  rgba(212,168,67,0.35)",
                  "0 0 12px rgba(212,168,67,0.22)",
                  "0 0 22px rgba(212,168,67,0.10)",
                ].join(", "),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
