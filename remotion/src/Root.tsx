import React from "react";
import { Composition } from "remotion";
import { LyricVideoWithOutro } from "./LyricVideoWithOutro";
import type { LyricVideoProps } from "./LyricVideoContent";
import { TrackCanvas } from "./TrackCanvas";
import type { TrackCanvasProps } from "./TrackCanvas";

// ─── Video dimensions keyed by aspect ratio ───────────────────────────────────

const DIM_MAP: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1":  { width: 1080, height: 1080 },
};

/** Outro card duration in frames (2 s @ 30 fps). */
const OUTRO_FRAMES = 60;

const DEFAULT_PROPS: LyricVideoProps = {
  lyrics:         [],
  audioUrl:       "",
  trackTitle:     "Untitled",
  artistName:     "Artist",
  backgroundUrl:  "",
  backgroundType: "image",
  accentColor:    "#D4A843",
  textStyle:      "captions",
  fontChoice:     "inter",
  textPosition:   "bottom",
  aspectRatio:    "16:9",
  durationMs:     180000,
};

const DEFAULT_CANVAS_PROPS: TrackCanvasProps = {
  coverArtUrl: "https://via.placeholder.com/1080x1920/0A0A0A/D4A843?text=Canvas",
  audioUrl: "",
  accentColor: "#D4A843",
};

export function Root() {
  return (
    <>
    {/* ── Track Canvas ── */}
    <Composition
      id="TrackCanvas"
      component={TrackCanvas as unknown as React.ComponentType<Record<string, unknown>>}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={180}
      defaultProps={DEFAULT_CANVAS_PROPS}
    />

    {/* ── Lyric Video ── */}
    <Composition
      id="LyricVideo"
      component={LyricVideoWithOutro}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={Math.ceil((DEFAULT_PROPS.durationMs / 1000) * 30) + OUTRO_FRAMES}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => {
        const p      = props as LyricVideoProps;
        const ratio  = p.aspectRatio ?? "16:9";
        const dim    = DIM_MAP[ratio] ?? DIM_MAP["16:9"];
        const durationMs      = p.durationMs ?? 180000;
        const contentFrames   = Math.ceil((durationMs / 1000) * 30);

        return {
          ...dim,
          durationInFrames: contentFrames + OUTRO_FRAMES,
        };
      }}
    />
    </>
  );
}
