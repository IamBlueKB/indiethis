import React from "react";
import { Series } from "remotion";
import { LyricVideoContent, type LyricVideoProps } from "./LyricVideoContent";
import { OutroCard } from "./OutroCard";

/** 2-second (60 frames at 30 fps) outro appended after the lyric content. */
const OUTRO_FRAMES = 60;

/**
 * Top-level composition component.
 *
 * Total duration = ceil(durationMs / 1000 * 30) frames (lyric content) + OUTRO_FRAMES.
 * Root.tsx's calculateMetadata adds OUTRO_FRAMES so Remotion Lambda renders
 * the full sequence including the outro card.
 */
export function LyricVideoWithOutro(props: LyricVideoProps) {
  const contentFrames = Math.ceil((props.durationMs / 1000) * 30);

  return (
    <Series>
      {/* ── Lyric video content ── */}
      <Series.Sequence durationInFrames={contentFrames}>
        <LyricVideoContent {...props} />
      </Series.Sequence>

      {/* ── IndieThis branded 2-second outro card ── */}
      <Series.Sequence durationInFrames={OUTRO_FRAMES}>
        <OutroCard />
      </Series.Sequence>
    </Series>
  );
}
