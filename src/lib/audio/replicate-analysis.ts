/**
 * src/lib/audio/replicate-analysis.ts
 *
 * Full audio analysis via the existing Replicate essentia integration.
 * Uses the already-deployed mtg/music-classifiers model (no custom Cog needed).
 *
 * BPM and musical key are NOT available from this model — those fields
 * return null and callers should preserve any existing DB values.
 */

import { analyzeWithEssentia } from "@/lib/audio/essentia-analysis";

export interface AudioAnalysisResult {
  bpm:          number | null;   // null = not detected by this model
  musicalKey:   string | null;   // null = not detected by this model
  energy:       number;          // approximated from danceability score
  genres:       { label: string; score: number }[];
  moods:        { label: string; score: number }[];
  instruments:  { label: string; score: number }[];
  danceability: number;
  isVocal:      boolean;
  isTonal:      boolean;
}

/**
 * Run audio analysis via Replicate (mtg/music-classifiers).
 * Returns null on failure — callers must handle gracefully.
 */
export async function analyzeAudioOnReplicate(
  audioUrl: string,
): Promise<AudioAnalysisResult | null> {
  console.log("[replicate-analysis] Starting essentia analysis for:", audioUrl.slice(0, 80));

  const result = await analyzeWithEssentia(audioUrl);
  if (!result) {
    console.error("[replicate-analysis] analyzeWithEssentia returned null");
    return null;
  }

  console.log(
    "[replicate-analysis] Done —",
    `genre=${result.genres[0]?.label ?? "?"} mood=${result.moods[0]?.label ?? "?"}`,
    `dance=${result.danceability.toFixed(2)} voice=${result.voice}`,
  );

  return {
    bpm:          null,              // not available from this model
    musicalKey:   null,             // not available from this model
    energy:       result.danceability, // approximation
    genres:       result.genres,
    moods:        result.moods,
    instruments:  result.instruments,
    danceability: result.danceability,
    isVocal:      result.voice === "vocal",
    isTonal:      result.timbre === "bright",
  };
}
