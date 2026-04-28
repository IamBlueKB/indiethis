/**
 * RenderDiffCard — modal overlay shown after a Pro Studio re-render
 * completes. Visualizes what changed between the AI Original mix and
 * the freshly rendered studio mix.
 *
 * Step 27 scope:
 *  - Fixed-position overlay (dimmed backdrop, click-outside to close)
 *  - Two mini SVG frequency curves side-by-side (grey before / gold after)
 *  - Plain-English bullet summary from summarizeDiff()
 *  - Independent A/B playback via two HTMLAudioElements (NOT studio audio hook)
 *  - Auto-pauses both <audio> elements when card unmounts/closes
 *
 * The component is purely additive — does not touch the studio audio graph
 * or any layout. It mounts at the end of StudioClient's JSX.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause } from "lucide-react";
import type { StudioState, StemRole } from "./types";
import { summarizeDiff, type DiffAnalysis } from "./summarizeDiff";

export interface RenderDiffCardProps {
  open:            boolean;
  onClose():       void;
  /** State that was rendered into the BEFORE audio (typically AI Original snapshot). */
  beforeState:     Pick<StudioState, "global" | "master">;
  /** State that was rendered into the AFTER audio (current studio state at render time). */
  afterState:      Pick<StudioState, "global" | "master">;
  /** Optional analyses for LUFS / frequency-balance deltas. */
  beforeAnalysis?: DiffAnalysis | null;
  afterAnalysis?:  DiffAnalysis | null;
  /** Signed URLs for A/B playback. If null, the matching button is disabled. */
  beforeAudioUrl?: string | null;
  afterAudioUrl?:  string | null;
  /** Pretty label resolver (e.g. labelForRole from stem-colors). */
  labelForRole?:   (role: StemRole) => string;
}

const EQ_BAND_LABELS  = ["sub", "low", "mid", "high-mid", "air"];

/**
 * Build a 5-point frequency curve from a state's master EQ + master volume.
 * This is a visual approximation; we don't have a true post-render spectrum
 * available client-side. Returns y-coordinates in 0..1 (1 = top of card).
 */
function curveFromState(state: Pick<StudioState, "master">, analysis?: DiffAnalysis | null): number[] {
  const eq   = state.master?.eq ?? [0, 0, 0, 0, 0];
  const vol  = state.master?.volumeDb ?? 0;

  // Optional balance buckets give us 4 points; we interpolate to 5.
  let base = [0, 0, 0, 0, 0];
  const bal = analysis?.balance;
  if (bal && (typeof bal.sub === "number" || typeof bal.low === "number")) {
    const sub  = typeof bal.sub  === "number" ? bal.sub  : 0;
    const low  = typeof bal.low  === "number" ? bal.low  : 0;
    const mid  = typeof bal.mid  === "number" ? bal.mid  : 0;
    const high = typeof bal.high === "number" ? bal.high : 0;
    // 5 points: sub, low, mid, hi-mid (avg of mid+high), high
    base = [sub, low, mid, (mid + high) / 2, high];
  }

  // Combine: base balance + EQ delta + uniform master volume bias.
  return base.map((v, i) => v + (eq[i] ?? 0) + vol * 0.25);
}

/** Map dB-ish values into 0..1 curve y-positions on the SVG (clamped). */
function mapToY(values: number[], padTop = 6, height = 64): number[] {
  // Centre line at 50%; ±12dB ≈ full range.
  const RANGE_DB = 12;
  return values.map((v) => {
    const clamped = Math.max(-RANGE_DB, Math.min(RANGE_DB, v));
    // 0dB → midpoint; +RANGE → top (small y), -RANGE → bottom (large y).
    const norm = (clamped + RANGE_DB) / (2 * RANGE_DB);   // 0..1
    return padTop + (1 - norm) * (height - padTop * 2);
  });
}

