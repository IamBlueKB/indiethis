"use client";

import { useAudioStore } from "@/store";
import AudioPlayer from "./AudioPlayer";
import { Play, Pause, X, Volume2, VolumeX } from "lucide-react";

/**
 * MiniPlayer — Persistent bottom-bar audio player.
 * Fixed to the bottom of the screen, visible whenever a track is loaded.
 * Survives client-side navigation because it lives in the layout.
 *
 * Layout:  [Cover + Info] [▶/⏸] [~~ Waveform + Time ~~] [Vol 🔊 ▬] [✕]
 */
export default function MiniPlayer() {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const isPlaying    = useAudioStore((s) => s.isPlaying);
  const volume       = useAudioStore((s) => s.volume);
  const isMuted      = useAudioStore((s) => s.isMuted);
  const pause        = useAudioStore((s) => s.pause);
  const resume       = useAudioStore((s) => s.resume);
  const stop         = useAudioStore((s) => s.stop);
  const setVolume    = useAudioStore((s) => s.setVolume);
  const toggleMute   = useAudioStore((s) => s.toggleMute);

  if (!currentTrack) return null;

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-4 border-t"
      style={{
        height: 72,
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* ── Cover art + track info ────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0" style={{ width: 196 }}>
        {currentTrack.coverArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.coverArt}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base select-none"
            style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
          >
            ♪
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-snug">
            {currentTrack.title}
          </p>
          {currentTrack.artist && (
            <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
              {currentTrack.artist}
            </p>
          )}
        </div>
      </div>

      {/* ── Play / Pause ──────────────────────────────────────────────── */}
      <button
        onClick={() => (isPlaying ? pause() : resume())}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>

      {/* ── Waveform + time (fills remaining space) ───────────────────── */}
      <AudioPlayer />

      {/* ── Volume control ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleMute}
          className="transition-colors hover:text-foreground"
          style={{ color: "var(--muted-foreground)" }}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>

        {/* Custom-styled range input */}
        <div className="relative flex items-center" style={{ width: 80 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={effectiveVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (isMuted && v > 0) toggleMute();
            }}
            className="w-full h-1 rounded-full cursor-pointer appearance-none"
            style={{
              background: `linear-gradient(to right, #D4A843 ${effectiveVolume * 100}%, var(--border) ${effectiveVolume * 100}%)`,
              accentColor: "#D4A843",
            }}
          />
        </div>
      </div>

      {/* ── Close / Stop ─────────────────────────────────────────────── */}
      <button
        onClick={stop}
        className="shrink-0 transition-colors hover:text-foreground"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="Close player"
      >
        <X size={14} />
      </button>
    </div>
  );
}
