/**
 * engine.ts — Replicate Cog mastering engine client
 *
 * Thin TypeScript wrapper around the Python DSP engine deployed on Replicate.
 * All heavy audio processing runs in Python (Pedalboard, Matchering, librosa,
 * pyloudnorm, Demucs). This file handles serialization, error propagation,
 * and type safety only — zero DSP logic lives here.
 *
 * Model: r8.im/iambluekb/indiethis-master-engine
 * Env:   REPLICATE_API_TOKEN, REPLICATE_MASTERING_MODEL_VERSION
 */

import Replicate from "replicate";
import { fal }    from "@fal-ai/client";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
const MASTERING_VERSION  = process.env.REPLICATE_MASTERING_MODEL_VERSION ?? "";
const SUPABASE_URL       = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type StemType = "vocals" | "bass" | "drums" | "guitar" | "keys" | "fx" | "pad" | "other";

export interface StemAnalysis {
  lufs:              number;
  peak:              number;
  rms:               number;
  spectralCentroid:  number;
  frequencyBalance:  FrequencyBand[];
  dynamicRange:      number;
}

export interface FrequencyBand {
  band:     "sub" | "low" | "lowmid" | "mid" | "highmid" | "high" | "air";
  hzLow:    number;
  hzHigh:   number;
  energy:   number; // relative energy 0–1
}

export interface AudioAnalysis {
  bpm:           number;
  key:           string;              // e.g. "F#m"
  lufs:          number;
  truePeak:      number;
  dynamicRange:  number;
  stereoWidth:   number;
  spectralCentroid: number;
  frequencyBalance: FrequencyBand[];
  sections:      DetectedSection[];
  durationSec:   number;
}

export interface DetectedSection {
  label:    string;
  startSec: number;
  endSec:   number;
  type:     "intro" | "verse" | "prechorus" | "chorus" | "bridge" | "outro" | "drop";
  energy:   number; // 0–1, used to find chorus for preview
}

export interface SeparatedStems {
  vocals: string;
  bass:   string;
  drums:  string;
  other:  string;
}

export interface ClassifiedStem {
  url:           string;
  detectedType:  StemType;
  confidence:    number;
  analysis:      StemAnalysis;
}

export interface StemProcessingChain {
  stemUrl:      string;
  stemType:     StemType;
  highpass?:    number;
  lowpass?:     number;
  eq?:          EQBand[];
  compression?: CompressorParams;
  saturation?:  number;
  reverb?:      ReverbParams;
  delay?:       DelayParams;
  chorus?:      ChorusParams;
  gain?:        number;
  pan?:         number;               // -1 (L) to 1 (R)
  monoBelow?:   number;               // Hz — mono bass below this freq
  noiseGate?:   NoiseGateParams;
}

export interface EQBand {
  type:   "boost" | "cut" | "highshelf" | "lowshelf" | "presence" | "air" | "warmth";
  freq:   number;
  gain:   number;
  q?:     number;
}

export interface CompressorParams {
  threshold: number; // dB
  ratio:     number;
  attack:    number; // ms
  release:   number; // ms
  knee?:     number;
  makeupGain?: number;
}

export interface ReverbParams {
  roomSize: number; // 0–1
  mix:      number; // 0–1
  damping:  number; // 0–1
  predelay?: number; // ms
}

export interface DelayParams {
  time:     number;    // seconds
  feedback: number;    // 0–1
  mix:      number;    // 0–1
}

export interface ChorusParams {
  rate:  number;
  depth: number;
  mix:   number;
}

export interface NoiseGateParams {
  threshold: number; // dB
  release:   number; // ms
}

export interface MixParams {
  stems:        StemProcessingChain[];
  sections:     DetectedSection[];
  bpm:          number;
  referenceUrl?: string;
}

export interface MasterVersion {
  name:         "Clean" | "Warm" | "Punch" | "Loud";
  targetLufs:   number;
}

export interface MultibandBand {
  low:        number;
  high:       number;
  threshold:  number;
  ratio:      number;
  attack:     number;
  release:    number;
  makeupGain: number;
}

export interface MasterParams {
  audioUrl:     string;
  eq?:          EQBand[];
  multibandCompression?: MultibandBand[];
  stereoWidth?: number;
  monoBelow?:   number;
  saturation?:  number;
  limiterThreshold?: number;
  limiterRelease?:   number;
  versions:     MasterVersion[];
  referenceUrl?: string;
  platforms:    string[];
}

export interface MasterVersionResult {
  name:         "Clean" | "Warm" | "Punch" | "Loud";
  lufs:         number;
  truePeak:     number;
  url:          string;
  waveformData: number[];  // downsampled peak array for WaveSurfer
}

export interface PlatformExport {
  platform: string;
  lufs:     number;
  format:   string;
  url:      string;
}

export interface MasterReport {
  finalLufs:         number;
  truePeak:          number;
  dynamicRange:      number;
  loudnessPenalties: LoudnessPenalty[];
}

export interface LoudnessPenalty {
  platform: string;
  penalty:  number; // dB of volume reduction applied by platform
}

export interface MixResult {
  mixdownUrl:            string;
  perStemProcessedUrls:  { stemUrl: string; processedUrl: string }[];
}