function buildPath(yValues: number[], width: number): string {
  if (yValues.length === 0) return "";
  const stepX = width / (yValues.length - 1);
  return yValues
    .map((y, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

function MiniCurve({
  values,
  color,
  title,
}: {
  values: number[];
  color:  string;
  title:  string;
}) {
  const W = 220, H = 80;
  const ys = mapToY(values, 8, H);
  const d  = buildPath(ys, W);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "#888" }}>{title}</span>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`${title} frequency curve`}
        style={{
          backgroundColor: "#0F0E0C",
          border: "1px solid #2A2824",
          borderRadius: 6,
        }}
      >
        {/* Centre baseline */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#1F1D1A" strokeWidth={1} />
        {/* Curve */}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Band labels */}
        {EQ_BAND_LABELS.map((lbl, i) => (
          <text
            key={lbl}
            x={(i * W) / (EQ_BAND_LABELS.length - 1)}
            y={H - 2}
            fontSize={7}
            textAnchor={i === 0 ? "start" : i === EQ_BAND_LABELS.length - 1 ? "end" : "middle"}
            fill="#555"
          >
            {lbl}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function RenderDiffCard(props: RenderDiffCardProps) {
  const {
    open, onClose,
    beforeState, afterState,
    beforeAnalysis, afterAnalysis,
    beforeAudioUrl, afterAudioUrl,
    labelForRole,
  } = props;

  const beforeAudioRef = useRef<HTMLAudioElement | null>(null);
  const afterAudioRef  = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<"before" | "after" | null>(null);

  // Pause + reset whenever the card closes or unmounts.
  useEffect(() => {
    if (open) return;
    try { beforeAudioRef.current?.pause(); } catch { /* noop */ }
    try { afterAudioRef.current?.pause();  } catch { /* noop */ }
    setPlaying(null);
  }, [open]);

  useEffect(() => {
    return () => {
      try { beforeAudioRef.current?.pause(); } catch { /* noop */ }
      try { afterAudioRef.current?.pause();  } catch { /* noop */ }
    };
  }, []);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const summary = useMemo(
    () => summarizeDiff({
      before: beforeState,
      after:  afterState,
      beforeAnalysis,
      afterAnalysis,
      labelForRole,
    }),
    [beforeState, afterState, beforeAnalysis, afterAnalysis, labelForRole],
  );

  const beforeCurve = useMemo(
    () => curveFromState(beforeState, beforeAnalysis),
    [beforeState, beforeAnalysis],
  );
  const afterCurve = useMemo(
    () => curveFromState(afterState, afterAnalysis),
    [afterState, afterAnalysis],
  );

  async function play(which: "before" | "after") {
    const target = which === "before" ? beforeAudioRef.current : afterAudioRef.current;
    const other  = which === "before" ? afterAudioRef.current  : beforeAudioRef.current;
    if (!target) return;
    try { other?.pause(); } catch { /* noop */ }
    try {
      // Match playhead between the two so A/B is in sync.
      if (other && Number.isFinite(other.currentTime)) {
        const t = other.currentTime;
        if (t > 0 && Number.isFinite(target.duration) && t < target.duration) {
          try { target.currentTime = t; } catch { /* noop */ }
        }
      }
      await target.play();
      setPlaying(which);
    } catch {
      setPlaying(null);
    }
  }

  function pauseAll() {
    try { beforeAudioRef.current?.pause(); } catch { /* noop */ }
    try { afterAudioRef.current?.pause();  } catch { /* noop */ }
    setPlaying(null);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-diff-card-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        // Click on the dim backdrop (not the inner card) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#1A1816",
          border: "1px solid #2A2824",
          borderRadius: 12,
          color: "#fff",
          maxWidth: 640,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,67,0.18)",
          padding: 24,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "#D4A843" }}>
              Studio re-render complete
            </span>
            <h2 id="render-diff-card-title" className="text-base font-bold mt-0.5">
              What changed in this mix
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diff card"
            className="p-1 rounded transition-colors"
            style={{ color: "#888" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Curves */}
        <div className="flex gap-4 justify-center mb-5">
          <MiniCurve values={beforeCurve} color="#888888" title="Before" />
          <MiniCurve values={afterCurve}  color="#D4A843" title="After"  />
        </div>

        {/* Bullet summary */}
        <div className="mb-5">
          <span className="text-[10px] uppercase tracking-wider font-bold block mb-2" style={{ color: "#888" }}>
            Changes applied
          </span>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {summary.map((line, i) => (
              <li
                key={i}
                className="text-xs leading-snug py-1 pl-3 relative"
                style={{ color: "#D8D5CF" }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "#D4A843",
                  }}
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* A/B playback */}
        <div className="flex items-center justify-center gap-3 pt-3 border-t" style={{ borderColor: "#2A2824" }}>
          <button
            type="button"
            disabled={!beforeAudioUrl}
            onClick={() => (playing === "before" ? pauseAll() : play("before"))}
            aria-label={playing === "before" ? "Pause Before" : "Play Before"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: playing === "before" ? "#888" : "transparent",
              color:           playing === "before" ? "#0A0A0A" : "#888",
              border:          "1px solid #888",
              opacity:         beforeAudioUrl ? 1 : 0.4,
              cursor:          beforeAudioUrl ? "pointer" : "default",
            }}
          >
            {playing === "before" ? <Pause size={11} /> : <Play size={11} />}
            Before
          </button>
          <button
            type="button"
            disabled={!afterAudioUrl}
            onClick={() => (playing === "after" ? pauseAll() : play("after"))}
            aria-label={playing === "after" ? "Pause After" : "Play After"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: playing === "after" ? "#D4A843" : "transparent",
              color:           playing === "after" ? "#0A0A0A" : "#D4A843",
              border:          "1px solid #D4A843",
              opacity:         afterAudioUrl ? 1 : 0.4,
              cursor:          afterAudioUrl ? "pointer" : "default",
            }}
          >
            {playing === "after" ? <Pause size={11} /> : <Play size={11} />}
            After
          </button>
        </div>

        {/* Hidden audio elements — independent of useStudioAudio. */}
        {beforeAudioUrl && (
          <audio
            ref={beforeAudioRef}
            src={beforeAudioUrl}
            preload="metadata"
            crossOrigin="anonymous"
            onEnded={() => setPlaying((p) => (p === "before" ? null : p))}
            style={{ display: "none" }}
          />
        )}
        {afterAudioUrl && (
          <audio
            ref={afterAudioRef}
            src={afterAudioUrl}
            preload="metadata"
            crossOrigin="anonymous"
            onEnded={() => setPlaying((p) => (p === "after" ? null : p))}
            style={{ display: "none" }}
          />
        )}
      </div>
    </div>
  );
}
