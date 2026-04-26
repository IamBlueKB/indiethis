"use client";

/**
 * ConsoleStats — Output measurements bar (LUFS / Peak / Range / Width).
 *
 * 4 cells in a single row showing what the engine actually produced, measured
 * by the QA gate on the rendered file (falls back to mixParameters targets
 * when QA hasn't run). Source: `load-mix-data.ts → extractOutputAnalysis()`.
 *
 * Each cell shows:
 *   • Tiny gold uppercase label (10px)
 *   • Big value (15px)
 *   • Status dot (4px) — green inside spec, gold near edge, muted off-spec/no-data
 *   • title attribute with the streaming target so the artist knows what the
 *     number means without us cluttering the card
 *
 * Targets (industry consensus for streaming masters):
 *   LUFS   −14 ± 1.5  (Spotify/Apple/YouTube normalize to −14)
 *   Peak    −1 ± 0.5  (true-peak ceiling so codecs don't clip)
 *   Range    4–8      (modern pop/hiphop sweet spot; >12 = dynamic, <3 = squashed)
 *   Width   80–120%   (mono-compatible but not narrow; >150 = phasey)
 *
 * No interactivity — just transparency. A future revision could surface a
 * 1-line plain-English verdict per cell ("Streaming-ready") on hover.
 */

import type { OutputAnalysis } from "./types";

type StatusTone = "good" | "edge" | "muted";

interface Cell {
  label:   string;
  value:   string;
  tone:    StatusTone;
  tooltip: string;
}

const TONE_DOT: Record<StatusTone, string> = {
  good:  "#1D9E75", // green — inside spec
  edge:  "#D4AF37", // gold — near boundary
  muted: "#3A3833", // dim  — missing or off-spec
};

const TONE_LABEL: Record<StatusTone, string> = {
  good:  "inside spec",
  edge:  "near boundary",
  muted: "off spec or unmeasured",
};

function classifyLufs(v: number): StatusTone {
  const d = Math.abs(v - -14);
  if (d <= 1.5) return "good";
  if (d <= 3.0) return "edge";
  return "muted";
}

function classifyPeak(v: number): StatusTone {
  // True-peak: −1.0 dBTP is the streaming ceiling. Anything above −0.5 risks
  // codec clipping; below −2 wastes headroom.
  if (v <= -0.8 && v >= -2.0) return "good";
  if (v <= -0.3 && v >= -3.0) return "edge";
  return "muted";
}

function classifyRange(v: number): StatusTone {
  if (v >= 4 && v <= 8)  return "good";
  if (v >= 3 && v <= 12) return "edge";
  return "muted";
}

function classifyWidth(pct: number): StatusTone {
  if (pct >= 80 && pct <= 120)  return "good";
  if (pct >= 60 && pct <= 150)  return "edge";
  return "muted";
}

function buildCells(a: OutputAnalysis): Cell[] {
  const widthPct = Math.round(a.stereoWidth * 100);
  return [
    {
      label:   "LUFS",
      value:   a.lufs.toFixed(1),
      tone:    classifyLufs(a.lufs),
      tooltip: "Integrated loudness. Streaming target: −14 LUFS.",
    },
    {
      label:   "Peak",
      value:   a.truePeak.toFixed(1),
      tone:    classifyPeak(a.truePeak),
      tooltip: "True-peak ceiling. Target: −1.0 dBTP for safe codec headroom.",
    },
    {
      label:   "Range",
      value:   a.loudnessRange > 0 ? a.loudnessRange.toFixed(1) : "—",
      tone:    a.loudnessRange > 0 ? classifyRange(a.loudnessRange) : "muted",
      tooltip: "Dynamic range (LU). Modern pop/hiphop sits 4–8 LU.",
    },
    {
      label:   "Width",
      value:   `${widthPct}%`,
      tone:    classifyWidth(widthPct),
      tooltip: "Stereo width. 100% = natural; 80–120% stays mono-compatible.",
    },
  ];
}

export interface ConsoleStatsProps {
  analysis: OutputAnalysis | null;
}

export function ConsoleStats({ analysis }: ConsoleStatsProps) {
  if (!analysis) return null;
  const cells = buildCells(analysis);

  return (
    <section
      aria-label="Output measurements"
      className="grid grid-cols-4 gap-2"
    >
      {cells.map(c => (
        <div
          key={c.label}
          title={c.tooltip}
          aria-label={`${c.label} ${c.value}, ${TONE_LABEL[c.tone]}. ${c.tooltip}`}
          className="rounded-lg px-2 py-3 text-center relative"
          style={{ backgroundColor: "#1a1816", border: "1px solid #2A2824" }}
        >
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 inline-block rounded-full"
            style={{ width: 4, height: 4, backgroundColor: TONE_DOT[c.tone] }}
          />
          <p
            className="mb-1"
            aria-hidden="true"
            style={{ fontSize: 10, color: "#888", letterSpacing: "0.5px" }}
          >
            {c.label}
          </p>
          <p
            aria-hidden="true"
            style={{ fontSize: 15, fontWeight: 500, color: "#eee" }}
          >
            {c.value}
          </p>
        </div>
      ))}
    </section>
  );
}