export interface MasterResult {
  versions: MasterVersionResult[];
  exports:  PlatformExport[];
  report:   MasterReport;
}

export interface PreviewResult {
  previewUrl:  string;
  startSec:    number;
  endSec:      number;
}

// ─── Replicate engine helper ──────────────────────────────────────────────────

/**
 * Call the Replicate mastering model with a given action and string inputs.
 * All inputs are serialized as JSON strings — the Cog model accepts only strings.
 * The model returns a JSON string which we parse back into T.
 */
async function callMasteringEngine<T>(
  action: string,
  inputs: Record<string, string> = {},
): Promise<T> {
  if (!MASTERING_VERSION) {
    throw new Error(
      "REPLICATE_MASTERING_MODEL_VERSION is not set. " +
      "Deploy the Cog model first and set the env var.",
    );
  }

  const prediction = await replicate.predictions.create({
    version: MASTERING_VERSION,
    input:   {
      action,
      ...inputs,
      supabase_url:         SUPABASE_URL,
      supabase_service_key: SUPABASE_SERVICE_KEY,
    },
  });

  // 90s timeout per action — prevents Vercel function hanging past maxDuration
  const result = await replicate.wait(prediction, { interval: 2000, maxAttempts: 45 });

  if (result.status === "failed") {
    throw new Error(`Mastering engine action="${action}" failed: ${result.error ?? "unknown"}`);
  }

  // The Cog predict() returns a JSON string via cog.Path or plain string output
  const raw = result.output as string;
  return JSON.parse(raw) as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────
//
// jobId is threaded through to the Cog model so it can use it as the Supabase
// storage path prefix (mastering/{jobId}/...).  Pass the Prisma MasteringJob.id
// wherever it is available in scope.

/**
 * Analyze an audio file — returns BPM, key, LUFS, sections, frequency balance.
 * Used for both stem files and stereo mixes.
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  return callMasteringEngine<AudioAnalysis>("analyze", { audio_url: audioUrl });
}

/**
 * Separate a stereo mix into vocal / bass / drums / other stems.
 * Routes to fal.ai (fal-ai/demucs) — keeps torch/demucs out of the
 * Cog image so the Replicate push stays under the size limit.
 */
export async function separateStems(audioUrl: string, jobId = ""): Promise<SeparatedStems> {
  const result = await fal.subscribe("fal-ai/demucs", {
    input: {
      audio_url: audioUrl,
      stems: ["vocals", "drums", "bass", "other"],
    },
  }) as any;

  // fal-ai/demucs returns stems nested under a `stems` key or at root level.
  // Each stem may be a URL string or an object with a `.url` property.
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

/**
 * Classify uploaded stems by type (vocals, bass, drums, etc.)
 * and analyze each for frequency content, dynamics, LUFS.
 *
 * Accepts an array of URLs; the Cog model handles both list and dict formats.
 */
export async function classifyStems(stemUrls: string[]): Promise<ClassifiedStem[]> {
  return callMasteringEngine<ClassifiedStem[]>("classify-stems", {
    stems_json: JSON.stringify(stemUrls),
  });
}

/**
 * Mix stems down to stereo using Claude's per-stem processing chains.
 *
 * stems_json: dict of stemType → url built from params.stems[].stemUrl/stemType
 * mix_params_json: full MixParams (chains, sections, bpm)
 */
export async function mixStems(params: MixParams, jobId = ""): Promise<MixResult> {
  // Build name→url dict so the Cog can download each stem
  const stemsDict: Record<string, string> = {};
  for (const chain of params.stems) {
    stemsDict[chain.stemType] = chain.stemUrl;
  }
  return callMasteringEngine<MixResult>("mix", {
    stems_json:      JSON.stringify(stemsDict),
    mix_params_json: JSON.stringify(params),
    job_id:          jobId,
  });
}

/**
 * Master a stereo mix — generates 4 named versions (Clean, Warm, Punch, Loud)
 * and platform-specific exports.
 */
export async function masterAudio(params: MasterParams, jobId = ""): Promise<MasterResult> {
  return callMasteringEngine<MasterResult>("master", {
    audio_url:          params.audioUrl,
    reference_url:      params.referenceUrl ?? "",
    master_params_json: JSON.stringify(params),
    job_id:             jobId,
  });
}

/**
 * Generate a free 30-second preview of the mix or master.
 * Targets the highest-energy section (typically the chorus).
 * Always free — even for guests.
 */
export async function generatePreview(
  params: MixParams | MasterParams,
  mode: "mix" | "master",
  jobId = "",
): Promise<PreviewResult> {
  const audioUrl = (params as MasterParams).audioUrl ?? "";
  return callMasteringEngine<PreviewResult>("preview", {
    audio_url: audioUrl,
    job_id:    jobId,
  });
}

/**
 * Health check — verify the engine is reachable / env is configured.
 * On Replicate there is no persistent "ping" — we do a lightweight health action.
 */
export async function pingEngine(): Promise<{ ok: boolean; version?: string }> {
  try {
    const result = await callMasteringEngine<{ ok: boolean; version?: string }>("health");
    return result;
  } catch {
    return { ok: false };
  }
}
