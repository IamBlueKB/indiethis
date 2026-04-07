/**
 * src/lib/cover-art/prompt-enhancer.ts
 *
 * Claude-powered prompt enhancement for the Cover Art Studio.
 *
 * Takes the artist's raw description + style preset + optional track data
 * and produces an optimized image generation prompt. Invisible to the artist —
 * they describe, Claude translates.
 *
 * Also handles Pro tier refinement: given a selected image + feedback instruction,
 * produces a refined prompt that keeps what worked and applies their changes.
 */

import { claude, SONNET } from "@/lib/claude";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptEnhanceInput {
  artistDescription: string;  // what the artist typed (raw vision)
  stylePromptBase:   string;  // from CoverArtStyle.promptBase
  genre:             string | null;
  mood:              string | null;
  bpm:               number | null;
  energy:            number | null;
  trackTitle:        string;
  artistName:        string;
}

// ─── Initial enhancement ──────────────────────────────────────────────────────

export async function enhanceCoverArtPrompt(input: PromptEnhanceInput): Promise<string> {
  const trackContext = [
    input.genre   ? `Genre: ${input.genre}`         : null,
    input.bpm     ? `BPM: ${input.bpm}`             : null,
    input.energy  ? `Energy level: ${Math.round(input.energy * 10)}/10` : null,
    input.mood    ? `Mood: ${input.mood}`            : null,
  ].filter(Boolean).join("\n");

  const response = await claude.messages.create({
    model:      SONNET,
    max_tokens: 300,
    messages: [{
      role:    "user",
      content: `You are an album cover art director. Create a single optimized image generation prompt for an album cover.

Track: "${input.trackTitle}" by ${input.artistName}
${trackContext || "No track analysis data available."}

Style preset: ${input.stylePromptBase}

Artist's vision: "${input.artistDescription}"

Rules:
- Output ONLY the image generation prompt, nothing else — no preamble, no explanation
- Always include "album cover art, square format, 1:1 aspect ratio"
- Include "clean space for text overlay" or "negative space in lower third for title"
- Match the mood to the genre and energy level when data is available
- Blend the style preset with the artist's vision naturally — one should inform the other
- Keep the prompt under 150 words
- Do NOT include the track title or artist name as visible text in the image — text is added later by the artist
- Be specific and cinematic — describe lighting, color palette, composition, atmosphere`,
    }],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Unexpected Claude response type");
  return text.text.trim();
}

// ─── Pro tier refinement ──────────────────────────────────────────────────────

export async function refinePrompt(
  originalPrompt:        string,
  refinementInstruction: string,
): Promise<string> {
  const response = await claude.messages.create({
    model:      SONNET,
    max_tokens: 300,
    messages: [{
      role:    "user",
      content: `You are an album cover art director. An artist selected a cover art variation and wants changes.

Original generation prompt:
"${originalPrompt}"

Artist's refinement instruction:
"${refinementInstruction}"

Create a refined prompt that:
- Keeps what worked from the original (overall composition, mood, style)
- Applies the artist's requested changes precisely
- Still includes "album cover art, square format, 1:1 aspect ratio"
- Still includes space for text overlay in a natural position
- Is under 150 words

Output ONLY the refined prompt, nothing else.`,
    }],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Unexpected Claude response type");
  return text.text.trim();
}

// ─── Mood derivation helper ───────────────────────────────────────────────────

/**
 * Derives a human-readable mood label from AudioFeatures valence + energy.
 * Matches what Claude uses for context.
 */
export function deriveMood(energy: number | null, valence: number | null): string | null {
  if (energy === null && valence === null) return null;
  const e = energy  ?? 0.5;
  const v = valence ?? 0.5;
  if (e > 0.7 && v > 0.6) return "energetic and uplifting";
  if (e > 0.7 && v < 0.4) return "intense and dark";
  if (e < 0.3 && v > 0.6) return "calm and peaceful";
  if (e < 0.3 && v < 0.4) return "melancholic and introspective";
  if (v > 0.7)             return "positive and bright";
  if (v < 0.3)             return "somber and heavy";
  return "balanced and neutral";
}
