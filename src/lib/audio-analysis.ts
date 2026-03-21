/**
 * Server-side audio analysis: BPM detection via web-audio-beat-detector
 * and musical key detection via essentia.js.
 *
 * Both libraries need an AudioBuffer. We use node-web-audio-api to decode
 * the audio file in Node.js without a browser.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AudioContext } = require("node-web-audio-api") as typeof import("node-web-audio-api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { guess } = require("web-audio-beat-detector") as typeof import("web-audio-beat-detector");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Essentia, EssentiaWASM } = require("essentia.js") as {
  Essentia: new (wasm: unknown) => EssentiaInstance;
  EssentiaWASM: unknown;
};

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
}

/**
 * Download an audio file and detect its BPM and musical key.
 * Returns nulls for any detection that fails — never throws.
 * Times out after 45 s total (download + decode + analysis).
 */
export async function detectAudioFeatures(fileUrl: string): Promise<AudioFeatures> {
  const result: AudioFeatures = { bpm: null, musicalKey: null };

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
      const beatResult = await guess(audioBuffer as unknown as AudioBuffer);
      if (beatResult?.bpm && isFinite(beatResult.bpm)) {
        result.bpm = Math.round(beatResult.bpm);
      }
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
 * Skips non-audio URLs (images, PDFs, videos) by checking the extension.
 */
export async function detectAudioFeaturesFromUrls(urls: string[]): Promise<AudioFeatures> {
  const audioExts = /\.(mp3|wav|flac|aac|ogg|m4a|aiff?|wma)(\?|$)/i;
  const audioUrl  = urls.find((u) => audioExts.test(u));
  if (!audioUrl) return { bpm: null, musicalKey: null };
  return detectAudioFeatures(audioUrl);
}
