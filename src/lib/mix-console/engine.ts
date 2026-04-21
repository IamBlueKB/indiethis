/**
 * engine.ts — AI Mix Console Replicate engine client
 *
 * Thin TypeScript wrapper around the Python DSP mix engine deployed on Replicate.
 * Uses a separate model version from mastering (REPLICATE_MIX_MODEL_VERSION).
 * Stem separation still routes to fal-ai/demucs to keep the Cog image lean.
 *
 * Model: r8.im/indiethis/indiethis-dsp (same cog, new version after mix actions added)
 * Env:   REPLICATE_API_TOKEN, REPLICATE_MIX_MODEL_VERSION
 */

import Replicate from "replicate";
import { fal }   from "@fal-ai/client";

const replicate          = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
const MIX_VERSION        = process.env.REPLICATE_MIX_MODEL_VERSION ?? process.env.REPLICATE_MASTERING_MODEL_VERSION ?? "";
const SUPABASE_URL        = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const APP_URL             = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
const WEBHOOK_SECRET      = process.env.REPLICATE_WEBHOOK_SECRET ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MixMode = "VOCAL_BEAT" | "TRACKED_STEMS";
export type MixTier = "STANDARD" | "PREMIUM" | "PRO";
export type MixStatus =
  | "PENDING" | "UPLOADING" | "SEPARATING" | "ANALYZING"
  | "AWAITING_DIRECTION" | "MIXING" | "PREVIEWING"
  | "COMPLETE" | "REVISING" | "FAILED";

export type VocalRole = "lead" | "double" | "adlib" | "backing";

export interface InputFile {
  url:   string;
  label: string;       // user-given label ("vocal", "kick", etc.)
  role?: VocalRole;    // assigned by analysis
}

export interface StemFrequencyBalance {
  sub:  number;
  low:  number;
  mid:  number;
  high: number;
}

export interface StemAnalysisResult {
  label:    string;
  rms:      number;
  lufs:     number;
  balance:  StemFrequencyBalance;
  role?:    VocalRole;
  confidence?: number;
}

export interface SongSection {
  name:  string;  // "intro" | "verse1" | "chorus1" | "bridge" | "outro" etc.
  start: number;  // seconds
  end:   number;  // seconds
}

export interface WordTimestamp {
  word:  string;
  start: number;
  end:   number;
}

export interface DelayThrow {
  word:     string;
  start:    number;
  end:      number;
  type:     "dotted_eighth" | "quarter" | "half";
  feedback: number;   // repeat count (2–5)
  section:  string;
}

export interface MixAnalysisResult {
  bpm:                number;
  key:                string;
  sections:           SongSection[];
  stemAnalysis:       StemAnalysisResult[];
  vocalClassification: Array<{ stemIndex: number; role: VocalRole; confidence: number }>;
  lyrics:             string;
  wordTimestamps:     WordTimestamp[];
  roomReverb:         number;   // RT60 estimate in seconds (> 0.2 = needs de-reverb)
  pitchDeviation:     number;   // avg semitone deviation from key
}

export interface MixOutputResult {
  /** Variation name → file path (stored in Supabase) */
  filePaths:           Record<string, string>;
  /** Variation name → waveform peaks [200 floats, 0-1] for preview */
  waveforms:           Record<string, number[]>;
  /** Original waveform peaks (pre-mix, highest-energy window) */
  originalWaveform:    number[];
  /** Preview file paths (30s clips, per variation + original) */
  previewFilePaths:    Record<string, string>;
  /** Applied mix parameters per stem (for revision context) */
  appliedParameters:   Record<string, unknown>;
}

export interface PreviewMixResult {
  /** Variation → signed URL */
  previewUrls:  Record<string, string>;
  /** Seconds into the track where the preview starts */
  previewStart: number;
}

// ─── Webhook-based action starter ────────────────────────────────────────────

/**
 * Fire a mix-console action on Replicate, returning immediately.
 * Replicate POSTs result to webhookPath when done.
 */
export async function startMixAction(
  action:      string,
  inputs:      Record<string, string>,
  webhookPath: string,
): Promise<string> {
  if (!MIX_VERSION) {
    throw new Error(
      "REPLICATE_MIX_MODEL_VERSION is not set. Deploy the mix Cog model first.",
    );
  }
  const secret     = WEBHOOK_SECRET ? `?secret=${encodeURIComponent(WEBHOOK_SECRET)}` : "";
  const webhookUrl = `${APP_URL}${webhookPath}${secret}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    try {
      const prediction = await replicate.predictions.create({
        version:               MIX_VERSION,
        input: {
          action,
          ...inputs,
          supabase_url:         SUPABASE_URL,
          supabase_service_key: SUPABASE_SERVICE_KEY,
        },
        webhook:               webhookUrl,
        webhook_events_filter: ["completed"],
      });
      return prediction.id;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429")) throw err;
    }
  }
  throw lastError;
}

// ─── Stem separation (fal-ai/demucs) ─────────────────────────────────────────

export interface SeparatedStems {
  vocals: string;
  bass:   string;
  drums:  string;
  other:  string;
}

/**
 * Separate a stereo mix (beat/instrumental) into stems via fal-ai/demucs.
 * Used only in VOCAL_BEAT mode to extract drum/bass/other from the beat.
 */
export async function separateBeatStems(beatUrl: string): Promise<SeparatedStems> {
  const result = await fal.subscribe("fal-ai/demucs", {
    input: {
      audio_url: beatUrl,
      stems: ["vocals", "drums", "bass", "other"],
    },
  }) as any;

  const raw: Record<string, unknown> = result?.stems ?? result ?? {};
  const toUrl = (v: unknown): string =>
    typeof v === "string" ? v : (v as { url?: string })?.url ?? "";

  return {
    vocals: toUrl(raw.vocals),
    bass:   toUrl(raw.bass),
    drums:  toUrl(raw.drums),
    other:  toUrl(raw.other),
  };
}

// ─── Fresh Supabase signed URL ────────────────────────────────────────────────

/**
 * Generate a fresh 1-hour signed URL for a file stored in Supabase processed bucket.
 * Used by the download route to avoid expired URL errors.
 */
export async function generateFreshSignedUrl(filePath: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/processed/${encodeURIComponent(filePath)}`,
      {
        method:  "POST",
        headers: {
          "apikey":        SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { signedURL?: string };
    return data.signedURL ?? null;
  } catch {
    return null;
  }
}
