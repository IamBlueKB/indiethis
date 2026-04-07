/**
 * src/lib/lyric-video/background-generator.ts
 *
 * Lyric Video Studio — Background Scene Generator
 *
 * Generates one atmospheric Kling v3 Pro video clip per song section.
 * Rules:
 *   - No people, no faces, no text in any clip
 *   - Cover art image is used as the visual seed for color consistency
 *   - Max 3 concurrent generations
 *   - Each clip is 5–10 seconds (clamped to section duration, max 10s)
 *   - Prompts are built from section mood + energy + optional vision direction
 */

import { fal }          from "@fal-ai/client";
import type { SongSection } from "@/lib/video-studio/song-analyzer";

// ─── Constants ─────────────────────────────────────────────────────────────────

const KLING_V3_PRO = "fal-ai/kling-video/v3/pro/image-to-video";
const MAX_CONCURRENT = 3;
const SAFETY_SUFFIX  = ", no people, no faces, no characters, no text, no words, no letters, no human figures, no silhouettes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackgroundScene {
  sectionIndex: number;
  sectionType:  string;  // intro | verse | chorus | bridge | outro | drop | breakdown
  videoUrl:     string;
  prompt:       string;
  startTime:    number;  // seconds
  endTime:      number;
}

interface GenerateOptions {
  sections:       SongSection[];
  coverArtUrl?:   string | null;      // image seed for color consistency
  colorPalette?:  { primary: string; secondary: string; accent: string } | null;
  visionPrompt?:  string | null;      // free-text direction from artist
  aspectRatio?:   "16:9" | "9:16" | "1:1";
  onProgress?:    (completed: number, total: number) => void;
}

// ─── Mood → visual prompt mappings ───────────────────────────────────────────

const MOOD_VISUALS: Record<string, string> = {
  atmospheric:  "soft ethereal light rays, floating dust particles, misty atmosphere, subtle gradient wash",
  intense:      "dramatic storm clouds, electric lightning arcs, swirling dark vortex, high-contrast shadows",
  melancholic:  "slow rain on glass, foggy empty street, soft bokeh city lights, desaturated tones",
  euphoric:     "golden hour light bursts, iridescent lens flares, blooming light orbs, warm prismatic rays",
  aggressive:   "fractured neon shards, chaotic pixel noise, stark black and red geometry, rapid glitch pulses",
  dreamy:       "soft watercolor washes, slow floating particles, pastel bloom, cinematic shallow depth",
  triumphant:   "rising sun through clouds, sweeping mountain landscape, glowing aurora ribbons, epic sky",
};

const SECTION_VISUALS: Record<string, string> = {
  intro:        "slow cinematic reveal, gentle light emerge from darkness, ambient atmosphere",
  verse:        "steady flowing movement, subtle environmental details, smooth camera drift",
  chorus:       "dynamic expanding light, energetic bloom, bold color wave, pulsating glow",
  bridge:       "transitional color shift, slow morphing abstract shapes, ethereal blur",
  outro:        "gradual fade to stillness, particles dispersing, calm ambient light",
  drop:         "explosive light burst, rapid abstract geometry, maximum energy peak",
  breakdown:    "stripped back minimal environment, slow motion details, intimate close-up texture",
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  section:       SongSection,
  visionPrompt?: string | null,
  colorPalette?: { primary: string; secondary: string; accent: string } | null,
): string {
  const moodBase    = MOOD_VISUALS[section.mood]    ?? MOOD_VISUALS.atmospheric;
  const sectionBase = SECTION_VISUALS[section.type] ?? SECTION_VISUALS.verse;

  const energyMod =
    section.energy > 0.75 ? "high energy, vibrant, dynamic movement" :
    section.energy > 0.4  ? "moderate energy, flowing motion"       :
    "slow calm movement, gentle";

  // Color hint from palette if available
  const colorHint = colorPalette
    ? `color palette inspired by ${colorPalette.primary} and ${colorPalette.secondary} tones, `
    : "";

  // Artist's free-text direction (prepended if provided)
  const visionHint = visionPrompt ? `${visionPrompt}, ` : "";

  const base = `${visionHint}${colorHint}${sectionBase}, ${moodBase}, ${energyMod}, abstract cinematic background, 4K quality, smooth motion, atmospheric depth`;

  return base + SAFETY_SUFFIX;
}

