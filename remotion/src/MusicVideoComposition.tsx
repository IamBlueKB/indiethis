/**
 * remotion/src/MusicVideoComposition.tsx
 *
 * Music Video Studio — Final composition.
 *
 * Assembles generated scene clips into a full music video with:
 *   - Beat-aligned crossfade transitions between scenes
 *   - Full-track audio overlay
 *   - Aspect-ratio-aware layout (16:9, 9:16, 1:1)
 *
 * Props are passed via renderMediaOnLambda inputProps.
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Video,
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
  crossfadeMs: number;  // crossfade overlap in ms (default 500)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;

// ─── Crossfade overlay ────────────────────────────────────────────────────────

interface SceneOverlayProps {
  clip:             SceneClip;
  startFrame:       number;  // frame this clip begins at
  endFrame:         number;  // frame this clip ends at
  crossfadeFrames:  number;
}

function SceneOverlay({ clip, startFrame, endFrame, crossfadeFrames }: SceneOverlayProps) {
  const frame = useCurrentFrame();

  // Only render when this clip is active (with a small margin)
  if (frame < startFrame - 1 || frame > endFrame + 1) return null;

  const localFrame    = frame - startFrame;
  const clipDuration  = endFrame - startFrame;

  // Fade in at start, fade out at end
  const fadeIn  = interpolate(localFrame, [0, crossfadeFrames],              [0, 1], { extrapolateLeft: "clamp",  extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [clipDuration - crossfadeFrames, clipDuration], [1, 0], { extrapolateLeft: "clamp",  extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Video
        src={clip.videoUrl}
        startFrom={0}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
      />
    </AbsoluteFill>
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────

export function MusicVideoComposition({
  scenes,
  audioUrl,
  crossfadeMs = 500,
}: MusicVideoProps) {
  const { durationInFrames } = useVideoConfig();
  const crossfadeFrames = Math.round((crossfadeMs / 1000) * FPS);

  // Build a timeline of scene clips mapped to frame positions
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
      {/* Audio track */}
      {audioUrl && (
        <Audio src={audioUrl} startFrom={0} />
      )}

      {/* Scene clips layered with crossfades */}
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
