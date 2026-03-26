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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AudioContext } = require("node-web-audio-api") as typeof import("node-web-audio-api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Essentia, EssentiaWASM } = require("essentia.js") as {
  Essentia: new (wasm: unknown) => EssentiaInstance;
  EssentiaWASM: unknown;
};

// ── Direct BPM detection (no Web Worker) ─────────────────────────────────────

function lowpass240(data: Float32Array, sampleRate: number): Float32Array {
  const rc    = 1 / (2 * Math.PI * 240);
  const dt    = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out   = new Float32Array(data.length);
  out[0]      = data[0];
  for (let i = 1; i < data.length; i++) {
    out[i] = out[i - 1] + alpha * (data[i] - out[i - 1]);
  }
  return out;
}

function detectBpm(channelData: Float32Array, sampleRate: number): number | null {
  const filtered = lowpass240(channelData, sampleRate);
  const n        = filtered.length;

  // Find max amplitude
  let maxAmp = 0;
  for (let i = 0; i < n; i++) if (filtered[i] > maxAmp) maxAmp = filtered[i];
  if (maxAmp <= 0.25) return null;

  // Adaptive peak detection
  const minThreshold = 0.3 * maxAmp;
  let peaks: number[] = [];
  let threshold = maxAmp * 0.95;
  while (peaks.length < 30 && threshold >= minThreshold) {
    peaks = [];
    let above = false;
    for (let i = 0; i < n; i++) {
      if (filtered[i] > threshold) { above = true; }
      else if (above) {
        above = false;
        peaks.push(i - 1);
        i += Math.floor(sampleRate / 4) - 1; // min gap ~250ms
      }
    }
    if (above) peaks.push(n - 1);
    threshold -= 0.05 * maxAmp;
  }
  if (peaks.length < 2) return null;

  // Cluster intervals → BPM candidates
  const intervals: { interval: number; count: number }[] = [];
  for (let i = 0; i < peaks.length; i++) {
    const maxJ = Math.min(peaks.length - i, 10);
    for (let j = 1; j < maxJ; j++) {
      const interval = peaks[i + j] - peaks[i];
      const existing = intervals.find((x) => x.interval === interval);
      if (existing) existing.count++;
      else intervals.push({ interval, count: 1 });
    }
  }

  const MIN_BPM = 80, MAX_BPM = 200;
  const tempos: { bpm: number; score: number }[] = [];
  for (const { interval, count } of intervals) {
    let tempo = 60 / (interval / sampleRate);
    while (tempo < MIN_BPM) tempo *= 2;
    while (tempo > MAX_BPM) tempo /= 2;
    if (tempo < MIN_BPM || tempo > MAX_BPM) continue;
    const rounded = Math.round(tempo);
    const existing = tempos.find((t) => Math.abs(t.bpm - rounded) <= 1);
    if (existing) existing.score += count;
    else tempos.push({ bpm: rounded, score: count });
  }
  if (tempos.length === 0) return null;
  tempos.sort((a, b) => b.score - a.score);
  return tempos[0].bpm;
}

interface EssentiaInstance {
  arrayToVector(arr: Float32Array): unknown;
  KeyExtractor(signal: unknown): { key: string; scale: string; strength: number };
}

// Singleton — WASM module is expensive to initialize
let essentiaInstance: EssentiaInstance | null = null;
function getEssentia(): EssentiaInstance {
  if (!essentiaInstance) {
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
      const bpm = detectBpm(channelData, audioBuffer.sampleRate);
      if (bpm !== null && isFinite(bpm)) result.bpm = bpm;
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
      const bpm = detectBpm(channelData, audioBuffer.sampleRate);
      if (bpm !== null && isFinite(bpm)) result.bpm = bpm;
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
