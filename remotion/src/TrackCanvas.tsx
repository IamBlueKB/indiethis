import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface TrackCanvasProps {
  coverArtUrl: string;
  audioUrl: string;
  accentColor?: string;
}

const TOTAL_FRAMES = 180; // 6 s @ 30 fps

export function TrackCanvas({ coverArtUrl, accentColor = "#D4A843" }: TrackCanvasProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Loop-safe progress (0 → 1, resets cleanly)
  const loopFrame = frame % TOTAL_FRAMES;
  const progress = loopFrame / TOTAL_FRAMES;

  // Ken Burns: barely perceptible zoom, 1.0 → 1.04 over 6s
  const scale = interpolate(progress, [0, 1], [1.0, 1.04]);

  // Very slow pan offset — shifts 8px right over 6s then resets
  const panX = interpolate(progress, [0, 1], [0, 8]);

  // Subtle breathing pulse — simulates audio energy at 128bpm
  const bpm = 128;
  const framesPerBeat = (fps * 60) / bpm;
  const beatPhase = (loopFrame % framesPerBeat) / framesPerBeat;
  // Soft cosine pulse, 0 → 1
  const pulse = Math.max(0, Math.cos(beatPhase * Math.PI * 2) * 0.5 + 0.5);

  // Vignette strength pulses very gently — barely visible
  const vignetteOpacity = interpolate(pulse, [0, 1], [0.55, 0.65]);

  // Accent shimmer: a very faint rim light on one edge, almost invisible
  const shimmerOpacity = interpolate(pulse, [0, 1], [0.0, 0.04]);

  // Floating orbs (3 large, soft, blurred — like bokeh)
  const orbs = [
    { x: 0.2, y: 0.35, size: 280, startAngle: 0 },
    { x: 0.75, y: 0.6, size: 220, startAngle: 2.1 },
    { x: 0.5, y: 0.85, size: 180, startAngle: 4.2 },
  ];

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* Cover art — full bleed with Ken Burns */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translateX(${panX}px)`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={coverArtUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Dark vignette — keeps cover art center readable */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,0,0.72) 100%)",
          opacity: vignetteOpacity,
        }}
      />

      {/* Bottom gradient for depth */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)",
        }}
      />

      {/* Bokeh orbs — very blurred, drift slowly */}
      {orbs.map((orb, i) => {
        const angle = orb.startAngle + (loopFrame / TOTAL_FRAMES) * Math.PI * 0.4;
        const driftX = orb.x * 1080 + Math.cos(angle) * 18;
        const driftY = orb.y * 1920 + Math.sin(angle) * 14;
        const orbPulse = interpolate(
          Math.sin((loopFrame / TOTAL_FRAMES) * Math.PI * 2 + orb.startAngle),
          [-1, 1],
          [0.06, 0.14]
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: driftX - orb.size / 2,
              top: driftY - orb.size / 2,
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background: accentColor,
              opacity: orbPulse,
              filter: `blur(${orb.size * 0.45}px)`,
            }}
          />
        );
      })}

      {/* Accent shimmer — barely-there rim on top edge */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${accentColor} 0%, transparent 8%)`,
          opacity: shimmerOpacity,
        }}
      />
    </AbsoluteFill>
  );
}
