import React from "react";
import { Composition } from "remotion";
import { LyricVideoWithOutro } from "./LyricVideoWithOutro";
import type { LyricVideoProps } from "./LyricVideoContent";

// ─── Video dimensions keyed by aspect ratio ───────────────────────────────────

const DIM_MAP: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720  },
  "9:16": { width: 720,  height: 1280 },
  "1:1":  { width: 960,  height: 960  },
};

/** Outro card duration in frames (2 s @ 30 fps). */
const OUTRO_FRAMES = 60;

const DEFAULT_PROPS: LyricVideoProps = {
  trackUrl:         "",
  animationScript:  [],
  visualStyle:      "cinematic",
  fontStyle:        "bold",
  accentColor:      "#D4A843",
  aspectRatio:      "16:9",
  durationInFrames: 300,
};

export function Root() {
  return (
    <Composition
      id="LyricVideo"
      component={LyricVideoWithOutro}
      // Defaults are overridden at render-time via calculateMetadata + inputProps
      fps={30}
      width={1280}
      height={720}
      durationInFrames={DEFAULT_PROPS.durationInFrames + OUTRO_FRAMES}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => {
        const ratio = (props as LyricVideoProps).aspectRatio ?? "16:9";
        const dim   = DIM_MAP[ratio] ?? DIM_MAP["16:9"];
        const contentFrames = (props as LyricVideoProps).durationInFrames ?? 300;

        return {
          ...dim,
          // Content + 2-second IndieThis outro card
          durationInFrames: contentFrames + OUTRO_FRAMES,
        };
      }}
    />
  );
}
