import React from "react";
import {
  AbsoluteFill,
  Audio,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
} from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LyricWord = {
  word:    string;
  startMs: number;
  endMs:   number;
};

export type LyricVideoProps = {
  lyrics:          LyricWord[];
  audioUrl:        string;
  trackTitle:      string;
  artistName:      string;
  backgroundUrl:   string;
  backgroundType:  "image" | "video";
  accentColor?:    string;
  textStyle:       "captions" | "centered" | "cinematic" | "minimal" | "visualizer";
  fontChoice:      "inter" | "playfair" | "montserrat" | "oswald" | "raleway";
  textPosition:    "bottom" | "center" | "top";
  aspectRatio:     "16:9" | "9:16" | "1:1";
  durationMs:      number;
};

// ─── Font mapping ─────────────────────────────────────────────────────────────

const FONT_FAMILY_MAP: Record<LyricVideoProps["fontChoice"], string> = {
  inter:      "Inter, system-ui, sans-serif",
  playfair:   "Georgia, 'Times New Roman', serif",
  montserrat: "system-ui, sans-serif",
  oswald:     "Impact, 'Arial Narrow', sans-serif",
  raleway:    "system-ui, 'Helvetica Neue', sans-serif",
};

// ─── Text position mapping ────────────────────────────────────────────────────

const TEXT_POSITION_MAP: Record<LyricVideoProps["textPosition"], React.CSSProperties> = {
  bottom: { bottom: "8%", top: "auto" },
  center: { top: "50%", transform: "translateY(-50%)" },
  top:    { top: "8%", bottom: "auto" },
};

// ─── Helper: get current word index ──────────────────────────────────────────

function getCurrentWordIndex(lyrics: LyricWord[], currentMs: number): number {
  for (let i = 0; i < lyrics.length; i++) {
    if (currentMs >= lyrics[i].startMs && currentMs <= lyrics[i].endMs) return i;
  }
  // find nearest upcoming word
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].startMs > currentMs) return i - 1;
  }
  return lyrics.length - 1;
}

// ─── Helper: group words into caption lines of 4–6 words ─────────────────────

function groupIntoCaptionLines(lyrics: LyricWord[]): LyricWord[][] {
  const lines: LyricWord[][] = [];
  let i = 0;
  while (i < lyrics.length) {
    const lineSize = Math.min(Math.floor(Math.random() * 3) + 4, lyrics.length - i);
    lines.push(lyrics.slice(i, i + lineSize));
    i += lineSize;
  }
  return lines;
}

// ─── Deterministic grouping (no random) ──────────────────────────────────────

function groupIntoCaptionLinesDet(lyrics: LyricWord[]): LyricWord[][] {
  const lines: LyricWord[][] = [];
  let i = 0;
  let toggle = 0;
  while (i < lyrics.length) {
    const lineSize = toggle % 2 === 0 ? 5 : 4;
    lines.push(lyrics.slice(i, i + Math.min(lineSize, lyrics.length - i)));
    i += lineSize;
    toggle++;
  }
  return lines;
}

// ─── Background component ────────────────────────────────────────────────────

