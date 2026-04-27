"use client";

/**
 * MixResultsClient — top-level layout for the Mix Results page.
 *
 * This is the SHELL only. Each numbered section below is a slot for the
 * components built in later spec steps:
 *
 *   §2 Logo player          → LogoPlayer.tsx       (Step 3)
 *   §3 Frequency visualizer → FrequencyVisualizer  (Step 4)
 *   §4 A/B toggle           → inline               (Step 5)
 *   §5 Version selector     → VersionSelector.tsx  (Step 6)
 *   §6 Stem breakdown       → StemBreakdown.tsx    (Step 7)
 *   §7 Reference note       → inline               (Step 13)
 *   §8 Console stats        → inline               (Step 8)
 *   §9 Export grid          → ExportGrid.tsx       (Step 9)
 *   §10 Revision section    → RevisionMarkers.tsx  (Step 10)
 *   §11 Mastering cross-sell→ inline               (Step 14)
 *
 * Used by:
 *   - /mix-console/results?token=xxx          (guest)
 *   - /dashboard/ai/mix-console/[id]          (subscriber)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { MixResultsData } from "./types";
import { LogoPlayer } from "./LogoPlayer";
import { FrequencyVisualizer } from "./FrequencyVisualizer";
import { VersionSelector, type StandardVersionKey } from "./VersionSelector";
import { StemBreakdown } from "./StemBreakdown";
import { ConsoleStats } from "./ConsoleStats";
import { ExportGrid }   from "./ExportGrid";
import {
  RevisionMarkers,
  type RevisionMarkersHandle,
} from "./RevisionMarkers";
import { ReferenceNote }      from "./ReferenceNote";
import { MasteringCrossSell } from "./MasteringCrossSell";
import {
  useAudioController,
  lufsToVol,
  useViewportIsSmall,
} from "@/lib/mix-console/audio-utils";

// ─── Genre label map (display strings) ─────────────────────────────────────────

const GENRE_LABELS: Record<string, string> = {
  HIP_HOP:    "Hip-Hop",
  TRAP:       "Trap",
  RNB:        "R&B",
  POP:        "Pop",
  ROCK:       "Rock",
  ELECTRONIC: "Electronic",
  ACOUSTIC:   "Acoustic",
  LO_FI:      "Lo-Fi",
  AFROBEATS:  "Afrobeats",
  LATIN:      "Latin",
  COUNTRY:    "Country",
  GOSPEL:     "Gospel",
  AUTO:       "Auto",
};

const TIER_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  PREMIUM:  "Premium",
  PRO:      "Pro",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MixResultsClient({
  data,
  accessToken,
}: {
  data:         MixResultsData;
  accessToken?: string;
}) {
  const isStandard = data.tier === "STANDARD";

  // Currently selected version (drives audio source + stat bar values).
  // Standard: clean | polished | aggressive. Premium/Pro: mix.
  const [selectedVersion, setSelectedVersion] = useState<string>(
    isStandard ? (data.recommendedVersion ?? "polished") : "mix",
  );

  // A/B toggle state (mixed = processed, original = raw stems summed).
  const [abMode, setAbMode] = useState<"mixed" | "original">("mixed");

  // Preview vs full-length playback.
  // Premium/Pro users with revisions remaining default to "full" so tap-to-mark
  // covers the whole song — a 30s preview is too fast to land precise markers on.
  const [playbackMode, setPlaybackMode] = useState<"preview" | "full">(() => {
    const premium = data.tier === "PREMIUM" || data.tier === "PRO";
    const revisionsLeft = data.maxRevisions - data.revisionCount > 0;
    return premium && revisionsLeft ? "full" : "preview";
  });

  // Hidden audio element — single source of truth for all playback.
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const controller  = useAudioController(audioRef);

  // Track which (version, abMode, playbackMode) the audio src currently reflects
  // so we can restore playback position on switches.
  const [srcLoading, setSrcLoading] = useState(false);
  const lastKey = useRef<string>("");

  /**
   * Fetch a fresh signed URL for the active selection and point the
   * <audio> element at it. Preserves currentTime across switches so the
   * A/B toggle and version selector feel seamless.
   *
   * Audio elements can't pass auth headers, so we route through
   * /api/mix-console/job/[id]/preview-url which validates session/token
   * and returns a 1-hour Supabase signed URL.
   */
  const loadAudioSrc = useCallback(
    async (version: string, ab: "mixed" | "original", mode: "preview" | "full") => {
      const versionForApi = ab === "original" ? "original" : version;
      const kindForApi    = ab === "original" ? "preview" : mode;
      const key = `${versionForApi}|${kindForApi}`;
      if (key === lastKey.current) return;
      lastKey.current = key;

      setSrcLoading(true);
      try {
        const tokenQs = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : "";
        const res = await fetch(
          `/api/mix-console/job/${data.id}/preview-url?version=${versionForApi}&kind=${kindForApi}${tokenQs}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          setSrcLoading(false);
          return;
        }
        const { url } = (await res.json()) as { url?: string };
        if (!url) { setSrcLoading(false); return; }
        controller.setSrc(url, { keepTime: true });
      } catch {
        // swallow — Step 11 surfaces error states
      } finally {
        setSrcLoading(false);
      }
    },
    [data.id, accessToken, controller],
  );

  // Initial load + reload whenever (version, abMode, playbackMode) changes
  useEffect(() => {
    void loadAudioSrc(selectedVersion, abMode, playbackMode);
  }, [selectedVersion, abMode, playbackMode, loadAudioSrc]);

  /**
   * A/B volume matching.
   *
   * Spec: "Both original and mixed previews are LUFS-normalized to the same
   * target before serving" — done server-side during preview generation.
   * This client-side step is the safety net: if measured LUFS values are
   * available, gain-compensate the original so the artist isn't biased by
   * the mixed version simply being louder.
   *
   * gain (dB) = mixLufs − inputLufs   (boosts the quieter original up)
   * Clamped to [0.01, 1] inside lufsToVol so we never digitally peak.
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const mixLufs    = data.outputAnalysis?.lufs ?? null;
    const inputLufs  = data.inputLufs ?? null;
    if (abMode === "original" && mixLufs !== null && inputLufs !== null) {
      audio.volume = lufsToVol(mixLufs - inputLufs);
    } else {
      audio.volume = 1;
    }
  }, [abMode, data.outputAnalysis, data.inputLufs]);

  // Genre + tier display
  const genreLabel = data.genre ? (GENRE_LABELS[data.genre] ?? data.genre) : null;
  const tierLabel  = TIER_LABELS[data.tier] ?? data.tier;
  const isPremiumOrPro = data.tier === "PREMIUM" || data.tier === "PRO";
  const revisionsRemaining = data.maxRevisions - data.revisionCount;
  const canRevise = isPremiumOrPro && revisionsRemaining > 0;

  // Imperative handle to the RevisionMarkers card. The visualizer's onTap
  // fires this so taps anywhere on the canvas drop a timestamp pill.
  const revisionRef = useRef<RevisionMarkersHandle | null>(null);
  const handleVisualizerTap = useCallback((timeSec: number) => {
    revisionRef.current?.addMarker(timeSec);
  }, []);

  // Preview clips are fixed 30s. Full track uses the audio element's reported duration.
  const maxTime = playbackMode === "preview" ? 30 : undefined;

  // Mobile sizing — shrink LogoPlayer + visualizer on sub-480px screens
  const isSmall = useViewportIsSmall(480);
  const playerSize       = isSmall ? 156 : 180;
  const visualizerHeight = isSmall ? 140 : 200;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-4 sm:space-y-5">

      {/* ── §1 HEADER ─────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1
            className="truncate"
            style={{ fontSize: 18, fontWeight: 500, color: "#fff", lineHeight: 1.2 }}
          >
            {data.trackName ?? "Your mix"}
          </h1>
          {data.beatPolish && (
            <p className="mt-1.5 text-[12px]" style={{ color: "#888" }}>
              Beat polished — drums, bass, and melodics processed individually
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {genreLabel && (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                color:           "#D4AF37",
                border:          "1px solid rgba(212,175,55,0.4)",
                backgroundColor: "transparent",
              }}
            >
              {genreLabel}
            </span>
          )}
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={
              isPremiumOrPro
                ? { backgroundColor: "#E8735A", color: "#fff" }
                : { color: "#999", border: "1px solid #333", backgroundColor: "transparent" }
            }
          >
            {tierLabel}
          </span>
        </div>
      </header>

      {/* ── §2 LOGO PLAYER ────────────────────────────────────────────────── */}
      <section
        aria-label="Mix preview player"
        className="flex justify-center py-2"
      >
        <LogoPlayer
          controller={controller}
          maxTime={maxTime}
          size={playerSize}
        />
        {srcLoading && (
          <span className="sr-only" role="status">Loading audio…</span>
        )}
      </section>

      {/* ── §3 FREQUENCY VISUALIZER + §4 A/B TOGGLE (Steps 4–5) ───────────── */}
      <section
        className="rounded-xl p-4 sm:p-6"
        style={{ backgroundColor: "#0D0B09", border: "1px solid #1F1D1A" }}
      >
        <FrequencyVisualizer
          audioRef={audioRef}
          isPlaying={controller.isPlaying}
          height={visualizerHeight}
          onSeek={controller.seek}
          onTap={canRevise ? handleVisualizerTap : undefined}
        />

        {/* Legend */}
        <div className="flex items-center justify-center flex-wrap gap-x-4 sm:gap-x-6 gap-y-1 mt-3 text-[11px]" style={{ color: "#888" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: "#D4AF37" }} />
            Mix
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: "#E8735A" }} />
            Vocals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: "#7F77DD" }} />
            Beat
          </span>
        </div>

        {/* A/B toggle */}
        <div
          role="radiogroup"
          aria-label="Original versus mixed comparison"
          className="mt-5 flex items-center p-1 rounded-full mx-auto"
          style={{ backgroundColor: "#0A0908", border: "1px solid #1F1D1A", maxWidth: 280 }}
        >
          {(["original", "mixed"] as const).map(mode => {
            const active = abMode === mode;
            return (
              <button
                key={mode}
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setAbMode(mode)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                      e.key === "ArrowUp"   || e.key === "ArrowDown") {
                    e.preventDefault();
                    setAbMode(mode === "original" ? "mixed" : "original");
                  }
                }}
                className="flex-1 py-2 rounded-full text-[12px] font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                style={{
                  backgroundColor: active ? "#D4AF37" : "transparent",
                  color:           active ? "#0A0A0A" : "#888",
                }}
              >
                {active && <span aria-hidden style={{ marginRight: 6 }}>■</span>}
                {mode === "original" ? "Original" : "Mixed"}
              </button>
            );
          })}
        </div>

        {/* Volume-matched note — earned visibility, only when we have data */}
        {data.outputAnalysis?.lufs !== undefined && data.inputLufs !== null && (
          <p
            className="mt-2 text-center"
            style={{ fontSize: 10, color: "#555", letterSpacing: "0.3px" }}
          >
            Volume-matched · same loudness for fair comparison
          </p>
        )}

        {/* Preview / Full-track sub-toggle */}
        <div
          role="radiogroup"
          aria-label="Preview length"
          className="mt-2 flex items-center justify-center gap-4 text-[11px]"
          style={{ color: "#666" }}
        >
          <button
            role="radio"
            aria-checked={playbackMode === "preview"}
            tabIndex={playbackMode === "preview" ? 0 : -1}
            onClick={() => setPlaybackMode("preview")}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                setPlaybackMode("full");
              }
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
            style={{ color: playbackMode === "preview" ? "#D4AF37" : "#666" }}
          >
            Preview (30s)
          </button>
          <span aria-hidden style={{ color: "#333" }}>·</span>
          <button
            role="radio"
            aria-checked={playbackMode === "full"}
            tabIndex={playbackMode === "full" ? 0 : -1}
            onClick={() => setPlaybackMode("full")}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                setPlaybackMode("preview");
              }
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
            style={{ color: playbackMode === "full" ? "#D4AF37" : "#666" }}
          >
            Full track
          </button>
        </div>
      </section>

      {/* ── §5 VERSION SELECTOR ─────────────────────────────────────────── */}
      {isStandard ? (
        <VersionSelector
          selected={selectedVersion as StandardVersionKey}
          onChange={(v) => setSelectedVersion(v)}
          recommended={data.recommendedVersion}
        />
      ) : (
        <p className="text-[12px] text-center" style={{ color: "#888" }}>
          AI-selected mix — Claude chose{" "}
          <span style={{ color: "#D4AF37" }}>
            {data.recommendedVersion
              ? data.recommendedVersion.charAt(0).toUpperCase() + data.recommendedVersion.slice(1)
              : "the optimal mix"}
          </span>{" "}
          based on your genre and input analysis.
        </p>
      )}

      {/* ── §6 STEM BREAKDOWN — "What we did" ────────────────────────────── */}
      <StemBreakdown items={data.stemProcessingSummary} />

      {/* ── §7 REFERENCE NOTE (Step 13) ──────────────────────────────────── */}
      <ReferenceNote
        fileName={data.referenceFileName}
        notes={data.referenceNotes}
      />

      {/* ── §8 CONSOLE STATS BAR (Step 8) ────────────────────────────────── */}
      <ConsoleStats analysis={data.outputAnalysis} />

      {/* ── §9 EXPORT GRID (Step 9) ──────────────────────────────────────── */}
      <ExportGrid
        jobId={data.id}
        version={isStandard ? selectedVersion : "mix"}
        accessToken={accessToken}
      />

      {/* ── Pro Studio Mixer entrypoint (Pro tier only) ──────────────────── */}
      {data.tier === "PRO" && !accessToken && (
        <div className="px-4">
          <a
            href={`/dashboard/ai/mix-console/${data.id}/studio`}
            className="block w-full max-w-2xl mx-auto px-5 py-4 rounded-2xl text-center transition-all hover:opacity-90"
            style={{
              backgroundColor: "transparent",
              border:          "1px solid #D4A843",
              color:           "#D4A843",
            }}
          >
            <span className="text-sm font-bold tracking-wide">🎛  Open Pro Studio Mixer</span>
            <span className="block text-[11px] mt-1" style={{ color: "#888" }}>
              Fine-tune the mix with hands-on faders, knobs, and AI assist
            </span>
          </a>
        </div>
      )}

      {/* ── §10 REVISION SECTION (Premium/Pro — Step 10) ─────────────────── */}
      {canRevise && (
        <RevisionMarkers
          ref={revisionRef}
          jobId={data.id}
          revisionsRemaining={revisionsRemaining}
          accessToken={accessToken}
        />
      )}

      {/* ── §11 MASTERING CROSS-SELL (Step 14) ───────────────────────────── */}
      <MasteringCrossSell outputLufs={data.outputAnalysis?.lufs ?? null} />

      {/* Polite live region — announces playback selection changes to
          screen readers without stealing focus. Visible only to AT. */}
      <p className="sr-only" aria-live="polite">
        Now playing {abMode === "mixed" ? "the mixed" : "the original"} track
        {isStandard ? `, ${selectedVersion} version` : ""}
        {srcLoading ? ", loading…" : ""}.
      </p>

      {/* Hidden audio element — single source for everything */}
      <audio
        ref={audioRef}
        aria-label="Mix preview player"
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />
    </div>
  );
}
