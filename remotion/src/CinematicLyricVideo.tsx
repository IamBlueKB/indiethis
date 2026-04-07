import React from "react";
import {
  AbsoluteFill,
  Audio,
  Video,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Word-level lyric timestamp (seconds, from song-analyzer / Whisper) */
export interface LyricWordTimestamp {
  word:  string;
  start: number; // seconds
  end:   number;
}

/** One background scene clip (from background-generator) */
export interface BackgroundSceneClip {
  sectionIndex: number;
  videoUrl:     string;
  startTime:    number; // seconds into track
  endTime:      number;
}

export interface ColorPalette {
  primary:   string;  // hex
  secondary: string;
  accent:    string;
}

export interface CinematicLyricVideoProps {
  audioUrl:         string;
  trackTitle:       string;
  artistName:       string;
  coverArtUrl?:     string;
  backgroundScenes: BackgroundSceneClip[];
  lyrics:           LyricWordTimestamp[];
  typographyStyle:  string; // KARAOKE | KINETIC_BOUNCE | SMOOTH_FADE | GLITCH | HANDWRITTEN
  colorPalette?:    ColorPalette;
  aspectRatio:      "16:9" | "9:16" | "1:1";
  durationMs:       number;
  bpm?:             number;
  beats?:           number[]; // beat timestamps in seconds
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;
const CROSSFADE_FRAMES = 18; // 0.6s crossfade between background clips

// ─── Layer 1: AI Background ───────────────────────────────────────────────────

function BackgroundLayer({
  scenes,
  durationMs,
}: {
  scenes:     BackgroundSceneClip[];
  durationMs: number;
}) {
  const frame = useCurrentFrame();
  const totalFrames = Math.ceil((durationMs / 1000) * FPS);

  // If no scenes, render solid black
  if (!scenes.length) {
    return <AbsoluteFill style={{ backgroundColor: "#0A0A0A" }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A" }}>
      {scenes.map((scene, i) => {
        const startFrame = Math.round(scene.startTime * FPS);
        const endFrame   = Math.min(Math.round(scene.endTime * FPS), totalFrames);
        const clipFrames = endFrame - startFrame;

        if (clipFrames <= 0 || !scene.videoUrl) return null;

        // Fade in from previous clip
        const opacity = interpolate(
          frame - startFrame,
          [0, CROSSFADE_FRAMES],
          [i === 0 ? 1 : 0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <Sequence key={i} from={startFrame} durationInFrames={clipFrames + CROSSFADE_FRAMES}>
            <AbsoluteFill style={{ opacity }}>
              <Video
                src={scene.videoUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                muted
                loop
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

// ─── Layer 2: Audio-reactive effects ─────────────────────────────────────────

function BeatPulse({ frame, beat, color }: { frame: number; beat: number; color: string }) {
  const beatFrame = Math.round(beat * FPS);
  const dist      = frame - beatFrame;

  if (dist < 0 || dist > 12) return null;

  const scale   = interpolate(dist, [0, 6, 12], [1.0, 1.15, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(dist, [0, 6, 12], [0.35, 0.15, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background:  `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
        opacity,
        transform:   `scale(${scale})`,
        mixBlendMode: "screen",
      }}
    />
  );
}

function EffectsLayer({
  beats = [],
  colorPalette,
  durationMs,
}: {
  beats?:       number[];
  colorPalette?: ColorPalette;
  durationMs:   number;
}) {
  const frame = useCurrentFrame();
  const accentColor = colorPalette?.accent ?? "#D4A843";

  // Vignette overlay — always present
  return (
    <>
      {/* Permanent vignette */}
      <AbsoluteFill
        style={{
          background:     "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
          pointerEvents:  "none",
        }}
      />
      {/* Beat pulses — only render near-current beats for performance */}
      {beats.slice(0, 200).map((beat, i) => (
        <BeatPulse key={i} frame={frame} beat={beat} color={accentColor} />
      ))}
    </>
  );
}

// ─── Layer 3: Dynamic Typography ─────────────────────────────────────────────

/** Group words into display lines (max 6 words) */
function groupWords(words: LyricWordTimestamp[], maxWords = 6): LyricWordTimestamp[][] {
  const lines: LyricWordTimestamp[][] = [];
  let i = 0;
  while (i < words.length) {
    const size = Math.min(maxWords, words.length - i);
    lines.push(words.slice(i, i + size));
    i += size;
  }
  return lines;
}

// KARAOKE: highlight word by word as it plays
function KaraokeTypography({
  lyrics,
  colorPalette,
}: {
  lyrics:        LyricWordTimestamp[];
  colorPalette?: ColorPalette;
}) {
  const frame      = useCurrentFrame();
  const currentMs  = (frame / FPS) * 1000;
  const activeColor = colorPalette?.accent ?? "#D4A843";

  // Find which line is active (nearest to now)
  const activeWordIdx = lyrics.findIndex(
    (w) => currentMs >= w.start * 1000 && currentMs <= w.end * 1000,
  );

  // Show window of words around current
  const windowStart = Math.max(0, activeWordIdx - 3);
  const windowEnd   = Math.min(lyrics.length, windowStart + 8);
  const windowWords = lyrics.slice(windowStart, windowEnd);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "center",
        paddingBottom:  "12%",
        paddingLeft:    "8%",
        paddingRight:   "8%",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 12px" }}>
        {windowWords.map((w, i) => {
          const realIdx   = windowStart + i;
          const isActive  = realIdx === activeWordIdx;
          const isPast    = realIdx < activeWordIdx;

          return (
            <span
              key={realIdx}
              style={{
                fontFamily:    "Inter, system-ui, sans-serif",
                fontWeight:    900,
                fontSize:      "clamp(28px, 4vw, 52px)",
                color:         isActive ? activeColor : isPast ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)",
                textShadow:    isActive ? `0 0 24px ${activeColor}99` : "0 2px 8px rgba(0,0,0,0.8)",
                transform:     isActive ? "scale(1.08)" : "scale(1)",
                transition:    "color 0.1s, transform 0.1s",
                letterSpacing: "0.02em",
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

// KINETIC_BOUNCE: each word bounces in on beat entry
function KineticBounceTypography({
  lyrics,
  colorPalette,
}: {
  lyrics:        LyricWordTimestamp[];
  colorPalette?: ColorPalette;
}) {
  const frame     = useCurrentFrame();
  const currentMs = (frame / FPS) * 1000;

  // Find active line group
  const activeIdx = lyrics.findIndex(
    (w) => currentMs >= w.start * 1000 - 100 && currentMs <= w.end * 1000 + 200,
  );

  if (activeIdx < 0) return null;

  // Show line of 6 words
  const lineStart = Math.floor(activeIdx / 6) * 6;
  const lineWords = lyrics.slice(lineStart, lineStart + 6);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "center",
        paddingBottom:  "10%",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", overflow: "hidden" }}>
        {lineWords.map((w, i) => {
          const wordFrame     = Math.round(w.start * FPS);
          const elapsed       = Math.max(0, frame - wordFrame);
          const bounceProgress = spring({
            frame:    elapsed,
            fps:      FPS,
            config:   { mass: 0.6, stiffness: 280, damping: 18 },
          });
          const y  = interpolate(bounceProgress, [0, 1], [40, 0]);
          const op = interpolate(bounceProgress, [0, 1], [0, 1]);

          return (
            <span
              key={i}
              style={{
                fontFamily:    "system-ui, sans-serif",
                fontWeight:    800,
                fontSize:      "clamp(30px, 4.5vw, 58px)",
                color:         "#FFFFFF",
                textShadow:    "0 4px 16px rgba(0,0,0,0.8)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                transform:     `translateY(${y}px)`,
                opacity:       op,
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

// SMOOTH_FADE: one line fades in + out with cinematic ease
function SmoothFadeTypography({
  lyrics,
  colorPalette,
}: {
  lyrics:        LyricWordTimestamp[];
  colorPalette?: ColorPalette;
}) {
  const frame     = useCurrentFrame();
  const currentMs = (frame / FPS) * 1000;
  const lines     = groupWords(lyrics, 5);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "10%",
      }}
    >
      {lines.map((line, lineIdx) => {
        const lineStart = line[0].start * 1000;
        const lineEnd   = line[line.length - 1].end * 1000;

        const entryFrames = Math.round(lineStart / (1000 / FPS));
        const exitFrames  = Math.round(lineEnd   / (1000 / FPS));

        const op = interpolate(
          frame,
          [entryFrames, entryFrames + 18, exitFrames - 12, exitFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const y = interpolate(
          frame,
          [entryFrames, entryFrames + 18],
          [12, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        if (op < 0.01) return null;

        return (
          <div
            key={lineIdx}
            style={{
              position:      "absolute",
              opacity:       op,
              transform:     `translateY(${y}px)`,
              textAlign:     "center",
            }}
          >
            <p
              style={{
                fontFamily:    "'Georgia', 'Times New Roman', serif",
                fontWeight:    400,
                fontSize:      "clamp(28px, 3.5vw, 50px)",
                fontStyle:     "italic",
                color:         "#F0F0F0",
                letterSpacing: "0.04em",
                lineHeight:    1.5,
                margin:        0,
                textShadow:    "0 2px 16px rgba(0,0,0,0.9)",
              }}
            >
              {line.map((w) => w.word).join(" ")}
            </p>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// GLITCH: chromatic aberration on word reveal
function GlitchTypography({
  lyrics,
  colorPalette,
}: {
  lyrics:        LyricWordTimestamp[];
  colorPalette?: ColorPalette;
}) {
  const frame     = useCurrentFrame();
  const currentMs = (frame / FPS) * 1000;
  const lines     = groupWords(lyrics, 4);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "center",
        paddingBottom:  "10%",
      }}
    >
      {lines.map((line, lineIdx) => {
        const lineStart   = line[0].start * 1000;
        const lineEnd     = line[line.length - 1].end * 1000;
        const entryFrame  = Math.round(lineStart / (1000 / FPS));
        const exitFrame   = Math.round(lineEnd   / (1000 / FPS));
        const dist        = frame - entryFrame;
        const glitching   = dist >= 0 && dist < 8;

        const op = interpolate(
          frame,
          [entryFrame, entryFrame + 6, exitFrame - 6, exitFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        if (op < 0.01) return null;

        const text = line.map((w) => w.word).join(" ");
        const shift = glitching ? interpolate(dist, [0, 4, 8], [0, 4, -2]) : 0;

        return (
          <div key={lineIdx} style={{ position: "absolute", opacity: op, textAlign: "center" }}>
            {/* cyan channel */}
            <p style={{
              fontFamily:    "'Courier New', monospace",
              fontWeight:    700,
              fontSize:      "clamp(28px, 4vw, 52px)",
              color:         "#00D1FF",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin:        0,
              position:      "absolute",
              left:          `${shift}px`,
              opacity:       glitching ? 0.5 : 0,
              pointerEvents: "none",
            }}>{text}</p>
            {/* red channel */}
            <p style={{
              fontFamily:    "'Courier New', monospace",
              fontWeight:    700,
              fontSize:      "clamp(28px, 4vw, 52px)",
              color:         "#FF3860",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin:        0,
              position:      "absolute",
              left:          `${-shift}px`,
              opacity:       glitching ? 0.5 : 0,
              pointerEvents: "none",
            }}>{text}</p>
            {/* base */}
            <p style={{
              fontFamily:    "'Courier New', monospace",
              fontWeight:    700,
              fontSize:      "clamp(28px, 4vw, 52px)",
              color:         "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin:        0,
              position:      "relative",
              textShadow:    "0 2px 12px rgba(0,0,0,0.9)",
            }}>{text}</p>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// HANDWRITTEN: character-by-character reveal
function HandwrittenTypography({
  lyrics,
  colorPalette,
}: {
  lyrics:        LyricWordTimestamp[];
  colorPalette?: ColorPalette;
}) {
  const frame     = useCurrentFrame();
  const currentMs = (frame / FPS) * 1000;
  const lines     = groupWords(lyrics, 5);

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "12%",
      }}
    >
      {lines.map((line, lineIdx) => {
        const lineStart  = line[0].start * 1000;
        const lineEnd    = line[line.length - 1].end * 1000;
        const entryFrame = Math.round(lineStart / (1000 / FPS));
        const exitFrame  = Math.round(lineEnd   / (1000 / FPS));
        const chars      = line.map((w) => w.word).join(" ").split("");
        const charDelay  = 1.2; // frames per character

        const lineOp = interpolate(
          frame,
          [exitFrame - 12, exitFrame],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        if (frame < entryFrame || lineOp < 0.01) return null;

        return (
          <div key={lineIdx} style={{ position: "absolute", opacity: lineOp, display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
            {chars.map((ch, ci) => {
              const charFrame = entryFrame + ci * charDelay;
              const progress  = spring({
                frame:  Math.max(0, frame - charFrame),
                fps:    FPS,
                config: { mass: 0.5, stiffness: 320, damping: 22 },
              });
              const op = interpolate(progress, [0, 1], [0, 1]);
              const y  = interpolate(progress, [0, 1], [8, 0]);

              return (
                <span
                  key={ci}
                  style={{
                    fontFamily:    "'Georgia', serif",
                    fontSize:      "clamp(30px, 4vw, 52px)",
                    fontWeight:    600,
                    fontStyle:     "italic",
                    color:         "#F5F0E8",
                    letterSpacing: ch === " " ? "0.3em" : "0.02em",
                    whiteSpace:    "pre",
                    opacity:       op,
                    transform:     `translateY(${y}px)`,
                    display:       "inline-block",
                    textShadow:    "0 2px 12px rgba(0,0,0,0.9)",
                  }}
                >
                  {ch === " " ? "\u00A0" : ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function TypographyLayer({
  typographyStyle,
  lyrics,
  colorPalette,
}: {
  typographyStyle: string;
  lyrics:          LyricWordTimestamp[];
  colorPalette?:   ColorPalette;
}) {
  if (!lyrics.length) return null;

  switch (typographyStyle) {
    case "KARAOKE":        return <KaraokeTypography        lyrics={lyrics} colorPalette={colorPalette} />;
    case "KINETIC_BOUNCE": return <KineticBounceTypography  lyrics={lyrics} colorPalette={colorPalette} />;
    case "SMOOTH_FADE":    return <SmoothFadeTypography     lyrics={lyrics} colorPalette={colorPalette} />;
    case "GLITCH":         return <GlitchTypography         lyrics={lyrics} colorPalette={colorPalette} />;
    case "HANDWRITTEN":    return <HandwrittenTypography    lyrics={lyrics} colorPalette={colorPalette} />;
    default:               return <KaraokeTypography        lyrics={lyrics} colorPalette={colorPalette} />;
  }
}

// ─── Layer 4: Artist Branding ─────────────────────────────────────────────────

function BrandingLayer({
  trackTitle,
  artistName,
  coverArtUrl,
  colorPalette,
  durationMs,
}: {
  trackTitle:    string;
  artistName:    string;
  coverArtUrl?:  string;
  colorPalette?: ColorPalette;
  durationMs:    number;
}) {
  const frame       = useCurrentFrame();
  const totalFrames = Math.ceil((durationMs / 1000) * FPS);
  const accentColor = colorPalette?.accent ?? "#D4A843";

  // Fade in at start, fade out at end
  const opacity = interpolate(
    frame,
    [0, 30, totalFrames - 30, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "flex-end",
        padding:        "4% 5%",
        opacity,
        pointerEvents:  "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {coverArtUrl && (
          <Img
            src={coverArtUrl}
            style={{
              width:        "40px",
              height:       "40px",
              borderRadius: "6px",
              objectFit:    "cover",
              border:       `1px solid ${accentColor}44`,
            }}
          />
        )}
        <div style={{ textAlign: "right" }}>
          <p style={{
            fontFamily:    "Inter, system-ui, sans-serif",
            fontWeight:    700,
            fontSize:      "clamp(12px, 1.2vw, 16px)",
            color:         "#FFFFFF",
            margin:        0,
            textShadow:    "0 1px 6px rgba(0,0,0,0.9)",
            letterSpacing: "0.02em",
          }}>
            {trackTitle}
          </p>
          <p style={{
            fontFamily:    "Inter, system-ui, sans-serif",
            fontWeight:    400,
            fontSize:      "clamp(10px, 1vw, 13px)",
            color:         accentColor,
            margin:        "2px 0 0",
            letterSpacing: "0.04em",
          }}>
            {artistName}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── Root Composition ─────────────────────────────────────────────────────────

export function CinematicLyricVideo(props: CinematicLyricVideoProps) {
  const {
    audioUrl,
    trackTitle,
    artistName,
    coverArtUrl,
    backgroundScenes,
    lyrics,
    typographyStyle,
    colorPalette,
    durationMs,
    beats,
  } = props;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A" }}>
      {/* Layer 1: AI Backgrounds */}
      <BackgroundLayer scenes={backgroundScenes} durationMs={durationMs} />

      {/* Layer 2: Effects */}
      <EffectsLayer beats={beats} colorPalette={colorPalette} durationMs={durationMs} />

      {/* Layer 3: Typography */}
      <TypographyLayer
        typographyStyle={typographyStyle}
        lyrics={lyrics}
        colorPalette={colorPalette}
      />

      {/* Layer 4: Branding */}
      <BrandingLayer
        trackTitle={trackTitle}
        artistName={artistName}
        coverArtUrl={coverArtUrl}
        colorPalette={colorPalette}
        durationMs={durationMs}
      />

      {/* Audio */}
      {audioUrl && (
        <Audio src={audioUrl} />
      )}
    </AbsoluteFill>
  );
}
