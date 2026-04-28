/**
 * summarizeDiff — pure helper that compares two studio states (and optional
 * before/after analysis blobs) and produces a flat list of plain-English
 * change bullets for the RenderDiffCard (step 27).
 *
 * The card renders these as bullet points. Each string is one change; no
 * leading bullet character — that's a CSS concern.
 */
import type { MasterState, StemRole, StemState, StudioState } from "./types";

export interface DiffAnalysis {
  /** Integrated loudness, dB LUFS. */
  lufs?: number;
  /** Frequency balance buckets — keys we care about. */
  balance?: { sub?: number; low?: number; mid?: number; high?: number };
}

export interface SummarizeDiffInput {
  before:         Pick<StudioState, "global" | "master">;
  after:          Pick<StudioState, "global" | "master">;
  beforeAnalysis?: DiffAnalysis | null;
  afterAnalysis?:  DiffAnalysis | null;
  /** Pretty-name lookup for stem roles (e.g. "vocal_main" → "Vocal Main"). */
  labelForRole?:  (role: StemRole) => string;
}

const GAIN_DB_THRESHOLD     = 0.5;   // dB — below this, gain change is noise
const KNOB_DELTA_THRESHOLD  = 5;     // 0..100 knob units
const PAN_DELTA_THRESHOLD   = 0.05;  // -1..+1
const WIDTH_DELTA_THRESHOLD = 5;     // %
const EQ_DELTA_THRESHOLD    = 0.5;   // dB
const LUFS_DELTA_THRESHOLD  = 0.2;   // dB LUFS

const EQ_BAND_NAMES = ["sub", "low", "mid", "high-mid", "air"];

function fmtDb(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}dB`;
}
function fmtKnobDelta(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${Math.round(v)}`;
}

export function summarizeDiff(input: SummarizeDiffInput): string[] {
  const { before, after, beforeAnalysis, afterAnalysis } = input;
  const labelOf = input.labelForRole ?? ((r) => r);
  const out: string[] = [];

  // Per-stem deltas
  const roles = Array.from(new Set([
    ...Object.keys(before.global ?? {}),
    ...Object.keys(after.global  ?? {}),
  ]));

  for (const role of roles) {
    const b = before.global?.[role];
    const a = after.global?.[role];
    if (!b || !a) continue;
    const name = labelOf(role);

    if (Math.abs((a.gainDb ?? 0) - (b.gainDb ?? 0)) >= GAIN_DB_THRESHOLD) {
      out.push(`${name} gain ${fmtDb(a.gainDb - b.gainDb)}`);
    }
    if (Math.abs((a.pan ?? 0) - (b.pan ?? 0)) >= PAN_DELTA_THRESHOLD) {
      const dir = a.pan > b.pan ? "right" : "left";
      out.push(`${name} pan moved ${dir} (${b.pan.toFixed(2)} → ${a.pan.toFixed(2)})`);
    }
    if (Math.abs((a.reverb ?? 0) - (b.reverb ?? 0)) >= KNOB_DELTA_THRESHOLD) {
      out.push(`${name} reverb ${b.reverb}% → ${a.reverb}% (${fmtKnobDelta(a.reverb - b.reverb)})`);
    }
    if (Math.abs((a.delay ?? 0) - (b.delay ?? 0)) >= KNOB_DELTA_THRESHOLD) {
      out.push(`${name} delay ${b.delay}% → ${a.delay}% (${fmtKnobDelta(a.delay - b.delay)})`);
    }
    if (Math.abs((a.comp ?? 0) - (b.comp ?? 0)) >= KNOB_DELTA_THRESHOLD) {
      out.push(`${name} compression ${b.comp}% → ${a.comp}%`);
    }
    if (Math.abs((a.brightness ?? 50) - (b.brightness ?? 50)) >= KNOB_DELTA_THRESHOLD) {
      const dir = a.brightness > b.brightness ? "brighter" : "darker";
      out.push(`${name} ${dir} (brightness ${b.brightness} → ${a.brightness})`);
    }
    if (a.muted !== b.muted) {
      out.push(`${name} ${a.muted ? "muted" : "unmuted"}`);
    }
    if (a.soloed !== b.soloed) {
      out.push(`${name} ${a.soloed ? "soloed" : "unsoloed"}`);
    }
  }

  // Master deltas
  const mb = before.master;
  const ma = after.master;
  if (mb && ma) {
    if (Math.abs(ma.volumeDb - mb.volumeDb) >= GAIN_DB_THRESHOLD) {
      out.push(`Master volume ${fmtDb(ma.volumeDb - mb.volumeDb)}`);
    }
    if (Math.abs(ma.stereoWidth - mb.stereoWidth) >= WIDTH_DELTA_THRESHOLD) {
      out.push(`Master stereo width ${mb.stereoWidth}% → ${ma.stereoWidth}%`);
    }
    if (Math.abs(ma.aiIntensity - mb.aiIntensity) >= KNOB_DELTA_THRESHOLD) {
      out.push(`AI intensity ${mb.aiIntensity}% → ${ma.aiIntensity}%`);
    }
    for (let i = 0; i < 5; i++) {
      const delta = (ma.eq[i] ?? 0) - (mb.eq[i] ?? 0);
      if (Math.abs(delta) >= EQ_DELTA_THRESHOLD) {
        out.push(`Master EQ ${EQ_BAND_NAMES[i]} ${fmtDb(delta)}`);
      }
    }
  }

  // Analysis-derived deltas (LUFS + frequency balance)
  if (beforeAnalysis && afterAnalysis) {
    if (
      typeof beforeAnalysis.lufs === "number" &&
      typeof afterAnalysis.lufs  === "number"
    ) {
      const d = afterAnalysis.lufs - beforeAnalysis.lufs;
      if (Math.abs(d) >= LUFS_DELTA_THRESHOLD) {
        out.push(`LUFS: ${beforeAnalysis.lufs.toFixed(1)} → ${afterAnalysis.lufs.toFixed(1)}`);
      }
    }
    const bb = beforeAnalysis.balance ?? {};
    const ab = afterAnalysis.balance  ?? {};
    for (const k of ["sub", "low", "mid", "high"] as const) {
      const v0 = bb[k];
      const v1 = ab[k];
      if (typeof v0 === "number" && typeof v1 === "number") {
        const delta = v1 - v0;
        if (Math.abs(delta) >= 1) {
          const dir = delta > 0 ? "boosted" : "tamed";
          out.push(`${k.charAt(0).toUpperCase() + k.slice(1)} band ${dir} (${delta > 0 ? "+" : ""}${delta.toFixed(1)}dB)`);
        }
      }
    }
  }

  if (out.length === 0) {
    out.push("No significant changes from the AI Original mix.");
  }

  return out;
}

/** Helper to coerce job.analysisData JSON into the loose DiffAnalysis shape. */
export function coerceAnalysis(raw: unknown): DiffAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: DiffAnalysis = {};
  if (typeof r.lufs === "number") out.lufs = r.lufs;
  const bal = r.balance ?? r.frequencyBalance;
  if (bal && typeof bal === "object") {
    const b = bal as Record<string, unknown>;
    out.balance = {
      sub:  typeof b.sub  === "number" ? b.sub  : undefined,
      low:  typeof b.low  === "number" ? b.low  : undefined,
      mid:  typeof b.mid  === "number" ? b.mid  : undefined,
      high: typeof b.high === "number" ? b.high : undefined,
    };
  }
  return out;
}

// Avoid unused-export tree-shake warnings for MasterState/StemState in some
// configs (these types are referenced via Pick<StudioState>).
export type { MasterState, StemState };
