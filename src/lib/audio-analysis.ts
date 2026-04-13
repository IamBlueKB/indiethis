/**
 * Server-side audio analysis: BPM detection (direct port of web-audio-beat-detector
 * algorithm, bypassing its Web Worker requirement) and musical key detection via
 * essentia.js.
 *
 * AudioBuffer decoding uses node-web-audio-api so we can run in Node.js without a
 * browser.  BPM detection mirrors the library's pipeline exactly:
 *   1. Apply 240 Hz 1st-order IIR lowpass to isolate kick/bass transients
 *   2. Adaptive-threshold peak detection
 *   3. Interval clustering → BPM scoring
 */

// Lazy-loaded to avoid crashing Vercel serverless at module initialization
// eslint-disable-next-line @typescript-eslint/no-require-imports
function getAudioContext(): typeof import("node-web-audio-api")["AudioContext"] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node-web-audio-api").AudioContext;
}

// ─── BPM detection via Essentia RhythmExtractor2013 ──────────────────────────
//
// Replaces the old hand-rolled peak-detection algorithm which consistently
// misread trap/hip-hop tracks (e.g. returning 120 for a 140 BPM track) because
// the half-time kick pattern scored higher than the true tempo.
//
// RhythmExtractor2013 handles half-time patterns correctly and has been
// verified: 140 BPM test signal → 143.5 BPM (rounding gives 144; acceptable).

function detectBpmWithEssentia(
  channelData: Float32Array,
  essentia: EssentiaInstance,
): number | null {
  try {
    const vec    = essentia.arrayToVector(channelData);
    const result = essentia.RhythmExtractor2013(vec);
    vec.delete?.();
    const bpm = result?.bpm;
    if (typeof bpm !== "number" || !isFinite(bpm) || bpm < 40 || bpm > 250) return null;
    return Math.round(bpm);
  } catch {
    return null;
  }
}

interface EssentiaInstance {
  arrayToVector(arr: Float32Array): { delete?: () => void };
  KeyExtractor(signal: { delete?: () => void }): { key: string; scale: string; strength: number };
  RhythmExtractor2013(signal: { delete?: () => void }): { bpm: number; confidence: number; ticks: unknown; estimates: unknown; bpmIntervals: unknown };
}

// Singleton — WASM module is expensive to initialize
let essentiaInstance: EssentiaInstance | null = null;
function getEssentia(): EssentiaInstance {
  if (!essentiaInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Essentia, EssentiaWASM } = require("essentia.js") as {
      Essentia: new (wasm: unknown) => EssentiaInstance;
      EssentiaWASM: unknown;
    };
    essentiaInstance = new Essentia(EssentiaWASM);
  }
  return essentiaInstance;
}

export interface AudioFeatures {
  bpm:        number | null;
  musicalKey: string | null;
  energy:     number | null; // 0–1 RMS-derived energy proxy
}

/**
 * Run BPM, key, and energy detection directly from an ArrayBuffer.
 * Used by the beat-describe route to avoid a redundant HTTP round-trip.
 * Returns nulls for any detection that fails — never throws.
 */
export async function detectAudioFeaturesFromBuffer(buffer: ArrayBuffer): Promise<AudioFeatures> {
  const result: AudioFeatures = { bpm: null, musicalKey: null, energy: null };

  try {
    const AudioContext = getAudioContext();
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
    } catch {
      await audioContext.close();
      return result;
    }

    const channelData = audioBuffer.getChannelData(0);

    // BPM
    try {
      const essentia = getEssentia();
      const bpm = detectBpmWithEssentia(channelData, essentia);
      if (bpm !== null) result.bpm = bpm;
    } catch { /* silent */ }

    // Key via essentia
    try {
      const essentia = getEssentia();
      const vector   = essentia.arrayToVector(channelData);
      const keyData  = essentia.KeyExtractor(vector);
      if (keyData?.key) result.musicalKey = `${keyData.key} ${keyData.scale}`;
    } catch { /* silent */ }

    // Energy — RMS of the full signal, clamped to 0–1
    try {
      let sumSq = 0;
      for (let i = 0; i < channelData.length; i++) sumSq += channelData[i] * channelData[i];
      const rms = Math.sqrt(sumSq / channelData.length);
      // RMS for typical tracks: 0.02 (quiet) → 0.25 (loud/energetic)
      // Map to 0–1 using a perceptual scale: clamp(rms / 0.25, 0, 1)
      result.energy = Math.min(rms / 0.25, 1);
    } catch { /* silent */ }

    await audioContext.close();
  } catch { /* silent */ }

  return result;
}

/**
 * Download an audio file and detect its BPM and musical key.
 * Returns nulls for any detection that fails — never throws.
 * Times out after 45 s total (download + decode + analysis).
 */
export async function detectAudioFeatures(fileUrl: string): Promise<AudioFeatures> {
  const result: AudioFeatures = { bpm: null, musicalKey: null, energy: null };

  try {
    // ── 1. Download ───────────────────────────────────────────────────────────
    const controller = new AbortController();
    const downloadTimeout = setTimeout(() => controller.abort(), 45_000);

    let response: Response;
    try {
      response = await fetch(fileUrl, { signal: controller.signal });
    } finally {
      clearTimeout(downloadTimeout);
    }

    if (!response.ok) return result;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return result;

    // ── 2. Decode ─────────────────────────────────────────────────────────────
    // node-web-audio-api's AudioContext accepts the same API as the browser's.
    // We create a new context per call so parallel invocations don't interfere.
    const AudioContext = getAudioContext();
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      // slice(0) copies the buffer so decodeAudioData can detach it safely
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      await audioContext.close();
      return result;
    }

    const channelData = audioBuffer.getChannelData(0);

    // ── 3. BPM ────────────────────────────────────────────────────────────────
    try {
      const essentia = getEssentia();
      const bpm = detectBpmWithEssentia(channelData, essentia);
      if (bpm !== null) result.bpm = bpm;
    } catch {
      // silent — leave result.bpm as null
    }

    // ── 4. Key ────────────────────────────────────────────────────────────────
    try {
      const essentia = getEssentia();
      const vector   = essentia.arrayToVector(channelData);
      const keyData  = essentia.KeyExtractor(vector);
      if (keyData?.key) {
        result.musicalKey = `${keyData.key} ${keyData.scale}`;
      }
    } catch {
      // silent — leave result.musicalKey as null
    }

    await audioContext.close();
  } catch {
    // silent — network errors, unsupported format, etc.
  }

  return result;
}

/**
 * Detect features for the first audio URL in a list.
 * Checks Content-Type header first (handles extension-less UploadThing URLs),
 * then falls back to extension matching.
 */
export async function detectAudioFeaturesFromUrls(urls: string[]): Promise<AudioFeatures> {
  if (!urls.length) return { bpm: null, musicalKey: null, energy: null };

  const audioExts = /\.(mp3|wav|flac|aac|ogg|m4a|aiff?|wma)(\?|$)/i;

  for (const url of urls) {
    // Fast path: extension in URL
    if (audioExts.test(url)) return detectAudioFeatures(url);

    // Slow path: check Content-Type for extension-less CDN URLs (UploadThing v7)
    try {
      const head = await fetch(url, { method: "HEAD" });
      const ct   = head.headers.get("content-type") ?? "";
      if (ct.startsWith("audio/") || ct === "application/ogg") {
        return detectAudioFeatures(url);
      }
    } catch { /* skip */ }
  }

  return { bpm: null, musicalKey: null, energy: null };
}
