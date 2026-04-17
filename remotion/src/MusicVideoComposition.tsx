/**
 * remotion/src/MusicVideoComposition.tsx
 *
 * Music Video Studio — Final composition.
 *
 * Assembles generated scene clips into a full music video with:
 *   - Eased crossfade transitions between scenes (ease-in-out opacity)
 *   - Subtle Ken Burns scale drift per clip for cinematic motion
 *   - Full-track audio overlay
 *   - Aspect-ratio-aware layout (16:9, 9:16, 1:1)
 *
 * Props are passed via renderMediaOnLambda inputProps.
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneClip {
  videoUrl:   string;   // fal.ai output URL
  startTime:  number;   // start position in the track (seconds)
  endTime:    number;   // end position in the track (seconds)
  duration:   number;   // clip length in seconds
}

export interface MusicVideoProps {
  scenes:      SceneClip[];
  audioUrl:    string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationMs:  number;  // total video duration in ms
  crossfadeMs: number;  // crossfade overlap in ms (default 800)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;

// Subtle Ken Burns scale: each clip drifts from 1.0 → 1.04 over its lifetime
// giving the impression of gentle camera movement even on still-starting clips.
const SCALE_START = 1.0;
const SCALE_END   = 1.04;

// ─── Scene clip with eased crossfade + Ken Burns ──────────────────────────────

interface SceneOverlayProps {
  clip:            SceneClip;
  startFrame:      number;
  endFrame:        number;
  crossfadeFrames: number;
}

function SceneOverlay({ clip, startFrame, endFrame, crossfadeFrames }: SceneOverlayProps) {
  const frame = useCurrentFrame();

  // Only render when this clip is active (with margin)
  if (frame < startFrame - 1 || frame > endFrame + 1) return null;

  const localFrame   = frame - startFrame;
  const clipDuration = endFrame - startFrame;

  // ── Opacity: ease-in at start, ease-out at end ──────────────────────────────
  const fadeIn = interpolate(
    localFrame,
    [0, crossfadeFrames],
    [0, 1],
    {
      extrapolateLeft:  "clamp",
      extrapolateRight: "clamp",
      easing:           Easing.out(Easing.ease),
    },
  );

  const fadeOut = interpolate(
    localFrame,
    [clipDuration - crossfadeFrames, clipDuration],
    [1, 0],
    {
      extrapolateLeft:  "clamp",
      extrapolateRight: "clamp",
      easing:           Easing.in(Easing.ease),
    },
  );

  const opacity = Math.min(fadeIn, fadeOut);

  // ── Ken Burns: slow scale drift across the full clip ────────────────────────
  const scale = interpolate(
    localFrame,
    [0, clipDuration],
    [SCALE_START, SCALE_END],
    {
      extrapolateLeft:  "clamp",
      extrapolateRight: "clamp",
      easing:           Easing.inOut(Easing.ease),
    },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <Sequence from={startFrame} durationInFrames={endFrame - startFrame + 1}>
        {/* Wrapper handles Ken Burns scale without affecting opacity layering */}
        <AbsoluteFill
          style={{
            transform:      `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <OffthreadVideo
            src={clip.videoUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────

export function MusicVideoComposition({
  scenes,
  audioUrl,
  crossfadeMs = 800,
}: MusicVideoProps) {
  const { durationInFrames } = useVideoConfig();
  const crossfadeFrames = Math.round((crossfadeMs / 1000) * FPS);

  const timeline = scenes
    .filter(s => s.videoUrl)
    .map((scene) => {
      const startFrame = Math.round(scene.startTime * FPS);
      const endFrame   = Math.min(
        Math.round(scene.endTime * FPS),
        durationInFrames - 1,
      );
      return { clip: scene, startFrame, endFrame };
    })
    .filter(({ startFrame, endFrame }) => startFrame < endFrame);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioUrl && <Audio src={audioUrl} startFrom={0} />}

      {timeline.map(({ clip, startFrame, endFrame }, i) => (
        <SceneOverlay
          key={i}
          clip={clip}
          startFrame={startFrame}
          endFrame={endFrame}
          crossfadeFrames={crossfadeFrames}
        />
      ))}
    </AbsoluteFill>
  );
}