function Background({
  backgroundUrl,
  backgroundType,
  durationMs,
}: Pick<LyricVideoProps, "backgroundUrl" | "backgroundType" | "durationMs">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = Math.ceil((durationMs / 1000) * fps);

  const scale = interpolate(frame, [0, totalFrames], [1.0, 1.08], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });

  if (backgroundType === "video") {
    return (
      <AbsoluteFill>
        <Video
          src={backgroundUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loop
        />
        {/* Dark gradient overlay */}
        <AbsoluteFill
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 100%)",
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          overflow: "hidden",
        }}
      >
        <Img
          src={backgroundUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {/* Dark gradient overlay — bottom-heavy */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

// ─── Text styles ──────────────────────────────────────────────────────────────

/** CAPTIONS — groups words into lines of 4–5, highlights active word */
function CaptionsStyle({
  lyrics,
  accentColor,
  fontFamily,
  textPosition,
}: {
  lyrics:       LyricWord[];
  accentColor:  string;
  fontFamily:   string;
  textPosition: LyricVideoProps["textPosition"];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const lines = groupIntoCaptionLinesDet(lyrics);
  const currentWordIdx = getCurrentWordIndex(lyrics, currentMs);

  // Find which line contains the current word
  let activeLineIdx = 0;
  let wordCount = 0;
  for (let li = 0; li < lines.length; li++) {
    if (wordCount + lines[li].length > currentWordIdx) {
      activeLineIdx = li;
      break;
    }
    wordCount += lines[li].length;
  }

  const activeLine = lines[activeLineIdx];
  if (!activeLine) return null;

  const lineStartMs = activeLine[0].startMs;
  const lineEndMs   = activeLine[activeLine.length - 1].endMs;
  const lineStartFrame = (lineStartMs / 1000) * fps;
  const lineEndFrame   = (lineEndMs   / 1000) * fps;

  const opacity = interpolate(
    frame,
    [lineStartFrame - 3, lineStartFrame + 3, lineEndFrame - 3, lineEndFrame + 3],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const positionStyle: React.CSSProperties =
    textPosition === "center"
      ? { top: 0, bottom: 0, display: "flex", alignItems: "center" }
      : textPosition === "top"
      ? { top: "8%", bottom: "auto" }
      : { bottom: "8%", top: "auto" };

  let wordOffset = 0;
  for (let li = 0; li < activeLineIdx; li++) wordOffset += lines[li].length;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...positionStyle,
          textAlign: "center",
          padding: "0 6%",
          opacity,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.2em",
          }}
        >
          {activeLine.map((w, i) => {
            const globalIdx = wordOffset + i;
            const isActive = globalIdx === currentWordIdx;
            const isPast   = globalIdx < currentWordIdx;
            const color =
              isActive ? accentColor
              : isPast  ? "rgba(255,255,255,0.5)"
              : "#FFFFFF";

            const wordStartFrame = (w.startMs / 1000) * fps;
            const wordEndFrame   = (w.endMs   / 1000) * fps;
            const wordScale = interpolate(
              frame,
              [wordStartFrame, wordStartFrame + 2, wordEndFrame - 2, wordEndFrame],
              [1.0, 1.05, 1.05, 1.0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontSize:   "clamp(28px, 4.5vw, 64px)",
                  fontWeight: 700,
                  color,
                  display:    "inline-block",
                  transform:  `scale(${wordScale})`,
                  textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                  lineHeight: 1.3,
                  transition: "color 0.1s",
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** CENTERED — one word at a time, center of frame, fade + scale */
function CenteredStyle({
  lyrics,
  accentColor,
  fontFamily,
}: {
  lyrics:      LyricWord[];
  accentColor: string;
  fontFamily:  string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const currentIdx = getCurrentWordIndex(lyrics, currentMs);
  const word = lyrics[currentIdx];
  if (!word) return null;

  const wordStartFrame = (word.startMs / 1000) * fps;
  const wordEndFrame   = (word.endMs   / 1000) * fps;

  const opacity = interpolate(
    frame,
    [wordStartFrame, wordStartFrame + 3, wordEndFrame - 3, wordEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const wordProgress = interpolate(
    frame,
    [wordStartFrame, (wordStartFrame + wordEndFrame) / 2, wordEndFrame],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(wordProgress, [0, 0.5, 1], [1.0, 1.05, 1.0]);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        pointerEvents:  "none",
      }}
    >
      <span
        style={{
          fontFamily,
          fontSize:   "clamp(48px, 8vw, 120px)",
          fontWeight: 800,
          color:      accentColor,
          opacity,
          transform:  `scale(${scale})`,
          textShadow: "0 4px 24px rgba(0,0,0,0.8)",
          display:    "inline-block",
          textAlign:  "center",
          padding:    "0 8%",
        }}
      >
        {word.word}
      </span>
    </AbsoluteFill>
  );
}

/** CINEMATIC — current line as a horizontal bar with blur backdrop */
function CinematicStyle({
  lyrics,
  accentColor,
  fontFamily,
}: {
  lyrics:      LyricWord[];
  accentColor: string;
  fontFamily:  string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const currentIdx = getCurrentWordIndex(lyrics, currentMs);

  const lines = groupIntoCaptionLinesDet(lyrics);
  let activeLineIdx = 0;
  let wordCount = 0;
  for (let li = 0; li < lines.length; li++) {
    if (wordCount + lines[li].length > currentIdx) { activeLineIdx = li; break; }
    wordCount += lines[li].length;
  }

  const activeLine = lines[activeLineIdx];
  if (!activeLine) return null;

  const lineStartMs    = activeLine[0].startMs;
  const lineEndMs      = activeLine[activeLine.length - 1].endMs;
  const lineStartFrame = (lineStartMs / 1000) * fps;
  const lineEndFrame   = (lineEndMs   / 1000) * fps;

  const slideY = interpolate(
    frame,
    [lineStartFrame, lineStartFrame + 8],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  const opacity = interpolate(
    frame,
    [lineStartFrame, lineStartFrame + 6, lineEndFrame - 6, lineEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const lineText = activeLine.map((w) => w.word).join(" ");

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position:  "absolute",
          bottom:    "10%",
          left:      0,
          right:     0,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        <div
          style={{
            display:           "inline-block",
            padding:           "12px 32px",
            backdropFilter:    "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            backgroundColor:  "rgba(0,0,0,0.35)",
            borderRadius:     "8px",
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize:   "clamp(24px, 3.5vw, 56px)",
              fontWeight: 600,
              color:      "#FFFFFF",
              textShadow: `0 0 24px ${accentColor}40, 0 2px 8px rgba(0,0,0,0.8)`,
              lineHeight: 1.4,
              letterSpacing: "0.02em",
            }}
          >
            {lineText}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** MINIMAL — lowercase, small, bottom-left, current word slightly brighter */
function MinimalStyle({
  lyrics,
  accentColor,
  fontFamily,
  textPosition,
}: {
  lyrics:       LyricWord[];
  accentColor:  string;
  fontFamily:   string;
  textPosition: LyricVideoProps["textPosition"];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const currentIdx = getCurrentWordIndex(lyrics, currentMs);

  // Show a window of words around the current one
  const windowStart = Math.max(0, currentIdx - 3);
  const windowEnd   = Math.min(lyrics.length, currentIdx + 8);
  const visibleWords = lyrics.slice(windowStart, windowEnd);

  const positionStyle: React.CSSProperties =
    textPosition === "center"
      ? { top: "50%", transform: "translateY(-50%)", left: "6%", right: "6%", textAlign: "center" }
      : textPosition === "top"
      ? { top: "8%", left: "6%", right: "6%" }
      : { bottom: "8%", left: "6%", right: "6%" };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position:   "absolute",
          ...positionStyle,
          lineHeight: 1.6,
        }}
      >
        {visibleWords.map((w, i) => {
          const globalIdx = windowStart + i;
          const isCurrent = globalIdx === currentIdx;
          return (
            <span
              key={globalIdx}
              style={{
                fontFamily,
                fontSize:      "clamp(14px, 1.8vw, 24px)",
                fontWeight:    isCurrent ? 500 : 400,
                color:         isCurrent ? accentColor : "rgba(255,255,255,0.55)",
                textTransform: "lowercase",
                marginRight:   "0.35em",
                display:       "inline-block",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** VISUALIZER — animated waveform + captions overlay */
function VisualizerStyle({
  lyrics,
  accentColor,
  fontFamily,
}: {
  lyrics:      LyricWord[];
  accentColor: string;
  fontFamily:  string;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Compute "energy" proxy: words per second in ±2s window
  const windowMs = 2000;
  const nearbyWords = lyrics.filter(
    (w) => w.startMs >= currentMs - windowMs && w.startMs <= currentMs + windowMs,
  ).length;
  const energy = Math.min(nearbyWords / 8, 1);

  // Animate bars using spring
  const springValue = spring({ frame, fps, config: { damping: 18, stiffness: 200, mass: 0.5 } });
  const pulseScale  = interpolate(springValue, [0, 1], [0.85, 1.0 + energy * 0.25]);

  const BAR_COUNT  = 32;
  const centerX    = width / 2;
  const centerY    = height / 2;
  const radius     = Math.min(width, height) * 0.28 * pulseScale;

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const angle     = (i / BAR_COUNT) * Math.PI * 2;
    const barHeight = interpolate(
      (Math.sin(frame / 8 + i * 0.4) + 1) / 2,
      [0, 1],
      [radius * 0.1, radius * (0.15 + energy * 0.35)],
    );

    const x1 = centerX + Math.cos(angle) * radius;
    const y1 = centerY + Math.sin(angle) * radius;
    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
    const y2 = centerY + Math.sin(angle) * (radius + barHeight);

    return { x1, y1, x2, y2 };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Waveform bars */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 ${width} ${height}`}
      >
        {bars.map((b, i) => (
          <line
            key={i}
            x1={b.x1} y1={b.y1}
            x2={b.x2} y2={b.y2}
            stroke={accentColor}
            strokeWidth={Math.max(2, width / 400)}
            strokeLinecap="round"
            opacity={0.7 + energy * 0.3}
          />
        ))}
        {/* Center circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius * 0.88}
          fill="rgba(0,0,0,0.3)"
          stroke={accentColor}
          strokeWidth={Math.max(1.5, width / 600)}
          opacity={0.6}
        />
      </svg>

      {/* Captions overlay */}
      <CaptionsStyle
        lyrics={lyrics}
        accentColor={accentColor}
        fontFamily={fontFamily}
        textPosition="bottom"
      />
    </AbsoluteFill>
  );
}

// ─── Main composition component ───────────────────────────────────────────────

export function LyricVideoContent(props: LyricVideoProps) {
  const {
    lyrics,
    audioUrl,
    backgroundUrl,
    backgroundType,
    accentColor    = "#D4A843",
    textStyle,
    fontChoice,
    textPosition,
    durationMs,
  } = props;

  const fontFamily = FONT_FAMILY_MAP[fontChoice] ?? FONT_FAMILY_MAP.inter;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Audio */}
      <Audio src={audioUrl} />

      {/* Background */}
      <Background
        backgroundUrl={backgroundUrl}
        backgroundType={backgroundType}
        durationMs={durationMs}
      />

      {/* Text overlay */}
      {textStyle === "captions" && (
        <CaptionsStyle
          lyrics={lyrics}
          accentColor={accentColor}
          fontFamily={fontFamily}
          textPosition={textPosition}
        />
      )}
      {textStyle === "centered" && (
        <CenteredStyle
          lyrics={lyrics}
          accentColor={accentColor}
          fontFamily={fontFamily}
        />
      )}
      {textStyle === "cinematic" && (
        <CinematicStyle
          lyrics={lyrics}
          accentColor={accentColor}
          fontFamily={fontFamily}
        />
      )}
      {textStyle === "minimal" && (
        <MinimalStyle
          lyrics={lyrics}
          accentColor={accentColor}
          fontFamily={fontFamily}
          textPosition={textPosition}
        />
      )}
      {textStyle === "visualizer" && (
        <VisualizerStyle
          lyrics={lyrics}
          accentColor={accentColor}
          fontFamily={fontFamily}
        />
      )}
    </AbsoluteFill>
  );
}
