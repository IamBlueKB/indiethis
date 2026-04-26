/**
 * Genre aggregate computation.
 *
 * Reads all qualifying ReferenceProfile rows for a genre, weights them by
 * source quality × separation confidence × tier weight (commercial=1.0,
 * user_reference=0.5x once popular, user_mix_outcome scales over time), and
 * computes mean / std / p25 / p75 per parameter.
 *
 * Result is upserted into GenreTarget.targetData and consumed at runtime by
 * decisions.ts so Claude knows what professional tracks in this genre sound
 * like.
 */

import { db as prisma } from "@/lib/db";

const PARAM_PATHS: Array<{ key: string; path: string[] }> = [
  { key: "mix_lufs",                  path: ["mix", "lufs"]                  },
  { key: "mix_true_peak",             path: ["mix", "true_peak"]             },
  { key: "mix_loudness_range",        path: ["mix", "loudness_range"]        },
  { key: "mix_dynamic_range",         path: ["mix", "dynamic_range"]         },
  { key: "mix_stereo_width",          path: ["mix", "stereo_width"]          },
  { key: "mix_rt60",                  path: ["mix", "rt60_estimate"]         },
  { key: "fb_sub",                    path: ["mix", "frequency_balance", "sub"]      },
  { key: "fb_low",                    path: ["mix", "frequency_balance", "low"]      },
  { key: "fb_low_mid",                path: ["mix", "frequency_balance", "low_mid"]  },
  { key: "fb_mid",                    path: ["mix", "frequency_balance", "mid"]      },
  { key: "fb_high_mid",               path: ["mix", "frequency_balance", "high_mid"] },
  { key: "fb_air",                    path: ["mix", "frequency_balance", "air"]      },
  { key: "vocal_lufs",                path: ["stems", "vocals", "lufs"]              },
  { key: "vocal_centroid",            path: ["stems", "vocals", "spectral_centroid"] },
  { key: "vocal_crest_factor",        path: ["stems", "vocals", "crest_factor"]      },
  { key: "vocal_stereo_width",        path: ["stems", "vocals", "stereo_width"]      },
  { key: "vocal_to_drums_db",         path: ["relationships", "vocal_to_drums_db"]   },
  { key: "vocal_to_bass_db",          path: ["relationships", "vocal_to_bass_db"]    },
  { key: "vocal_to_other_db",         path: ["relationships", "vocal_to_other_db"]   },
  { key: "vocal_drum_freq_overlap",   path: ["relationships", "vocal_drum_freq_overlap"]  },
  { key: "vocal_other_freq_overlap",  path: ["relationships", "vocal_other_freq_overlap"] },
  { key: "bass_kick_separation",      path: ["relationships", "bass_kick_separation"]     },
];

function pluck(obj: any, path: string[]): number | null {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return null;
    cur = cur[k];
  }
  if (typeof cur !== "number" || !Number.isFinite(cur)) return null;
  return cur;
}

function weightedStats(values: number[], weights: number[]): {
  mean: number; std: number; p25: number; p75: number; n: number;
} {
  if (values.length === 0) return { mean: 0, std: 0, p25: 0, p75: 0, n: 0 };
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  const mean = values.reduce((acc, v, i) => acc + v * weights[i], 0) / totalW;
  const varW = values.reduce((acc, v, i) => acc + weights[i] * (v - mean) ** 2, 0) / totalW;
  const std  = Math.sqrt(Math.max(0, varW));
  // Sort by value, weighted percentile via Σweights up to the percentile fraction
  const idxs = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const cum: number[] = [];
  let acc = 0;
  for (const i of idxs) { acc += weights[i]; cum.push(acc); }
  const findPct = (p: number): number => {
    const target = p * totalW;
    for (let k = 0; k < idxs.length; k++) {
      if (cum[k] >= target) return values[idxs[k]];
    }
    return values[idxs[idxs.length - 1]];
  };
  return { mean, std, p25: findPct(0.25), p75: findPct(0.75), n: values.length };
}

