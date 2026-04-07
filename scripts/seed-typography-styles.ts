/**
 * scripts/seed-typography-styles.ts
 * Run: npx tsx scripts/seed-typography-styles.ts
 *
 * Seeds the 5 TypographyStyle records for the Lyric Video Studio.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const STYLES = [
  {
    name:        "KARAOKE",
    displayName: "Karaoke Highlight",
    description: "Words light up one by one as they play — classic sing-along style",
    sortOrder:   0,
    previewCss: {
      fontFamily:      "'Inter', sans-serif",
      fontSize:        "3.5rem",
      fontWeight:      "900",
      activeColor:     "#D4A843",
      inactiveColor:   "rgba(255,255,255,0.35)",
      textShadow:      "0 0 20px rgba(212,168,67,0.6)",
      letterSpacing:   "0.02em",
    },
    remotionConfig: {
      animation:       "karaoke",
      highlightEasing: "linear",
      revealMode:      "word",          // word | char
      glowRadius:      20,
      activeScale:     1.05,
      inactiveOpacity: 0.35,
    },
  },
  {
    name:        "KINETIC_BOUNCE",
    displayName: "Kinetic Bounce",
    description: "Each word bounces in with elastic energy on the beat",
    sortOrder:   1,
    previewCss: {
      fontFamily:      "'Montserrat', sans-serif",
      fontSize:        "3.5rem",
      fontWeight:      "800",
      color:           "#FFFFFF",
      textShadow:      "0 4px 16px rgba(0,0,0,0.8)",
      letterSpacing:   "0.05em",
      textTransform:   "uppercase",
    },
    remotionConfig: {
      animation:       "kinetic_bounce",
      enterEasing:     "spring",
      springConfig:    { mass: 0.6, stiffness: 280, damping: 18 },
      enterFromY:      40,
      exitToY:         -20,
      staggerMs:       40,
      wordScale:       [0.7, 1.12, 1.0],
    },
  },
  {
    name:        "SMOOTH_FADE",
    displayName: "Smooth Fade",
    description: "Lyrics dissolve in and out with a cinematic, flowing feel",
    sortOrder:   2,
    previewCss: {
      fontFamily:      "'Playfair Display', serif",
      fontSize:        "3rem",
      fontWeight:      "400",
      color:           "#F0F0F0",
      fontStyle:       "italic",
      letterSpacing:   "0.04em",
      lineHeight:      "1.5",
    },
    remotionConfig: {
      animation:       "smooth_fade",
      enterDurationFrames:  18,
      exitDurationFrames:   12,
      enterEasing:     "easeOut",
      exitEasing:      "easeIn",
      enterFromY:      10,
      maxLinesVisible: 2,
    },
  },
  {
    name:        "GLITCH",
    displayName: "Glitch",
    description: "Distorted chromatic aberration — raw, digital, underground",
    sortOrder:   3,
    previewCss: {
      fontFamily:      "'Space Mono', monospace",
      fontSize:        "3.5rem",
      fontWeight:      "700",
      color:           "#FFFFFF",
      textTransform:   "uppercase",
      letterSpacing:   "0.08em",
    },
    remotionConfig: {
      animation:          "glitch",
      glitchIntensity:    0.6,
      chromaticOffset:    4,
      scanlineOpacity:    0.15,
      flickerFrequency:   0.08,
      glitchOnBeat:       true,
      noiseBlend:         "overlay",
    },
  },
  {
    name:        "HANDWRITTEN",
    displayName: "Handwritten",
    description: "Lyrics appear as if written by hand — warm and personal",
    sortOrder:   4,
    previewCss: {
      fontFamily:      "'Dancing Script', cursive",
      fontSize:        "4rem",
      fontWeight:      "600",
      color:           "#F5F0E8",
      letterSpacing:   "0.02em",
      lineHeight:      "1.4",
    },
    remotionConfig: {
      animation:       "handwritten",
      drawDurationFrames: 24,
      strokeColor:     "#F5F0E8",
      strokeWidth:     2,
      fillDelay:       8,
      inkStyle:        "natural",
      wobble:          0.3,
    },
  },
];

async function main() {
  console.log("Seeding TypographyStyle records...");

  for (const style of STYLES) {
    const result = await db.typographyStyle.upsert({
      where:  { name: style.name },
      update: {
        displayName:    style.displayName,
        description:    style.description,
        previewCss:     style.previewCss,
        remotionConfig: style.remotionConfig,
        sortOrder:      style.sortOrder,
      },
      create: style,
    });
    console.log(`  ✓ ${result.name} (${result.id})`);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