// ─── Single clip generator ────────────────────────────────────────────────────

async function generateOneClip(
  section:      SongSection,
  index:        number,
  coverArtUrl?: string | null,
  visionPrompt?: string | null,
  colorPalette?: { primary: string; secondary: string; accent: string } | null,
  aspectRatio:  "16:9" | "9:16" | "1:1" = "16:9",
): Promise<BackgroundScene> {
  const prompt   = buildPrompt(section, visionPrompt, colorPalette);
  const duration = Math.max(5, Math.min(10, Math.round(section.duration)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt,
    duration,
    aspect_ratio: aspectRatio,
  };

  // Use cover art as image seed if available — anchors the color palette
  if (coverArtUrl) {
    input.image_url = coverArtUrl;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe(KLING_V3_PRO as any, {
      input,
      pollInterval: 5000,
      logs:         false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output   = (result as any).data ?? result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoUrl = (output as any)?.video?.url ?? (output as any)?.url ?? "";

    if (!videoUrl) throw new Error(`Kling returned no video URL for section ${index}`);

    return {
      sectionIndex: index,
      sectionType:  section.type,
      videoUrl,
      prompt,
      startTime:    section.startTime,
      endTime:      section.endTime,
    };
  } catch (err) {
    // Return empty placeholder so the pipeline can continue with other sections
    console.error(`[background-generator] section ${index} failed:`, err);
    return {
      sectionIndex: index,
      sectionType:  section.type,
      videoUrl:     "",
      prompt,
      startTime:    section.startTime,
      endTime:      section.endTime,
    };
  }
}

// ─── Main: generate all backgrounds in parallel batches ──────────────────────

export async function generateBackgrounds(opts: GenerateOptions): Promise<BackgroundScene[]> {
  const {
    sections,
    coverArtUrl,
    colorPalette,
    visionPrompt,
    aspectRatio = "16:9",
    onProgress,
  } = opts;

  const results: BackgroundScene[] = [];
  let completed = 0;

  // Group sections into batches of MAX_CONCURRENT
  for (let i = 0; i < sections.length; i += MAX_CONCURRENT) {
    const batch = sections.slice(i, i + MAX_CONCURRENT);

    const batchResults = await Promise.all(
      batch.map((section, batchIdx) =>
        generateOneClip(section, i + batchIdx, coverArtUrl, visionPrompt, colorPalette, aspectRatio),
      ),
    );

    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, sections.length);
  }

  return results;
}

// ─── Director Mode: generate one specific section background ─────────────────

export async function generateSectionBackground(
  section:       SongSection,
  sectionIndex:  number,
  promptOverride: string,  // Director Mode custom prompt
  coverArtUrl?:  string | null,
  aspectRatio:   "16:9" | "9:16" | "1:1" = "16:9",
): Promise<BackgroundScene> {
  const prompt   = promptOverride + SAFETY_SUFFIX;
  const duration = Math.max(5, Math.min(10, Math.round(section.duration)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt,
    duration,
    aspect_ratio: aspectRatio,
  };

  if (coverArtUrl) input.image_url = coverArtUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe(KLING_V3_PRO as any, {
    input,
    pollInterval: 5000,
    logs:         false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output   = (result as any).data ?? result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoUrl = (output as any)?.video?.url ?? (output as any)?.url ?? "";

  if (!videoUrl) throw new Error(`Kling returned no video for section ${sectionIndex}`);

  return {
    sectionIndex,
    sectionType: section.type,
    videoUrl,
    prompt,
    startTime:   section.startTime,
    endTime:     section.endTime,
  };
}
