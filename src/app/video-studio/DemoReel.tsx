"use client";

/**
 * DemoReel — interactive video player for the /video-studio landing page.
 *
 * - Click to play/pause with sound (browsers block autoplay with audio)
 * - Seek bar with drag support
 * - Mute/unmute toggle
 * - Falls back to a placeholder when /videos/video-studio-demo.mp4 isn't present
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Film } from "lucide-react";

export default function DemoReel() {
  const videoRef                    = useRef<HTMLVideoElement>(null);
  const [ready,    setReady]        = useState(false);
  const [playing,  setPlaying]      = useState(false);
  const [muted,    setMuted]        = useState(false);
  const [progress, setProgress]     = useState(0);   // 0–1
  const [duration, setDuration]     = useState(0);
  const [dragging, setDragging]     = useState(false);
  const barRef                      = useRef<HTMLDivElement>(null);

  // ── Sync progress from video timeupdate ──────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime  = () => { if (!dragging) setProgress(v.currentTime / (v.duration || 1)); };
    const onMeta  = () => setDuration(v.duration);
    const onEnded = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
    };
  }, [dragging]);

  // ── Play / pause ─────────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  }

  // ── Seek ─────────────────────────────────────────────────────────────────────
  const seek = useCallback((clientX: number) => {
    const bar = barRef.current;
    const v   = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setProgress(pct);
    v.currentTime = pct * duration;
  }, [duration]);

  const onBarMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    seek(e.clientX);
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => seek(e.clientX);
    const onUp   = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, seek]);

  // ── Format mm:ss ─────────────────────────────────────────────────────────────
  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const elapsed = progress * duration;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: "#0A0A0A", border: "1px solid #1E1E1E" }}
    >
      {/* ── Video element ─────────────────────────────────────────────────── */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src="/videos/video-studio-demo.mp4"
          playsInline
          muted={muted}
          preload="metadata"
          onCanPlay={() => setReady(true)}
          onClick={togglePlay}
          style={{
            position:  "absolute",
            inset:     0,
            width:     "100%",
            height:    "100%",
            objectFit: "cover",
            display:   "block",
            cursor:    "pointer",
            opacity:   ready ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        />

        {/* Placeholder */}
        {!ready && (
          <>
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #0D0D0D 0%, #111 40%, #0A0A0A 100%)" }} />
            <FilmStrip position="top" />
            <FilmStrip position="bottom" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)" }}>
                <Film size={22} style={{ color: "#D4A843" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>Demo reel loading…</p>
            </div>
          </>
        )}

        {/* Big play button overlay (shown when paused + ready) */}
        {ready && !playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.9)", boxShadow: "0 0 40px rgba(212,168,67,0.4)" }}>
              <Play size={24} fill="#0A0A0A" style={{ color: "#0A0A0A", marginLeft: 3 }} />
            </div>
          </button>
        )}
      </div>

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      {ready && (
        <div className="flex flex-col gap-2 px-4 py-3"
          style={{ backgroundColor: "rgba(10,10,10,0.95)", borderTop: "1px solid #1A1A1A" }}>

          {/* Seek bar */}
          <div
            ref={barRef}
            onMouseDown={onBarMouseDown}
            className="relative w-full h-1.5 rounded-full cursor-pointer group"
            style={{ backgroundColor: "#222" }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, backgroundColor: "#D4A843" }}
            />
            {/* Scrubber thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress * 100}% - 6px)`, backgroundColor: "#D4A843" }}
            />
          </div>

          {/* Play/pause + time + mute */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A" }}
            >
              {playing
                ? <Pause size={12} style={{ color: "#D4A843" }} />
                : <Play  size={12} fill="#D4A843" style={{ color: "#D4A843", marginLeft: 1 }} />
              }
            </button>

            <span className="text-[11px] tabular-nums" style={{ color: "#666" }}>
              {fmt(elapsed)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              className="flex items-center gap-1 text-[11px] transition hover:opacity-80"
              style={{ color: "#555" }}
            >
              {muted
                ? <><VolumeX size={13} /> Unmute</>
                : <><Volume2 size={13} /> Mute</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Film strip decoration ────────────────────────────────────────────────────

function FilmStrip({ position }: { position: "top" | "bottom" }) {
  return (
    <div className="absolute left-0 right-0 flex gap-1.5 px-2 opacity-[0.08]"
      style={{ [position]: "0", padding: "6px 8px" }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: "#888" }} />
      ))}
    </div>
  );
}
