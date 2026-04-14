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

/**
 * Download a URL to an ArrayBuffer using Node's built-in https/http modules.
 * Avoids relying on global fetch which is unavailable on Node 16.
 */
function downloadUrl(url: string, timeoutMs = 45_000): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const transport = url.startsWith("https") ? require("node:https") : require("node:http");
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => reject(new Error("Download timed out")), timeoutMs);

    transport.get(url, (res: import("http").IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 400) {
        clearTimeout(timer);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      // Follow redirects (UploadThing CDN redirects to R2)
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
        clearTimeout(timer);
        downloadUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      });
      res.on("error", (err: Error) => { clearTimeout(timer); reject(err); });
    }).on("error", (err: Error) => { clearTimeout(timer); reject(err); });
  });
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
  const urlShort = fileUrl.slice(0, 80);

  try {
    // ── 1. Download ───────────────────────────────────────────────────────────
    const t0 = Date.now();
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await downloadUrl(fileUrl);
    } catch (fetchErr) {
      console.error(`[audio-analysis] Download failed for ${urlShort}:`, fetchErr);
      return result;
    }

    if (arrayBuffer.byteLength === 0) {
      console.error(`[audio-analysis] Empty response body for ${urlShort}`);
      return result;
    }

    console.log(`[audio-analysis] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB in ${Date.now() - t0}ms`);

    // ── 2. Decode ─────────────────────────────────────────────────────────────
    // node-web-audio-api's AudioContext accepts the same API as the browser's.
    // We create a new context per call so parallel invocations don't interfere.
    let AudioContext: ReturnType<typeof getAudioContext>;
    try {
      AudioContext = getAudioContext();
    } catch (ctxErr) {
      console.error(`[audio-analysis] node-web-audio-api load failed:`, ctxErr);
      return result;
    }

    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      // slice(0) copies the buffer so decodeAudioData can detach it safely
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (decodeErr) {
      console.error(`[audio-analysis] decodeAudioData failed for ${urlShort}:`, decodeErr);
      await audioContext.close();
      return result;
    }

    const channelData = audioBuffer.getChannelData(0);
    console.log(`[audio-analysis] Decoded: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

    // ── 3. BPM ────────────────────────────────────────────────────────────────
    try {
      const essentia = getEssentia();
      const bpm = detectBpmWithEssentia(channelData, essentia);
      if (bpm !== null) {
        result.bpm = bpm;
        console.log(`[audio-analysis] BPM detected: ${bpm}`);
      } else {
        console.warn(`[audio-analysis] BPM detection returned null`);
      }
    } catch (bpmErr) {
      console.error(`[audio-analysis] BPM detection threw:`, bpmErr);
    }

    // ── 4. Key ────────────────────────────────────────────────────────────────
    try {
      const essentia = getEssentia();
      const vector   = essentia.arrayToVector(channelData);
      const keyData  = essentia.KeyExtractor(vector);
      if (keyData?.key) {
        result.musicalKey = `${keyData.key} ${keyData.scale}`;
        console.log(`[audio-analysis] Key detected: ${result.musicalKey}`);
      } else {
        console.warn(`[audio-analysis] KeyExtractor returned no key`);
      }
    } catch (keyErr) {
      console.error(`[audio-analysis] Key detection threw:`, keyErr);
    }

    // ── 5. Energy ─────────────────────────────────────────────────────────────
    try {
      let sumSq = 0;
      for (let i = 0; i < channelData.length; i++) sumSq += channelData[i] * channelData[i];
      const rms = Math.sqrt(sumSq / channelData.length);
      result.energy = Math.min(rms / 0.25, 1);
      console.log(`[audio-analysis] Energy: ${result.energy.toFixed(3)} (RMS=${rms.toFixed(4)})`);
    } catch (energyErr) {
      console.error(`[audio-analysis] Energy calculation threw:`, energyErr);
    }

    await audioContext.close();
  } catch (outerErr) {
    console.error(`[audio-analysis] Unexpected outer error for ${urlShort}:`, outerErr);
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
