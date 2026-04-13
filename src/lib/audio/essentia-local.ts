/**
 * src/lib/audio/essentia-local.ts
 *
 * Extracts signal-level audio features using the essentia.js WASM module.
 * No TensorFlow.js / no external API — pure on-device DSP.
 *
 * Algorithms (all full-signal, verified against essentia.js v0.1.3):
 *   SpectralCentroidTime  — frequency balance → bright/dark timbre
 *   ZeroCrossingRate      — high-frequency / buzz content indicator
 *   RMS                   — overall signal amplitude
 *   DynamicComplexity     — loudness variation across time
 *
 * Called from analyzeSong() when the DB has no pre-computed Essentia ML fields.
 * Results are passed to the Claude section-analysis call, which uses them to
 * infer genre, mood, danceability, and voice type.
 *
 * NOTE: The Danceability WASM algorithm returns raw DFA values (~1–400)
 * that are not directly usable as a 0–1 score; danceability is left to
 * Claude inference from BPM + energy + spectral features.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalAudioFeatures {
  spectralCentroid:  number;            // Hz — frequency balance
  zeroCrossingRate:  number;            // 0–1 fraction
  rms:               number;            // raw amplitude
  dynamicComplexity: number;            // raw loudness-variation value
  loudness:          number;            // dB (negative)
  timbre:            "bright" | "dark"; // derived: centroid ≥ 1500Hz = bright
}

// ─── Internal types for require() ────────────────────────────────────────────

type EssentiaVector = { delete: () => void };

interface EssentiaInstance {
  arrayToVector:       (arr: Float32Array) => EssentiaVector;
  SpectralCentroidTime:(vec: EssentiaVector) => { centroid: number };
  ZeroCrossingRate:    (vec: EssentiaVector) => { zeroCrossingRate: number };
  RMS:                 (vec: EssentiaVector) => { rms: number };
  DynamicComplexity:   (vec: EssentiaVector, frameSize: number, sampleRate: number) => {
    dynamicComplexity: number;
    loudness:          number;
  };
}

type AudioBufferLike = {
  getChannelData:   (ch: number) => Float32Array;
  numberOfChannels: number;
  length:           number;
};

type AudioContextLike = {
  decodeAudioData: (buf: ArrayBuffer) => Promise<AudioBufferLike>;
  close:           () => Promise<void>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Spectral centroid threshold for bright/dark timbre classification (Hz).
// Bass-heavy / low-mid dominant tracks fall below this; bright / airy tracks above.
const BRIGHT_THRESHOLD_HZ = 1500;

// Frame size passed to DynamicComplexity (seconds)
const DC_FRAME_SIZE_S = 0.2;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Download audio from `audioUrl`, decode it to mono 44100Hz PCM, and run
 * essentia.js WASM algorithms to extract signal-level features.
 *
 * Returns null on any failure — callers must treat this as a soft error.
 */
export async function extractLocalFeatures(
  audioUrl: string,
): Promise<LocalAudioFeatures | null> {
  try {
    console.log("[essentia-local] Fetching audio for WASM analysis:", audioUrl.slice(0, 80));

    // ── 1. Fetch audio ─────────────────────────────────────────────────────────
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error("[essentia-local] Audio fetch failed:", response.status, response.statusText);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[essentia-local] Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    // ── 2. Decode to mono 44100Hz via node-web-audio-api ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AudioContext } = require("node-web-audio-api") as {
      AudioContext: new (opts?: { sampleRate?: number }) => AudioContextLike;
    };

    const ctx         = new AudioContext({ sampleRate: 44100 });
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close();

    const channels = audioBuffer.numberOfChannels;
    const length   = audioBuffer.length;
    const mono     = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += channelData[i] / channels;
    }

    console.log(`[essentia-local] Decoded ${(length / 44100).toFixed(1)}s at 44100Hz, ${channels}ch → mono`);

    // ── 3. Initialize essentia WASM ───────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const essentiajs = require("essentia.js") as {
      EssentiaWASM: object;
      Essentia:     new (wasm: object) => EssentiaInstance;
    };
    const essentia = new essentiajs.Essentia(essentiajs.EssentiaWASM);
    const vec      = essentia.arrayToVector(mono);

    // ── 4. Run WASM algorithms ────────────────────────────────────────────────

    // SpectralCentroidTime — frequency-weighted centroid of the signal in Hz
    const { centroid } = essentia.SpectralCentroidTime(vec);

    // ZeroCrossingRate — fraction of samples where signal crosses zero
    // Low = smooth / bass-heavy; higher = vocal presence / buzzy content
    const { zeroCrossingRate } = essentia.ZeroCrossingRate(vec);

    // RMS — root-mean-square amplitude
    const { rms } = essentia.RMS(vec);

    // DynamicComplexity — loudness variation; (frameSize=0.2s, sampleRate=44100)
    const { dynamicComplexity, loudness } = essentia.DynamicComplexity(
      vec, DC_FRAME_SIZE_S, 44100,
    );

    vec.delete();

    // ── 5. Derive timbre classification ───────────────────────────────────────
    const timbre: "bright" | "dark" = centroid >= BRIGHT_THRESHOLD_HZ ? "bright" : "dark";

    console.log(
      `[essentia-local] centroid=${centroid.toFixed(0)}Hz ` +
      `zcr=${zeroCrossingRate.toFixed(4)} ` +
      `rms=${rms.toFixed(4)} ` +
      `dc=${dynamicComplexity.toFixed(2)} ` +
      `loudness=${loudness.toFixed(1)}dB ` +
      `timbre=${timbre}`,
    );

    return {
      spectralCentroid:  centroid,
      zeroCrossingRate,
      rms,
      dynamicComplexity,
      loudness,
      timbre,
    };
  } catch (err) {
    console.error("[essentia-local] Feature extraction failed:", err);
    return null;
  }
}
