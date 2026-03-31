"use client";

import { useAudioStore } from "@/store";
import AudioPlayer from "./AudioPlayer";
import CanvasPlayer from "@/components/CanvasPlayer";
import { Play, Pause, X, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";

/**
 * MiniPlayer — Persistent bottom-bar audio player.
 * Fixed to the bottom of the screen, visible whenever a track is loaded.
 * Survives client-side navigation because it lives in the layout.
 *
 * Mobile  (<sm): [Cover] [Title/Artist] [▶/⏸] [✕]  — prev/next/volume/waveform hidden
 * Desktop (≥sm): [Cover + Info 196px] [⏮ ▶/⏸ ⏭] [~~ Waveform + Time ~~] [🔊 Vol] [✕]
 *
 * AudioPlayer (WaveSurfer engine) is always in the DOM but visually hidden on mobile
 * so the audio plays even when the waveform is not displayed.
 */
export default function MiniPlayer() {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const isPlaying    = useAudioStore((s) => s.isPlaying);
  const volume       = useAudioStore((s) => s.volume);
  const isMuted      = useAudioStore((s) => s.isMuted);
  const pause        = useAudioStore((s) => s.pause);
  const resume       = useAudioStore((s) => s.resume);
  const stop         = useAudioStore((s) => s.stop);
  const next         = useAudioStore((s) => s.next);
  const prev         = useAudioStore((s) => s.prev);
  const setVolume    = useAudioStore((s) => s.setVolume);
  const toggleMute   = useAudioStore((s) => s.toggleMute);

  if (!currentTrack) return null;

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 border-t"
      style={{
        height:          72,
        backgroundColor: "var(--card)",
        borderColor:     "var(--border)",
        backdropFilter:  "blur(12px)",
      }}
    >
      {/* ── Cover art + track info ────────────────────────────────────────── */}
      {/* Mobile: flex-1 so it takes remaining space. Desktop: fixed 196px */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-[196px] sm:shrink-0">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
          <CanvasPlayer
            canvasVideoUrl={currentTrack.canvasVideoUrl}
            coverArtUrl={currentTrack.coverArt}
            className="w-full h-full"
            isPlaying={isPlaying}
          />
        </div>
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

      {/* ── Prev — desktop only ───────────────────────────────────────────── */}
      <button
        onClick={prev}
        className="hidden sm:flex w-7 h-7 rounded-full items-center justify-center transition-colors hover:text-foreground shrink-0"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="Previous track"
      >
        <SkipBack size={14} />
      </button>

      {/* ── Play / Pause — always visible ────────────────────────────────── */}
      <button
        onClick={() => (isPlaying ? pause() : resume())}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>

      {/* ── Next — desktop only ──────────────────────────────────────────── */}
      <button
        onClick={next}
        className="hidden sm:flex w-7 h-7 rounded-full items-center justify-center transition-colors hover:text-foreground shrink-0"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="Next track"
      >
        <SkipForward size={14} />
      </button>

      {/* ── AudioPlayer: always in DOM (audio engine + waveform) ─────────── */}
      {/* On mobile: w-0 overflow-hidden so WaveSurfer stays mounted (audio   */}
      {/*   plays) but waveform takes no visual space. NOT display:none which */}
      {/*   would prevent WaveSurfer initialization.                          */}
      {/* On desktop: flex-1 to fill remaining space with waveform display.  */}
      <div className="w-0 overflow-hidden sm:flex-1 sm:min-w-0" aria-hidden={true}>
        <AudioPlayer />
      </div>

      {/* ── Volume control — desktop only ────────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <button
          onClick={toggleMute}
          className="transition-colors hover:text-foreground"
          style={{ color: "var(--muted-foreground)" }}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>

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
              background:  `linear-gradient(to right, #D4A843 ${effectiveVolume * 100}%, var(--border) ${effectiveVolume * 100}%)`,
              accentColor: "#D4A843",
            }}
          />
        </div>
      </div>

      {/* ── Close / Stop — always visible ────────────────────────────────── */}
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
