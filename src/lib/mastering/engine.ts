/**
 * engine.ts — Python DSP engine client
 *
 * Thin TypeScript wrapper around the Python FastAPI engine.
 * All heavy audio processing runs server-side in Python (Pedalboard, Matchering,
 * librosa, pyloudnorm). This file handles serialization, error propagation,
 * and type safety only — zero DSP logic lives here.
 */

const ENGINE_URL = process.env.MASTERING_ENGINE_URL ?? "http://localhost:8000";
const ENGINE_SECRET = process.env.MASTERING_ENGINE_SECRET ?? "";

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

// ─── Engine request helper ─────────────────────────────────────────────────────

async function enginePost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${endpoint}`, {
    method:  "POST",
    headers: {
      "Content-Type":    "application/json",
      "X-Engine-Secret": ENGINE_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Engine ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze an audio file — returns BPM, key, LUFS, sections, frequency balance.
 * Used for both stem files and stereo mixes.
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  return enginePost<AudioAnalysis>("/analyze", { audioUrl });
}

/**
 * Separate a stereo mix into vocal / bass / drums / other stems.
 * Used in Master Only mode before per-stem processing.
 */
export async function separateStems(audioUrl: string): Promise<SeparatedStems> {
  return enginePost<SeparatedStems>("/separate", { audioUrl });
}

/**
 * Classify uploaded stems by type (vocals, bass, drums, etc.)
 * and analyze each for frequency content, dynamics, LUFS.
 */
export async function classifyStems(stemUrls: string[]): Promise<ClassifiedStem[]> {
  return enginePost<ClassifiedStem[]>("/classify-stems", { stemUrls });
}

/**
 * Mix stems down to stereo using Claude's per-stem processing chains.
 */
export async function mixStems(params: MixParams): Promise<MixResult> {
  return enginePost<MixResult>("/mix", params);
}

/**
 * Master a stereo mix — generates 4 named versions (Clean, Warm, Punch, Loud)
 * and platform-specific exports.
 */
export async function masterAudio(params: MasterParams): Promise<MasterResult> {
  return enginePost<MasterResult>("/master", params);
}

/**
 * Generate a free 30-second preview of the mix or master.
 * Targets the highest-energy section (typically the chorus).
 * Always free — even for guests.
 */
export async function generatePreview(
  params: MixParams | MasterParams,
  mode: "mix" | "master"
): Promise<PreviewResult> {
  return enginePost<PreviewResult>("/preview", { ...params, previewOnly: true, mode });
}

/**
 * Health check — verify the engine is reachable before kicking off a job.
 */
export async function pingEngine(): Promise<{ ok: boolean; version?: string }> {
  try {
    const res = await fetch(`${ENGINE_URL}/health`, {
      headers: { "X-Engine-Secret": ENGINE_SECRET },
    });
    if (!res.ok) return { ok: false };
    const data = await res.json() as { version?: string };
    return { ok: true, version: data.version };
  } catch {
    return { ok: false };
  }
}
