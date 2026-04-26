/**
 * Reference Analysis & Learning Engine
 *
 * Thin TypeScript wrapper around the Cog `analyze-reference` action.
 * Used by:
 *   - admin batch processing (commercial library uploads)
 *   - mix wizard reference track uploads (Premium/Pro)
 *
 * Calls fal.ai/demucs to separate the input first, then hands the stem URLs
 * + full mix to the Cog action so the Cog image stays lean.
 */

import Replicate from "replicate";
import { separateBeatStems, type SeparatedStems } from "@/lib/mix-console/engine";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

const MIX_VERSION         = process.env.REPLICATE_MIX_MODEL_VERSION ?? "";
const SUPABASE_URL        = process.env.SUPABASE_URL                ?? "";
const SUPABASE_SERVICE_KEY= process.env.SUPABASE_SERVICE_KEY        ?? "";

export type SourceQuality =
  | "lossless" | "apple_music" | "tidal" | "amazon_hd" | "deezer"
  | "spotify" | "youtube" | "soundcloud" | "other";

export const SOURCE_WEIGHTS: Record<SourceQuality, number> = {
  lossless:    1.0,
  apple_music: 1.0,
  tidal:       1.0,
  amazon_hd:   1.0,
  deezer:      1.0,
  spotify:     0.9,
  youtube:     0.6,
  soundcloud:  0.5,
  other:       0.6,
};

export interface ReferenceProfileData {
  genre:                 string;
  source:                "commercial" | "user_reference" | "user_mix_outcome";
  source_quality:        SourceQuality;
  source_quality_weight: number;
  separation_confidence: number;
  separation_weight:     number;
  fingerprint_hash:      string | null;
  mix: {
    lufs:               number;
    true_peak:          number;
    loudness_range:     number;
    dynamic_range:      number;
    stereo_width:       number;
    rt60_estimate:      number;
    frequency_balance:  Record<string, number>;
  };
  stems: Record<string, {
    lufs:              number;
    peak_db:           number;
    rms_db:            number;
    crest_factor:      number;
    spectral_centroid: number;
    spectral_rolloff:  number;
    stereo_width:      number;
    frequency_balance: Record<string, number>;
  }>;
  relationships: Record<string, number | null>;
  sections:      Record<string, {
    start_time:        number;
    end_time:          number;
    lufs:              number;
    stereo_width:      number;
    frequency_balance: Record<string, number>;
  }>;
}

/**
 * Analyze a reference track end-to-end.
 *
 * 1. fal.ai/demucs separates vocals/drums/bass/other.
 * 2. Cog `analyze-reference` analyzes full mix + stems + relationships +
 *    sections + bleed/separation confidence.
 *
 * Audio is NOT stored — caller persists profile JSON only.
 */
export async function analyzeReferenceTrack(opts: {
  audioUrl:       string;
  genre:          string;
  sourceQuality?: SourceQuality;
  /** Optional pre-separated stems. If absent we call fal-ai/demucs. */
  stems?:         SeparatedStems;
}): Promise<ReferenceProfileData> {
  if (!MIX_VERSION) throw new Error("REPLICATE_MIX_MODEL_VERSION not set");

  const stems: SeparatedStems = opts.stems ?? await separateBeatStems(opts.audioUrl);

  const replicateInput = {
    action:               "analyze-reference",
    audio_url:            opts.audioUrl,
    stems_json:           JSON.stringify({
      vocals: stems.vocals,
      drums:  stems.drums,
      bass:   stems.bass,
      other:  stems.other,
    }),
    genre:                opts.genre,
    input_balance:        JSON.stringify({ source_quality: opts.sourceQuality ?? "other" }),
    supabase_url:         SUPABASE_URL,
    supabase_service_key: SUPABASE_SERVICE_KEY,
  };

  const prediction = await replicate.predictions.create({
    version: MIX_VERSION,
    input:   replicateInput,
  });
  const result = await replicate.wait(prediction);
  if (result.status === "failed") {
    throw new Error(`analyze-reference failed: ${result.error ?? "unknown"}`);
  }
  const raw = result.output as string;
  return JSON.parse(raw) as ReferenceProfileData;
}
