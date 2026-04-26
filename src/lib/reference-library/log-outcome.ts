/**
 * Mix outcome logging — records every COMPLETE mix's downstream outcome
 * (downloaded / revised / abandoned) into MixOutcomeFeedback so the
 * Reference Library can learn from real user behavior.
 *
 * All helpers are fire-and-forget; never throw into a caller.
 */

import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { recomputeGenreTarget } from "@/lib/reference-library/aggregate";

const REVISION_KEYWORDS = [
  // tonal
  "muddy", "thin", "boomy", "boxy", "harsh", "shrill", "dull", "bright", "dark",
  "warm", "cold",
  // dynamics
  "loud", "quiet", "compressed", "punchy", "flat", "dynamic", "squashed", "weak",
  // vocals
  "vocal", "vocals", "lead", "adlib", "harmony", "doubles",
  "buried", "forward", "back", "louder", "quieter", "presence", "clarity",
  // beat / instrumentation
  "beat", "drums", "kick", "snare", "bass", "808", "low end",
  "high end", "highs", "mids", "lows",
  // effects
  "reverb", "delay", "echo", "wet", "dry", "verb",
  // mix character
  "wider", "narrower", "stereo", "mono", "spacious",
];

export function extractRevisionKeywords(feedback: string): string[] {
  const lc = feedback.toLowerCase();
  const hits = new Set<string>();
  for (const kw of REVISION_KEYWORDS) {
    if (lc.includes(kw)) hits.add(kw);
  }
  return [...hits];
}

/**
 * Log a successful download as a positive outcome.
 * Called from the mix download route.
 */
export async function logDownloadOutcome(opts: {
  jobId: string;
}): Promise<void> {
  try {
    const job = await prisma.mixJob.findUnique({
      where: { id: opts.jobId },
      select: {
        id:              true,
        genre:           true,
        tier:            true,
        analysisData:    true,
        mixParameters:   true,
        qaCheckResults:  true,
        revisionCount:   true,
        createdAt:       true,
      },
    });
    if (!job) return;

    // Skip if already logged (only one outcome per job)
    const existing = await prisma.mixOutcomeFeedback.findFirst({
      where: { mixJobId: job.id },
    });
    if (existing) return;

    // Time-to-download in seconds
    const timeToDownload = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);

    // Holdout flag: 10% of jobs are sampled for A/B testing (hash on job id)
    const isHoldout = hashToBucket(job.id, 10) === 0;

    const inputQualityScore = computeInputQualityScore(job.analysisData);
    const outputAnalysis    = pickPolishedQa(job.qaCheckResults);
    const deviationFromTarget = await computeDeviation(job.genre ?? "", outputAnalysis);

    await prisma.mixOutcomeFeedback.create({
      data: {
        mixJobId:          job.id,
        genre:             job.genre ?? "unknown",
        tier:              job.tier ?? "STANDARD",
        inputQualityScore,
        mixParamsUsed:     (job.mixParameters ?? {}) as object,
        outputAnalysis:    (outputAnalysis ?? {}) as object,
        outcome:           "downloaded",
        revisionNotes:     Prisma.JsonNull,
        revisionKeywords:  [],
        revisionCount:     job.revisionCount ?? 0,
        variationSelected: null,
        timeToDownload,
        deviationFromTarget: (deviationFromTarget ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        qualifiesForLearning: inputQualityScore >= 0.6 && (job.revisionCount ?? 0) <= 1,
        learningWeight:    inputQualityScore,
        isHoldout,
      },
    });

    // If qualifies for learning, recompute that genre's target so the next
    // mix benefits from this confirmed-good outcome.
    if (job.genre && inputQualityScore >= 0.6) {
      await recomputeGenreTarget(job.genre).catch(err =>
        console.error(`[log-outcome] recompute failed for ${job.genre}:`, err),
      );
    }
  } catch (err) {
    console.error(`[logDownloadOutcome] failed for job ${opts.jobId}:`, err);
  }
}

/**
 * Log a revision request as a negative outcome.
 * Called from the mix revise route.
 */
