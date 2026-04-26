/**
 * Server-side helper that turns a MixJob row into the MixResultsData
 * shape consumed by MixResultsClient.
 *
 * Handles the messy bits in one place:
 *   - reading nested JSON fields (previewFilePaths, mixParameters, qaCheckResults)
 *   - deriving plain-English stem processing summaries from Claude's stemParams
 *   - deriving outputAnalysis from QA + mixParameters fallback
 *   - normalizing waveform JSON to number[]
 */

import type { MixJob } from "@prisma/client";
import type {
  MixResultsData,
  OutputAnalysis,
  StemProcessingItem,
} from "./types";

// ─── Stem processing summaries (plain English) ─────────────────────────────────

interface StemParamsLite {
  comp1?:        { ratio?: number };
  comp2?:        { ratio?: number };
  presenceDb?:   number;
  pan?:          number;
  panL?:         number;
  panR?:         number;
  reverbWet?:    number;
  delayWet?:     number;
  deEss?:        number;
  deReverbStrength?: number;
  pitchShiftCents?: number;
  stereoWidth?:  number;
  monoBelow?:    number;
  notes?:        string;
}

function describePan(sp: StemParamsLite): string | null {
  if (typeof sp.panL === "number" && typeof sp.panR === "number") {
    const l = Math.round(Math.abs(sp.panL) * 100);
    const r = Math.round(Math.abs(sp.panR) * 100);
    if (l > 5 || r > 5) return `panned L${l}/R${r}`;
  }
  if (typeof sp.pan === "number" && Math.abs(sp.pan) > 0.05) {
    const side = sp.pan < 0 ? "L" : "R";
    return `panned ${side}${Math.round(Math.abs(sp.pan) * 100)}`;
  }
  return null;
}

function describeStem(role: string, sp: StemParamsLite | undefined): string {
  if (!sp) return "Light cleanup, level-matched";
  const bits: string[] = [];

  // Compression stages
  const r1 = sp.comp1?.ratio ?? 0;
  const r2 = sp.comp2?.ratio ?? 0;
  if (r1 > 0 && r2 > 0)      bits.push("2-stage comp");
  else if (r1 > 0 || r2 > 0) bits.push("comp");

  // EQ shape
  if (typeof sp.presenceDb === "number" && Math.abs(sp.presenceDb) >= 1.5) {
    const sign = sp.presenceDb > 0 ? "+" : "";
    bits.push(`presence ${sign}${sp.presenceDb.toFixed(1)}dB`);
  }

  // De-ess / de-reverb
  if (typeof sp.deEss === "number" && sp.deEss > 0.1) bits.push("de-essed");
  if (typeof sp.deReverbStrength === "number" && sp.deReverbStrength > 0.1) {
    bits.push("de-reverb");
  }

  // Pan
  const pan = describePan(sp);
  if (pan) bits.push(pan);

  // Stereo width
  if (typeof sp.stereoWidth === "number" && sp.stereoWidth > 0.05) {
    bits.push("widened");
  }

  // Pitch shift (typically doubles)
  if (typeof sp.pitchShiftCents === "number" && Math.abs(sp.pitchShiftCents) >= 5) {
    const sign = sp.pitchShiftCents > 0 ? "+" : "";
    bits.push(`±${Math.round(Math.abs(sp.pitchShiftCents))}¢ pitch`);
  }

  // Effects
  if (typeof sp.reverbWet === "number" && sp.reverbWet > 0.05) bits.push("reverb");
  if (typeof sp.delayWet  === "number" && sp.delayWet  > 0.05) bits.push("delay");

  // Role-specific flavor
  if (role === "ad_libs" && bits.length === 0) bits.push("lo-fi treatment");
  if (role === "harmonies" && !bits.some(b => b.includes("widened"))) {
    bits.push("blended back");
  }

  return bits.length > 0 ? bits.join(", ") : "Cleaned, level-matched";
}

const ROLE_LABELS: Record<string, string> = {
  main_vocal:  "Main vocal",
  ad_libs:     "Ad-libs",
  doubles:     "Doubles",
  harmonies:   "Harmonies",
  ins_outs:    "Ins & Outs",
  beat:        "Beat",
  vocal_lead:  "Main vocal",
  vocals:      "Main vocal",
};

