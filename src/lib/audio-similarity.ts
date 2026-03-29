import type { AudioFeatureScores } from "./audio-features";

// TODO (scale): When platform exceeds ~5000 artists, pre-compute and cache
// similarity/complementarity scores nightly in an ArtistSimilarity join table
// rather than computing on request.

const FEATURE_KEYS: (keyof Omit<AudioFeatureScores, "genre" | "mood" | "isVocal">)[] = [
  "loudness", "energy", "danceability", "acousticness",
  "instrumentalness", "speechiness", "liveness", "valence",
];

// ─── Similarity (1 = identical, 0 = opposite) ─────────────────────────────────

export function calculateSimilarity(a: AudioFeatureScores, b: AudioFeatureScores): number {
  const sumSquares = FEATURE_KEYS.reduce((sum, key) => {
    const diff = (a[key] as number) - (b[key] as number);
    return sum + diff * diff;
  }, 0);

  const distance    = Math.sqrt(sumSquares);
  const maxDistance = Math.sqrt(FEATURE_KEYS.length); // sqrt(8) ≈ 2.828

  return 1 - distance / maxDistance;
}

// ─── Complementarity (for collab matching) ────────────────────────────────────
// High score = good creative pairing (complementary skills + compatible vibe)

const COMPLEMENTARY_FEATURES: (keyof Omit<AudioFeatureScores, "genre" | "mood" | "isVocal">)[] =
  ["speechiness", "instrumentalness", "acousticness"];

const COMPATIBLE_FEATURES: (keyof Omit<AudioFeatureScores, "genre" | "mood" | "isVocal">)[] =
  ["energy", "danceability", "valence"];

export function calculateComplementarity(a: AudioFeatureScores, b: AudioFeatureScores): number {
  // Difference is GOOD for complementary features
  const complementScore =
    COMPLEMENTARY_FEATURES.reduce((sum, key) => {
      return sum + Math.abs((a[key] as number) - (b[key] as number));
    }, 0) / COMPLEMENTARY_FEATURES.length;

  // Similarity is GOOD for compatible features
  const compatibleScore =
    COMPATIBLE_FEATURES.reduce((sum, key) => {
      return sum + (1 - Math.abs((a[key] as number) - (b[key] as number)));
    }, 0) / COMPATIBLE_FEATURES.length;

  return complementScore * 0.5 + compatibleScore * 0.5;
}

// ─── Collab reason templates ──────────────────────────────────────────────────

export function generateCollabReason(
  a: AudioFeatureScores,
  b: AudioFeatureScores
): string {
  if (a.speechiness > 0.6 && b.instrumentalness > 0.6)
    return "Your vocal style pairs well with their instrumental production";
  if (b.speechiness > 0.6 && a.instrumentalness > 0.6)
    return "Their vocal style pairs well with your instrumental production";
  if (Math.abs(a.energy - b.energy) < 0.15 && a.energy > 0.7)
    return "You both bring high energy — perfect for a hype collab";
  if (a.acousticness > 0.6 && b.acousticness < 0.3)
    return "Your acoustic vibe mixed with their electronic sound creates contrast";
  if (b.acousticness > 0.6 && a.acousticness < 0.3)
    return "Their organic sound complements your electronic production";
  if (a.valence > 0.65 && b.valence < 0.4)
    return "Your uplifting sound offsets their darker, introspective style";
  if (b.valence > 0.65 && a.valence < 0.4)
    return "Their brighter sound lifts your darker, introspective style";
  if (a.danceability > 0.7 && b.danceability > 0.7)
    return "Shared danceability means your fans will instantly vibe with this";
  if (a.liveness > 0.6 && b.liveness < 0.3)
    return "Your live energy mixed with their polished studio feel creates balance";
  if (b.liveness > 0.6 && a.liveness < 0.3)
    return "Their live energy mixed with your polished studio sound creates balance";
  return "Complementary sonic profiles suggest strong creative chemistry";
}

// ─── Strength labels ──────────────────────────────────────────────────────────

export function getTopStrengths(features: AudioFeatureScores, count = 2): string[] {
  return FEATURE_KEYS
    .map(k => ({ key: k, val: features[k] as number }))
    .sort((a, b) => b.val - a.val)
    .slice(0, count)
    .map(({ key }) => key.charAt(0).toUpperCase() + key.slice(1));
}
