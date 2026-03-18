import React from "react";
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// ─── Types (mirror the shape that ai-job-processor generates) ─────────────────

export type LyricWord = {
  word: string;
  startFrame: number;
  endFrame: number;
  emphasize: boolean;
};

export type LyricLine = {
  lineIndex: number;
  text: string;
  animation: "fadeIn" | "typewriter" | "slideUp" | "bounce";
  lineStartFrame: number;
  lineEndFrame: number;
  position: "top" | "center" | "bottom";
  /** 0–100 percentage from top of frame */
  y: number;
  words: LyricWord[];
};

export type LyricVideoProps = {
  trackUrl: string;
  animationScript: LyricLine[];
  visualStyle: string;
  fontStyle: string;
  accentColor: string;
  aspectRatio: string;
  /** Content-only duration (frames). Root adds 60 frames for the outro. */
  durationInFrames: number;
};

// ─── Background gradients per visual style ────────────────────────────────────

const BACKGROUNDS: Record<string, string> = {
  gradient:  "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  cinematic: "#0a0a0a",
  minimal:   "#111111",
  neon:      "linear-gradient(135deg, #0d0d0d 0%, #1a0a2e 100%)",
};

// ─── Main content component ───────────────────────────────────────────────────

export function LyricVideoContent(props: LyricVideoProps) {
  const { trackUrl, animationScript, visualStyle, fontStyle, accentColor } = props;

  const background = BACKGROUNDS[visualStyle] ?? BACKGROUNDS.cinematic;
  const fontFamily =
    fontStyle === "elegant"
      ? "Georgia, 'Times New Roman', serif"
      : "'Arial Black', Arial, Helvetica, sans-serif";

  return (
    <AbsoluteFill style={{ background }}>
      {/* Audio plays for the full content duration */}
      <Audio src={trackUrl} />

      {animationScript.map((line) => (
        <AnimatedLine
          key={line.lineIndex}
          line={line}
          accentColor={accentColor}
          fontFamily={fontFamily}
        />
      ))}
    </AbsoluteFill>
  );
}

// ─── Single animated lyric line ───────────────────────────────────────────────

function AnimatedLine({
  line,
  accentColor,
  fontFamily,
}: {
  line: LyricLine;
  accentColor: string;
  fontFamily: string;
}) {
  const frame = useCurrentFrame();
  const { lineStartFrame, lineEndFrame, animation } = line;

  // Only render while this line is active (avoid DOM bloat)
  if (frame < lineStartFrame - 1 || frame > lineEndFrame + 1) return null;

  // Fade envelope shared by all animation types
  const fadeInEnd   = lineStartFrame + 12;
  const fadeOutStart = Math.max(fadeInEnd, lineEndFrame - 12);

  const opacity = interpolate(
    frame,
    [lineStartFrame, fadeInEnd, fadeOutStart, lineEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Transform based on animation type ──
  let transform = "none";

  if (animation === "slideUp") {
    const yOffset = interpolate(frame, [lineStartFrame, fadeInEnd], [40, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    transform = `translateY(${yOffset}px)`;
  } else if (animation === "bounce") {
    const scale = interpolate(
      frame,
      [lineStartFrame, lineStartFrame + 6, lineStartFrame + 12],
      [0.75, 1.08, 1.0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    transform = `scale(${scale})`;
  }

  // Top position: y is 0–100% of frame height
  const topPercent = `${line.y}%`;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: topPercent,
        textAlign: "center",
        opacity,
        transform,
        padding: "0 8%",
        pointerEvents: "none",
      }}
    >
      {animation === "typewriter" ? (
        <TypewriterText line={line} frame={frame} fontFamily={fontFamily} accentColor={accentColor} />
      ) : (
        <HighlightedWords line={line} frame={frame} fontFamily={fontFamily} accentColor={accentColor} />
      )}
    </div>
  );
}

// ─── Typewriter: characters appear progressively ──────────────────────────────

function TypewriterText({
  line,
  frame,
  fontFamily,
  accentColor,
}: {
  line: LyricLine;
  frame: number;
  fontFamily: string;
  accentColor: string;
}) {
  const totalChars = line.text.length;
  const elapsed    = frame - line.lineStartFrame;
  const duration   = Math.max(1, line.lineEndFrame - line.lineStartFrame);
  const visible    = Math.min(totalChars, Math.floor((elapsed / duration) * totalChars * 1.15));
  const displayText = line.text.slice(0, visible);

  return (
    <span style={lineTextStyle(fontFamily)}>
      {displayText}
      {visible < totalChars && (
        <span style={{ opacity: frame % 10 < 5 ? 1 : 0, color: accentColor }}>|</span>
      )}
    </span>
  );
}

// ─── Word highlighting: each word lights up when "current" ───────────────────

function HighlightedWords({
  line,
  frame,
  fontFamily,
  accentColor,
}: {
  line: LyricLine;
  frame: number;
  fontFamily: string;
  accentColor: string;
}) {
  if (!line.words || line.words.length === 0) {
    return <span style={lineTextStyle(fontFamily)}>{line.text}</span>;
  }

  return (
    <span style={lineTextStyle(fontFamily)}>
      {line.words.map((word, i) => {
        const isActive = frame >= word.startFrame && frame <= word.endFrame;
        const color    = isActive || word.emphasize ? accentColor : "#FFFFFF";
        const scale    = isActive ? "scale(1.06)" : "scale(1)";

        return (
          <span
            key={i}
            style={{
              color,
              transform: scale,
              display: "inline-block",
              transition: "color 0.1s",
              marginRight: "0.22em",
            }}
          >
            {word.word}
          </span>
        );
      })}
    </span>
  );
}

// ─── Shared text style ────────────────────────────────────────────────────────

function lineTextStyle(fontFamily: string): React.CSSProperties {
  return {
    fontFamily,
    fontSize: "clamp(24px, 4vw, 56px)",
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "0 2px 12px rgba(0,0,0,0.8)",
    lineHeight: 1.3,
    display: "inline-block",
  };
}