function buildStemProcessingSummary(
  mixParameters: unknown,
  beatPolish:    boolean,
): StemProcessingItem[] {
  if (!mixParameters || typeof mixParameters !== "object") return [];
  const mp = mixParameters as { stemParams?: Record<string, StemParamsLite> };
  const stems = mp.stemParams ?? {};

  const out: StemProcessingItem[] = [];
  const knownOrder = ["main_vocal", "vocal_lead", "vocals", "ad_libs", "doubles", "harmonies", "ins_outs"];
  for (const key of knownOrder) {
    if (stems[key]) {
      out.push({ role: key, description: describeStem(key, stems[key]) });
    }
  }
  // Beat row only when Beat Polish was used
  if (beatPolish && stems.beat) {
    out.push({ role: "beat", description: describeStem("beat", stems.beat) });
  }
  // Pull in any unknown roles we didn't enumerate
  for (const [k, v] of Object.entries(stems)) {
    if (knownOrder.includes(k) || k === "beat") continue;
    out.push({ role: k, description: describeStem(k, v) });
  }

  // Drop dups by role label
  const seen = new Set<string>();
  return out.filter(item => {
    const label = ROLE_LABELS[item.role] ?? item.role;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

// ─── Output analysis ───────────────────────────────────────────────────────────

function extractOutputAnalysis(
  qaCheckResults: unknown,
  mixParameters:  unknown,
): OutputAnalysis | null {
  // Prefer QA gate results — those are measured on the actual rendered mix
  if (qaCheckResults && typeof qaCheckResults === "object") {
    const qa = qaCheckResults as {
      lufs?:          number;
      truePeak?:      number;
      loudnessRange?: number;
      stereoWidth?:   number;
      stereoBalance?: { width?: number };
    };
    if (typeof qa.lufs === "number" || typeof qa.truePeak === "number") {
      return {
        lufs:          qa.lufs ?? -14,
        truePeak:      qa.truePeak ?? -1,
        loudnessRange: qa.loudnessRange ?? 0,
        stereoWidth:   qa.stereoWidth ?? qa.stereoBalance?.width ?? 1,
      };
    }
  }
  // Fallback: targets from mixParameters (busParams.targetLufs etc.)
  if (mixParameters && typeof mixParameters === "object") {
    const mp = mixParameters as { busParams?: { targetLufs?: number } };
    if (typeof mp.busParams?.targetLufs === "number") {
      return {
        lufs:          mp.busParams.targetLufs,
        truePeak:      -1,
        loudnessRange: 0,
        stereoWidth:   1,
      };
    }
  }
  return null;
}

// ─── Input LUFS (for A/B volume matching) ─────────────────────────────────────

function extractInputLufs(analysisData: unknown): number | null {
  if (!analysisData || typeof analysisData !== "object") return null;
  const a = analysisData as { lufs?: number; inputLufs?: number };
  if (typeof a.lufs      === "number") return a.lufs;
  if (typeof a.inputLufs === "number") return a.inputLufs;
  return null;
}

// ─── Recommended version ───────────────────────────────────────────────────────

function extractRecommendedVersion(mixParameters: unknown): string | null {
  if (!mixParameters || typeof mixParameters !== "object") return null;
  const mp = mixParameters as {
    recommendedVersion?: string;
    selectedVersion?:    string;
  };
  return mp.recommendedVersion ?? mp.selectedVersion ?? null;
}

// ─── Track name (best-effort from inputFiles) ─────────────────────────────────

function extractTrackName(inputFiles: unknown): string | null {
  if (!Array.isArray(inputFiles)) return null;
  for (const f of inputFiles) {
    if (f && typeof f === "object") {
      const ff = f as { label?: string; url?: string };
      if (typeof ff.label === "string" && ff.label.length > 0) return ff.label;
      if (typeof ff.url === "string") {
        const tail = ff.url.split("/").pop() ?? "";
        const name = decodeURIComponent(tail.split("?")[0]);
        if (name) return name.replace(/\.[a-z0-9]+$/i, "");
      }
    }
  }
  return null;
}

// ─── Main mapper ───────────────────────────────────────────────────────────────

export function mixJobToResultsData(job: MixJob): MixResultsData {
  const previewFilePaths = (job.previewFilePaths ?? null) as Record<string, string> | null;

  const wfOrig  = Array.isArray(job.previewWaveformOriginal) ? (job.previewWaveformOriginal as unknown as number[]) : [];
  const wfMixed = Array.isArray(job.previewWaveformMixed)
    ? (job.previewWaveformMixed as unknown as number[])
    : (() => {
        const w = job.previewWaveformMixed as unknown;
        if (w && typeof w === "object") {
          const obj = w as Record<string, unknown>;
          for (const k of ["polished", "clean", "mix", "aggressive"]) {
            if (Array.isArray(obj[k])) return obj[k] as number[];
          }
        }
        return [];
      })();

  return {
    id:         job.id,
    mode:       job.mode,
    tier:       job.tier,
    status:     job.status,
    genre:      job.genre ?? null,
    beatPolish: job.beatPolish ?? false,
    trackName:  extractTrackName(job.inputFiles),
    createdAt:  job.createdAt.toISOString(),

    originalPreviewPath:   previewFilePaths?.original   ?? null,
    cleanPreviewPath:      previewFilePaths?.clean      ?? null,
    polishedPreviewPath:   previewFilePaths?.polished   ?? null,
    aggressivePreviewPath: previewFilePaths?.aggressive ?? null,
    mixPreviewPath:        previewFilePaths?.mix        ?? null,

    cleanFilePath:      job.cleanFilePath      ?? null,
    polishedFilePath:   job.polishedFilePath   ?? null,
    aggressiveFilePath: job.aggressiveFilePath ?? null,
    mixFilePath:        job.mixFilePath        ?? null,

    outputAnalysis: extractOutputAnalysis(job.qaCheckResults, job.mixParameters),
    inputLufs:      extractInputLufs(job.analysisData),

    stemProcessingSummary: buildStemProcessingSummary(job.mixParameters, job.beatPolish ?? false),

    referenceFileName: job.referenceFileName ?? null,
    referenceNotes:    job.referenceNotes    ?? null,

    recommendedVersion: extractRecommendedVersion(job.mixParameters),

    revisionCount: job.revisionCount,
    maxRevisions:  job.maxRevisions,

    previewWaveformOriginal: wfOrig,
    previewWaveformMixed:    wfMixed,
  };
}