/**
 * Tier weight given a row's source. Commercial always 1.0; user data scales
 * with overall corpus size (see spec WEIGHTING section).
 */
function tierWeight(source: string, qualifyingMixCount: number): number {
  if (source === "commercial")     return 1.0;
  if (source === "user_reference") {
    if (qualifyingMixCount < 100) return 0.5;
    if (qualifyingMixCount < 500) return 0.7;
    return 0.8;
  }
  if (source === "user_mix_outcome") {
    if (qualifyingMixCount < 100) return 0.2;
    if (qualifyingMixCount < 500) return 0.4;
    return 0.5;
  }
  return 0.5;
}

export async function recomputeGenreTarget(genre: string): Promise<void> {
  const profiles = await prisma.referenceProfile.findMany({
    where:  { genre, qualityGatePassed: true },
    select: {
      source: true, sourceQualityWeight: true, separationWeight: true,
      weight: true, profileData: true,
    },
  });

  if (profiles.length === 0) {
    await prisma.genreTarget.upsert({
      where:  { genre },
      create: { genre, trackCount: 0, commercialCount: 0, userRefCount: 0, userOutcomeCount: 0, targetData: {} as any },
      update: { trackCount: 0, commercialCount: 0, userRefCount: 0, userOutcomeCount: 0, targetData: {} as any, lastComputed: new Date() },
    });
    return;
  }

  const commercialCount  = profiles.filter(p => p.source === "commercial").length;
  const userRefCount     = profiles.filter(p => p.source === "user_reference").length;
  const userOutcomeCount = profiles.filter(p => p.source === "user_mix_outcome").length;

  const targets: Record<string, { mean: number; std: number; p25: number; p75: number; n: number }> = {};
  for (const { key, path } of PARAM_PATHS) {
    const vals: number[] = [];
    const wts:  number[] = [];
    for (const p of profiles) {
      const v = pluck(p.profileData, path);
      if (v == null) continue;
      // Note on true peak: lossy-source profiles routinely measure > 0 dBFS
      // because float overshoots aren't bounded by the codec's PCM range.
      // We keep these values (they describe real corpus shape) but clamp the
      // resulting target mean to a safe master ceiling below — so Claude sees
      // "hot and tight" but won't aim past 0 dBTP.
      const w = (p.sourceQualityWeight || 1.0)
              * (p.separationWeight    || 1.0)
              * (p.weight              || 1.0)
              * tierWeight(p.source, userOutcomeCount);
      if (w <= 0) continue;
      vals.push(v);
      wts.push(w);
    }
    if (vals.length >= 3) {
      const stats = weightedStats(vals, wts);
      // Hard clamp the final true-peak target to ≤ −0.5 dBTP regardless of
      // what the corpus produced. Belt-and-braces on top of the per-row gate.
      if (key === "mix_true_peak") {
        const cap = -0.5;
        if (stats.mean > cap) stats.mean = cap;
        if (stats.p75  > cap) stats.p75  = cap;
        if (stats.p25  > cap) stats.p25  = cap;
      }
      targets[key] = stats;
    }
  }

  await prisma.genreTarget.upsert({
    where:  { genre },
    create: {
      genre,
      trackCount:       profiles.length,
      commercialCount, userRefCount, userOutcomeCount,
      targetData:       targets as any,
    },
    update: {
      trackCount:       profiles.length,
      commercialCount, userRefCount, userOutcomeCount,
      pendingCount:     0,
      targetData:       targets as any,
      lastComputed:     new Date(),
    },
  });
}

export async function recomputeAllGenres(): Promise<string[]> {
  const genres = await prisma.referenceProfile.findMany({
    where: { qualityGatePassed: true }, distinct: ["genre"], select: { genre: true },
  });
  for (const g of genres) await recomputeGenreTarget(g.genre);
  return genres.map(g => g.genre);
}
