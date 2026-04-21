"use client";

/**
 * MasterPreviewPlayer
 * Full compare-screen player per the indiethis-mastering-preview-player-spec.
 *
 * Layout (top-to-bottom):
 *   1. Logo-shaped SVG ring player with coral play/pause + gold sweep
 *   2. Track info — version name, mastered/unmastered label, time counter
 *   3. Reference note (only when referenceFileName set)
 *   4. A/B toggle — Original ↔ Mastered with volume normalisation
 *   5. Dual waveform canvas
 *   6. Version boxes (Clean / Warm / Punch / Loud)
 *   7. Console stats (LUFS / Peak / Range / Width)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerVersion {
  name:        string;    // "Clean" | "Warm" | "Punch" | "Loud"
  url:         string;    // full master file URL (fallback when no preview clip)
  lufs:        number;
  previewPath?: string;   // Supabase path for 30s clip — fetched fresh on demand
}

export interface MasterPreviewPlayerProps {
  jobId:             string;
  versions:          PlayerVersion[];
  previewUrl:        string;          // single 30s preview clip (Phase 1 — same clip for all versions)
  originalUrl:       string | null;   // original uploaded file
  inputLufs:         number | null;   // from analysisData
  referenceFileName?: string | null;
  referenceTrackUrl?: string | null;
  previewWaveform?:  number[] | null; // 200 floats — original waveform
  versionWaveforms?: Record<string, number[]> | null; // { clean, warm, punch, loud }
  versionStats?:     Record<string, { lufs: number; peak: number; range: number; width: number }> | null;
  onVersionChange?:  (name: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD   = "#D4A843";
const CORAL  = "#E8735A";
const PREVIEW_DURATION = 30;

const VERSION_DESCS: Record<string, string> = {
  Clean: "Transparent, natural",
  Warm:  "Rich low end, smooth",
  Punch: "Mid presence, tight",
  Loud:  "Maximized, bold",
};

// Rounded-square SVG path starting at top-center, clockwise
// W=200, H=200, R=60 (30% corner radius)
const SQ = 200;
const R  = 60;
const RING_PATH = [
  `M ${SQ / 2},0`,
  `L ${SQ - R},0`,
  `Q ${SQ},0 ${SQ},${R}`,
  `L ${SQ},${SQ - R}`,
  `Q ${SQ},${SQ} ${SQ - R},${SQ}`,
  `L ${R},${SQ}`,
  `Q 0,${SQ} 0,${SQ - R}`,
  `L 0,${R}`,
  `Q 0,0 ${R},0`,
  `Z`,
].join(" ");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec: number) {
  const s = Math.floor(sec);
  return `0:${String(s).padStart(2, "0")}`;
}

function lufsToVol(gainDb: number): number {
  return Math.min(1, Math.max(0.01, Math.pow(10, gainDb / 20)));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MasterPreviewPlayer({
  jobId,
  versions,
  previewUrl,
  originalUrl,
  inputLufs,
  referenceFileName,
  referenceTrackUrl,
  previewWaveform,
  versionWaveforms,
  versionStats,
  onVersionChange,
}: MasterPreviewPlayerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isOriginal,  setIsOriginal]  = useState(false);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pathLen,     setPathLen]     = useState(0);

  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const svgPathRef = useRef<SVGPathElement | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef     = useRef<number>(0);
  const animRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = versions[selectedIdx] ?? versions[0];

  // ── Audio source resolution ──────────────────────────────────────────────

  function getAudioSrc(vIdx: number, original: boolean): string {
    if (original) return previewUrl; // Phase 1: same clip, volume-normalised
    // Phase 1: single preview URL for all versions
    return previewUrl || versions[vIdx]?.url || "";
  }

  // ── Init audio element ───────────────────────────────────────────────────

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.src = getAudioSrc(selectedIdx, isOriginal);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => { setIsPlaying(false); setCurrentTime(0); };
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Measure SVG path length on mount ─────────────────────────────────────

  useEffect(() => {
    if (svgPathRef.current) {
      setPathLen(svgPathRef.current.getTotalLength());
    }
  }, []);

  // ── Progress sweep ───────────────────────────────────────────────────────

  const progress = PREVIEW_DURATION > 0 ? currentTime / PREVIEW_DURATION : 0;
  const dashOffset = pathLen > 0 ? pathLen * (1 - progress) : pathLen;

  // ── Draw waveform canvas ─────────────────────────────────────────────────

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const vKey = (selected?.name ?? "warm").toLowerCase();
    const origData: number[] = previewWaveform ?? Array(200).fill(0.5);
    const masterData: number[] = (versionWaveforms?.[vKey] ?? origData);
    const pts = origData.length;

    // Bar chart waveform — discrete bars with gaps, mirrored top/bottom
    const BAR_W  = 2;           // px width of each bar
    const GAP    = 1;           // px gap between bars
    const SLOT   = BAR_W + GAP; // px per bar slot
    const numBars = Math.floor(W / SLOT);
    const midY   = H / 2;

    const drawBars = (data: number[], color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      for (let i = 0; i < numBars; i++) {
        const dataIdx = Math.round((i / numBars) * (pts - 1));
        const amp = Math.max(1, data[dataIdx] * (midY - 4));
        const x = i * SLOT;
        ctx.fillRect(x, midY - amp, BAR_W, amp);  // top half
        ctx.fillRect(x, midY,       BAR_W, amp);  // bottom half (mirror)
      }
      ctx.restore();
    };

    // Original: grey at 20% — always visible
    drawBars(origData, "#888", 0.20);
    // Mastered: gold at 65%, drawn on top — hidden when viewing original
    if (!isOriginal) {
      drawBars(masterData, GOLD, 0.65);
    }

    // Playhead
    const playX = progress * W;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, H);
    ctx.stroke();
    ctx.restore();
  }, [selected, previewWaveform, versionWaveforms, isOriginal, progress]);

  useEffect(() => { drawWaveform(); }, [drawWaveform]);

  // ── Switch audio source (version or A/B change) ──────────────────────────

  function switchSource(vIdx: number, original: boolean, keepTime = false) {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = isPlaying;
    const prevTime   = keepTime ? audio.currentTime : 0;
    audio.pause();
    audio.src = getAudioSrc(vIdx, original);
    audio.load();
    audio.currentTime = prevTime;

    // Volume normalisation
    const vLufs = versions[vIdx]?.lufs ?? -14;
    const oLufs = inputLufs ?? -18;
    if (original) {
      // Boost original so it sounds as loud as the mastered version
      audio.volume = lufsToVol(vLufs - oLufs);
    } else {
      audio.volume = 1;
    }

    if (wasPlaying) audio.play().catch(() => {});
  }

  // ── Play / Pause ─────────────────────────────────────────────────────────

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }

  // ── A/B toggle ───────────────────────────────────────────────────────────

  function toggleAB(toOriginal: boolean) {
    if (toOriginal === isOriginal) return;
    setIsOriginal(toOriginal);
    switchSource(selectedIdx, toOriginal, true);
  }

  // ── Version select ───────────────────────────────────────────────────────

  function selectVersion(idx: number) {
    if (idx === selectedIdx) return;
    setSelectedIdx(idx);
    onVersionChange?.(versions[idx]?.name ?? "");
    switchSource(idx, isOriginal, true);
  }

  // ── Scrub on SVG ring ────────────────────────────────────────────────────

  function handleRingScrub(e: React.MouseEvent<SVGSVGElement>) {
    const rect   = e.currentTarget.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;
    const dx     = e.clientX - cx;
    const dy     = e.clientY - cy;
    // Angle from top-center (12 o'clock), clockwise
    const angle  = (Math.atan2(dx, -dy) + Math.PI) / (2 * Math.PI); // 0-1
    const seekTo = angle * PREVIEW_DURATION;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }

  // ── Scrub on waveform canvas ─────────────────────────────────────────────

  function handleWaveformScrub(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect   = e.currentTarget.getBoundingClientRect();
    const ratio  = (e.clientX - rect.left) / rect.width;
    const seekTo = Math.max(0, Math.min(PREVIEW_DURATION, ratio * PREVIEW_DURATION));
    if (audioRef.current) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }

  // ── Stats for current state ──────────────────────────────────────────────

  const vKey  = (selected?.name ?? "warm").toLowerCase();
  const stats = isOriginal
    ? { lufs: inputLufs ?? -18, peak: -1.5, range: 12, width: 60 }
    : (versionStats?.[vKey] ?? { lufs: selected?.lufs ?? -14, peak: -0.3, range: 8, width: 80 });

  const statMeters = [
    { label: "LUFS",  value: stats.lufs.toFixed(1),  bar: Math.min(100, (stats.lufs + 24) / 24 * 100), gold: !isOriginal },
    { label: "Peak",  value: stats.peak.toFixed(1),  bar: Math.min(100, (stats.peak + 6)  / 6  * 100), gold: false },
    { label: "Range", value: String(Math.round(stats.range)), bar: Math.min(100, stats.range / 20 * 100), gold: !isOriginal },
    { label: "Width", value: `${Math.round(stats.width)}%`,   bar: Math.min(100, stats.width),             gold: false },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 select-none">

      {/* ── 1. Logo-shaped ring player ──────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: 180, height: 180 }}>
          <svg
            viewBox={`0 0 ${SQ} ${SQ}`}
            width="180" height="180"
            onClick={handleRingScrub}
            className="cursor-pointer"
            style={{ display: "block" }}
          >
            {/* Background ring */}
            <path
              d={RING_PATH}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={6}
            />
            {/* Gold progress sweep */}
            <path
              ref={svgPathRef}
              d={RING_PATH}
              fill="none"
              stroke={GOLD}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={pathLen}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>

          {/* Coral play/pause button centered in the ring */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center rounded-[30%]"
            style={{
              boxShadow: isPlaying ? "none" : `0 0 20px 4px rgba(232,115,90,0.25)`,
              animation: isPlaying ? "none" : "playerPulse 2s ease-in-out infinite",
            }}
          >
            {isPlaying ? (
              /* Pause: two coral bars */
              <svg width="28" height="36" viewBox="0 0 28 36">
                <rect x="2"  y="2" width="9" height="32" rx="2" fill={CORAL} />
                <rect x="17" y="2" width="9" height="32" rx="2" fill={CORAL} />
              </svg>
            ) : (
              /* Play: coral triangle */
              <svg width="32" height="36" viewBox="0 0 32 36">
                <polygon points="2,2 30,18 2,34" fill={CORAL} />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. Track info ────────────────────────────────────────────────── */}
      <div className="text-center space-y-0.5">
        <p className="font-medium" style={{ fontSize: 20, color: "#fff" }}>
          {isOriginal ? "Original" : selected?.name}
        </p>
        <p className="uppercase tracking-widest" style={{ fontSize: 10, color: GOLD, letterSpacing: "2px" }}>
          {isOriginal ? "unmastered" : "mastered"}
        </p>
        <p className="font-mono" style={{ fontSize: 12, color: "#555" }}>
          {fmtTime(currentTime)} / 0:30
        </p>
      </div>

      {/* ── 3. Reference note ────────────────────────────────────────────── */}
      {referenceFileName && (
        <div className="flex items-center justify-center gap-2">
          <div className="rounded-full" style={{ width: 5, height: 5, backgroundColor: "rgba(212,175,55,0.5)", flexShrink: 0 }} />
          <p style={{ fontSize: 10, color: "#555" }}>Reference: {referenceFileName}</p>
        </div>
      )}

      {/* ── 4. A/B toggle ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => toggleAB(true)} style={{ fontSize: 13, fontWeight: isOriginal ? 500 : 400, color: isOriginal ? GOLD : "#555" }}>
          Original
        </button>
        {/* Toggle switch */}
        <div
          onClick={() => toggleAB(!isOriginal)}
          className="relative cursor-pointer rounded-full"
          style={{ width: 44, height: 24, backgroundColor: "rgba(212,168,67,0.15)", border: `1px solid rgba(212,168,67,0.3)` }}
        >
          <div
            className="absolute top-[3px] rounded-full"
            style={{
              width: 18, height: 18,
              backgroundColor: GOLD,
              left: isOriginal ? 3 : 23,
              transition: "left 0.2s ease",
            }}
          />
        </div>
        <button onClick={() => toggleAB(false)} style={{ fontSize: 13, fontWeight: !isOriginal ? 500 : 400, color: !isOriginal ? GOLD : "#555" }}>
          Mastered
        </button>
      </div>

      {/* ── 5. Dual waveform canvas ──────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,10,0.5)", border: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        {/* Legend */}
        <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
          <div className="flex items-center gap-1.5">
            <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "#888" }} />
            <span style={{ fontSize: 9, color: "#555" }}>Original</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: GOLD }} />
            <span style={{ fontSize: 9, color: "#777" }}>{selected?.name ?? "Warm"}</span>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          width={380}
          height={90}
          className="w-full cursor-crosshair"
          style={{ display: "block" }}
          onClick={handleWaveformScrub}
        />
      </div>

      {/* ── 6. Version boxes ─────────────────────────────────────────────── */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          opacity: isOriginal ? 0.3 : 1,
          pointerEvents: isOriginal ? "none" : "auto",
          transition: "opacity 0.2s",
        }}
      >
        {versions.map((v, i) => {
          const active = i === selectedIdx && !isOriginal;
          return (
            <button
              key={v.name}
              type="button"
              onClick={() => selectVersion(i)}
              className="relative text-left rounded-xl overflow-hidden"
              style={{
                padding: "14px 10px",
                borderRadius: 12,
                border: active
                  ? `0.5px solid rgba(212,168,67,0.5)`
                  : `0.5px solid rgba(255,255,255,0.06)`,
                backgroundColor: active
                  ? "rgba(212,168,67,0.08)"
                  : "rgba(255,255,255,0.02)",
                transition: "border-color 0.2s, background-color 0.2s",
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 500, color: active ? GOLD : "#aaa" }}>
                {v.name}
              </p>
              <p style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
                {VERSION_DESCS[v.name] ?? ""}
              </p>
              {/* Gold accent bottom line when active */}
              {active && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: "60%", height: 2, backgroundColor: GOLD }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 7. Console stats ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,10,0.4)", border: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <div className="grid grid-cols-4">
          {statMeters.map((m, i) => (
            <div
              key={m.label}
              className="px-3 py-3"
              style={{
                borderRight: i < 3 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <p className="font-mono" style={{ fontSize: 18, fontWeight: 500, color: "#fff" }}>
                {m.value}
              </p>
              {/* Meter bar */}
              <div className="rounded-full my-1.5 overflow-hidden" style={{ height: 3, backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${m.bar}%`,
                    backgroundColor: m.gold && !isOriginal ? GOLD : "#444",
                    transition: "width 0.4s ease, background-color 0.3s ease",
                  }}
                />
              </div>
              <p className="uppercase" style={{ fontSize: 9, letterSpacing: "1px", color: "#444" }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pulse keyframe */}
      <style>{`
        @keyframes playerPulse {
          0%, 100% { box-shadow: 0 0 16px 4px rgba(232,115,90,0.2); }
          50%       { box-shadow: 0 0 28px 8px rgba(232,115,90,0.4); }
        }
        @media (max-width: 639px) {
          .master-version-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
