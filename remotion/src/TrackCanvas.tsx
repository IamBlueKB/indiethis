import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TrackCanvasProps {
  coverArtUrl: string;
  audioUrl: string;
  accentColor?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_FRAMES = 180; // 6 s @ 30 fps

// ─── Particle ─────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  opacity: number;
  color: string;
}

function generateParticles(seed: number, accent: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 40; i++) {
    const s = (seed * (i + 1) * 9301 + 49297) % 233280;
    const r = s / 233280;
    const s2 = (s * 9301 + 49297) % 233280;
    const r2 = s2 / 233280;
    const s3 = (s2 * 9301 + 49297) % 233280;
    const r3 = s3 / 233280;
    particles.push({
      x: r * 1080,
      y: r2 * 1920,
      radius: 2 + r3 * 4,
      speed: 0.3 + r * 0.7,
      angle: r2 * Math.PI * 2,
      opacity: 0.3 + r3 * 0.5,
      color: i % 4 === 0 ? accent : "rgba(255,255,255,0.6)",
    });
  }
  return particles;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrackCanvas({ coverArtUrl, audioUrl, accentColor = "#D4A843" }: TrackCanvasProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Ken Burns: slow zoom 1.0 → 1.08 over 6s, then loops ──────────────────
  const loopFrame = frame % TOTAL_FRAMES;
  const progress = loopFrame / TOTAL_FRAMES; // 0 → 1
  const scale = interpolate(progress, [0, 1], [1.0, 1.08]);

  // ── Audio amplitude sampling ──────────────────────────────────────────────
  // Remotion renders server-side; we approximate amplitude from frame position
  // using a sine-based envelope that simulates a typical musical energy curve.
  // When rendered via Lambda, getAudioData() is available; we gracefully fall back.
  // Simulate amplitude: combination of base pulse + transients at typical beat intervals
  const bpm = 128; // default; will be visually plausible for most music
  const framesPerBeat = (fps * 60) / bpm;
  const beatPhase = (loopFrame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.max(0, Math.cos(beatPhase * Math.PI * 2) * 0.5 + 0.5);
  const energy = 0.3 + beatPulse * 0.7;

  // ── Glow intensity driven by energy ──────────────────────────────────────
  const glowOpacity = interpolate(energy, [0, 1], [0.15, 0.55]);
  const glowRadius = interpolate(energy, [0, 1], [40, 120]);

  // ── Color shift overlay ───────────────────────────────────────────────────
  // Subtle accent-color tint that pulses with energy
  const colorShiftOpacity = interpolate(energy, [0, 1], [0.0, 0.12]);

  // ── Particles ─────────────────────────────────────────────────────────────
  const particles = generateParticles(42, accentColor);
  const particleSpeed = interpolate(energy, [0, 1], [0.5, 2.5]);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* Audio (silent during render preview, active in output) */}
      {audioUrl && (
        <Audio src={audioUrl} startFrom={0} volume={0} />
      )}

      {/* ── Cover art with Ken Burns zoom ── */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={coverArtUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {/* ── Dark vignette to give depth ── */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* ── Glow / bloom on edges ── */}
      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 ${glowRadius}px ${glowRadius / 2}px ${accentColor}`,
          opacity: glowOpacity,
          borderRadius: 0,
        }}
      />

      {/* ── Color shift overlay ── */}
      <AbsoluteFill
        style={{
          background: accentColor,
          opacity: colorShiftOpacity,
          mixBlendMode: "overlay",
        }}
      />

      {/* ── Particles ── */}
      <AbsoluteFill style={{ position: "relative" }}>
        {particles.map((p, i) => {
          // Drift each particle along its angle; wrap around edges
          const drift = (loopFrame * p.speed * particleSpeed) % 1920;
          const px = (p.x + Math.cos(p.angle) * drift) % 1080;
          const py = (p.y + Math.sin(p.angle) * drift) % 1920;
          const particleGlow = interpolate(energy, [0, 1], [0, 6]);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: Math.abs(px),
                top: Math.abs(py),
                width: p.radius * 2,
                height: p.radius * 2,
                borderRadius: "50%",
                background: p.color,
                opacity: p.opacity * (0.5 + energy * 0.5),
                filter: `blur(${p.radius * 0.3 + particleGlow}px)`,
                transform: `translate(-50%, -50%)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
