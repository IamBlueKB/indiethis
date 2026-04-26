/**
 * Reference-library context loader.
 *
 * Pulls the GenreTarget aggregate + a sample of top-weighted ReferenceProfiles
 * for a genre, formats them as a compact prompt block that Claude can use
 * as a quantitative target in mix/master decisions.
 *
 * Returns null if the genre has no aggregate yet (Claude falls back to
 * built-in defaults — no harm done).
 */

import { db as prisma } from "@/lib/db";

export interface ReferenceContext {
  genre:          string;
  trackCount:     number;
  commercialCount: number;
  userRefCount:   number;
  userOutcomeCount: number;
  promptBlock:    string;
}

const PARAM_LABELS: Record<string, string> = {
  mix_lufs:              "Integrated LUFS",
  mix_true_peak:         "True peak (dBFS)",
  mix_loudness_range:    "LRA (LU)",
  mix_dynamic_range:     "Dynamic range (dB)",
  mix_stereo_width:      "Mix stereo width",
  mix_rt60:              "Mix RT60 (s)",
  fb_sub:                "Freq balance — sub",
  fb_low:                "Freq balance — low",
  fb_low_mid:            "Freq balance — low_mid",
  fb_mid:                "Freq balance — mid",
  fb_high_mid:           "Freq balance — high_mid",
  fb_air:                "Freq balance — air",
  vocal_lufs:            "Vocal LUFS",
  vocal_centroid:        "Vocal spectral centroid (Hz)",
  vocal_crest_factor:    "Vocal crest factor (dB)",
  vocal_stereo_width:    "Vocal stereo width",
  vocal_to_drums_db:     "Vocal-to-drums (dB)",
  vocal_to_bass_db:      "Vocal-to-bass (dB)",
  vocal_to_other_db:     "Vocal-to-other (dB)",
  vocal_drum_freq_overlap:  "Vocal/drum freq overlap",
  vocal_other_freq_overlap: "Vocal/other freq overlap",
  bass_kick_separation:  "Bass/kick separation (dB)",
};

export async function loadReferenceContext(genre: string): Promise<ReferenceContext | null> {
  if (!genre) return null;

  const target = await prisma.genreTarget.findUnique({
    where: { genre },
  }).catch(() => null);

  if (!target || target.trackCount === 0) return null;

  const td = (target.targetData ?? {}) as Record<string, { mean?: number; std?: number; p25?: number; p75?: number }>;
  const lines: string[] = [];

  lines.push(`GENRE PROFILE — ${genre}`);
  lines.push(`Corpus: ${target.trackCount} tracks (${target.commercialCount} commercial, ${target.userRefCount} user-references, ${target.userOutcomeCount} user-mixes)`);
  lines.push("");
  lines.push("Target ranges (mean ± std, p25–p75):");

  // Track which family of params have data so we can warn Claude when entire
  // tiers (e.g. all stem-level metrics) are missing — common when older
  // ingests skipped Demucs separation.
  const STEM_PARAM_KEYS = new Set([
    "vocal_lufs", "vocal_centroid", "vocal_crest_factor", "vocal_stereo_width",
    "vocal_to_drums_db", "vocal_to_bass_db", "vocal_to_other_db",
    "vocal_drum_freq_overlap", "vocal_other_freq_overlap", "bass_kick_separation",
  ]);
  let stemParamsPresent = 0;

  for (const [key, label] of Object.entries(PARAM_LABELS)) {
    const v = td[key];
    if (!v || typeof v.mean !== "number") continue;
    if (STEM_PARAM_KEYS.has(key)) stemParamsPresent++;
    const mean = v.mean.toFixed(2);
    const std  = typeof v.std === "number" ? v.std.toFixed(2) : "?";
    const p25  = typeof v.p25 === "number" ? v.p25.toFixed(2) : "?";
    const p75  = typeof v.p75 === "number" ? v.p75.toFixed(2) : "?";
    lines.push(`  ${label}: ${mean} ± ${std}  (${p25}–${p75})`);
  }

  if (stemParamsPresent === 0) {
    lines.push("");
    lines.push("NOTE: this corpus has no per-stem reference data (vocals/bass/drums analysis missing).");
    lines.push("Use mix-bus targets above as the genre anchor. For stem-level decisions (vocal LUFS,");
    lines.push("vocal-to-drum balance, bass/kick separation) fall back to your built-in priors and the");
    lines.push("user's analyzed song — do not invent stem reference numbers.");
  }

  const promptBlock = lines.join("\n");

  return {
    genre,
    trackCount:       target.trackCount,
    commercialCount:  target.commercialCount,
    userRefCount:     target.userRefCount,
    userOutcomeCount: target.userOutcomeCount,
    promptBlock,
  };
}