export async function logRevisionOutcome(opts: {
  jobId:    string;
  feedback: string;
}): Promise<void> {
  try {
    const job = await prisma.mixJob.findUnique({
      where: { id: opts.jobId },
      select: {
        id:              true,
        genre:           true,
        tier:            true,
        analysisData:    true,
        mixParameters:   true,
        qaCheckResults:  true,
        revisionCount:   true,
      },
    });
    if (!job) return;

    const keywords = extractRevisionKeywords(opts.feedback);
    const inputQualityScore   = computeInputQualityScore(job.analysisData);
    const outputAnalysis      = pickPolishedQa(job.qaCheckResults);
    const deviationFromTarget = await computeDeviation(job.genre ?? "", outputAnalysis);
    const isHoldout = hashToBucket(job.id, 10) === 0;

    // Upsert: if there's already a "downloaded" log, replace with "revised"
    const existing = await prisma.mixOutcomeFeedback.findFirst({
      where: { mixJobId: job.id },
    });

    if (existing) {
      await prisma.mixOutcomeFeedback.update({
        where: { id: existing.id },
        data: {
          outcome:           "revised",
          revisionNotes:     opts.feedback as unknown as object,
          revisionKeywords:  keywords,
          revisionCount:     (job.revisionCount ?? 0) + 1,
          outputAnalysis:    (outputAnalysis ?? {}) as object,
          deviationFromTarget: (deviationFromTarget ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          // A revised mix is a learning-quality signal regardless of input quality
          // (we now know what was wrong, even if input was bad)
          qualifiesForLearning: inputQualityScore >= 0.6,
          learningWeight:    inputQualityScore,
        },
      });
    } else {
      await prisma.mixOutcomeFeedback.create({
        data: {
          mixJobId:          job.id,
          genre:             job.genre ?? "unknown",
          tier:              job.tier ?? "STANDARD",
          inputQualityScore,
          mixParamsUsed:     (job.mixParameters ?? {}) as object,
          outputAnalysis:    (outputAnalysis ?? {}) as object,
          outcome:           "revised",
          revisionNotes:     opts.feedback as unknown as object,
          revisionKeywords:  keywords,
          revisionCount:     (job.revisionCount ?? 0) + 1,
          variationSelected: null,
          timeToDownload:    null,
          deviationFromTarget: (deviationFromTarget ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          qualifiesForLearning: inputQualityScore >= 0.6,
          learningWeight:    inputQualityScore,
          isHoldout,
        },
      });
    }
  } catch (err) {
    console.error(`[logRevisionOutcome] failed for job ${opts.jobId}:`, err);
  }
}

/**
 * Cheap input-quality heuristic from analysisData:
 * 1.0 = pristine (low room reverb, in-tune vocal, clean stems)
 * 0.0 = unusable (heavy bleed, severe pitch drift)
 *
 * Used as the gating signal for "qualifiesForLearning".
 */
function computeInputQualityScore(analysisData: unknown): number {
  if (!analysisData || typeof analysisData !== "object") return 0.5;
  const a = analysisData as Record<string, unknown>;

  let score = 1.0;
  const rt60 = Number(a.room_reverb ?? 0);
  if (rt60 > 0.5)      score -= 0.4;
  else if (rt60 > 0.3) score -= 0.2;
  else if (rt60 > 0.2) score -= 0.1;

  const pitchDev = Number(a.pitch_deviation ?? 0);
  if (pitchDev > 0.6)      score -= 0.3;
  else if (pitchDev > 0.4) score -= 0.15;
  else if (pitchDev > 0.3) score -= 0.05;

  return Math.max(0, Math.min(1, score));
}

/**
 * Pick the "polished" variation's QA block as the canonical mix output.
 * The polished variant is what 90% of artists ship — so it's the most
 * representative of what they heard before downloading.
 *
 * Falls back to clean → aggressive → first-key if polished is missing.
 */
function pickPolishedQa(qaCheckResults: unknown): Record<string, unknown> | null {
  if (!qaCheckResults || typeof qaCheckResults !== "object") return null;
  const qa = qaCheckResults as Record<string, unknown>;
  for (const k of ["polished", "clean", "aggressive"]) {
    const v = qa[k];
    if (v && typeof v === "object") return v as Record<string, unknown>;
  }
  // No named variation — return the first object value
  for (const v of Object.values(qa)) {
    if (v && typeof v === "object") return v as Record<string, unknown>;
  }
  return null;
}

/**
 * Compute per-param deviation between the rendered mix and the GenreTarget.
 * Returns { param: { value, target_mean, target_std, z_score } } where
 * z_score > 2 means the mix is meaningfully outside the genre's typical range.
 *
 * Returns null if no genre target exists or output analysis is missing.
 */
async function computeDeviation(
  genre:  string,
  output: Record<string, unknown> | null,
): Promise<Record<string, { value: number; target_mean: number; target_std: number; z: number }> | null> {
  if (!genre || !output) return null;

  const target = await prisma.genreTarget.findUnique({ where: { genre } }).catch(() => null);
  if (!target || target.trackCount === 0) return null;

  const td = (target.targetData ?? {}) as Record<string, { mean?: number; std?: number }>;
  const balance = (output.frequency_balance ?? {}) as Record<string, number>;

  // Map output fields → param keys used by the aggregator
  const measured: Record<string, number | undefined> = {
    mix_lufs:           num(output.lufs),
    mix_true_peak:      num(output.true_peak ?? output.peakDb),
    mix_loudness_range: num(output.loudness_range),
    mix_dynamic_range:  num(output.dynamic_range),
    mix_stereo_width:   num(output.stereo_width),
    fb_sub:             num(balance.sub),
    fb_low:             num(balance.low),
    fb_low_mid:         num(balance.low_mid),
    fb_mid:             num(balance.mid),
    fb_high_mid:        num(balance.high_mid),
    fb_air:             num(balance.air),
  };

  const out: Record<string, { value: number; target_mean: number; target_std: number; z: number }> = {};
  for (const [key, value] of Object.entries(measured)) {
    if (typeof value !== "number") continue;
    const t = td[key];
    if (!t || typeof t.mean !== "number") continue;
    const std = typeof t.std === "number" && t.std > 0 ? t.std : 1.0;
    const z   = (value - t.mean) / std;
    out[key]  = {
      value:       round(value, 4),
      target_mean: round(t.mean, 4),
      target_std:  round(std, 4),
      z:           round(z, 3),
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}
function round(n: number, p: number): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

/** Deterministic 0..N-1 bucket from a string id. */
function hashToBucket(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % n;
}
