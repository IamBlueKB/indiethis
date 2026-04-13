/**
 * src/lib/audio/essentia-vggish.ts
 *
 * Real ML audio classification via essentia.js TF.js VGGish models.
 * Downloads pre-trained classifiers from essentia.upf.edu and runs them
 * on-device — no external inference API, no Replicate credits required.
 *
 * Architecture:
 *   1. Decode audio to 16kHz mono (VGGish requirement)
 *   2. Extract mel-spectrogram features ONCE via EssentiaTFInputExtractor
 *   3. Load each classifier TF.js model sequentially, predict, dispose
 *   4. Build structured EssentiaAnalysisResult from all predictions
 *
 * Classifiers run (8 total):
 *   genre_rosamerica   — 8-class genre (classic, dance, hip-hop, jazz, pop, r&b, rock, speech)
 *   genre_tzanetakis   — 10-class genre (includes hiphop, metal, reggae — merges with above)
 *   danceability       — danceable vs not_danceable
 *   voice_instrumental — voice vs instrumental
 *   mood_aggressive    — aggressive vs not_aggressive
 *   mood_happy         — happy vs not_happy
 *   mood_sad           — sad vs not_sad
 *   mood_relaxed       — relaxed vs not_relaxed
 *   tonal_atonal       — tonal vs atonal (bright/dark timbre proxy)
 *
 * Returns the same EssentiaAnalysisResult type as the Replicate path so
 * song-analyzer.ts can use either interchangeably.
 */

import type { EssentiaAnalysisResult } from "./essentia-analysis";

// ─── Model definitions ────────────────────────────────────────────────────────

const BASE = "https://essentia.upf.edu/models/classifiers";

interface ClassifierDef {
  url:     string;
  classes: string[];
}

const CLASSIFIERS: Record<string, ClassifierDef> = {
  genre_rosamerica: {
    url:     `${BASE}/genre_rosamerica/genre_rosamerica-vggish-audioset-1/model.json`,
    classes: ["classic", "dance", "hip-hop", "jazz", "pop", "rhythm-and-blues", "rock", "speech"],
  },
  genre_tzanetakis: {
    url:     `${BASE}/genre_tzanetakis/genre_tzanetakis-vggish-audioset-1/model.json`,
    classes: ["blues", "classical", "country", "disco", "hiphop", "jazz", "metal", "pop", "reggae", "rock"],
  },
  danceability: {
    url:     `${BASE}/danceability/danceability-vggish-audioset-1/model.json`,
    classes: ["danceable", "not_danceable"],
  },
  voice_instrumental: {
    url:     `${BASE}/voice_instrumental/voice_instrumental-vggish-audioset-1/model.json`,
    classes: ["voice", "instrumental"],
  },
  mood_aggressive: {
    url:     `${BASE}/mood_aggressive/mood_aggressive-vggish-audioset-1/model.json`,
    classes: ["aggressive", "not_aggressive"],
  },
  mood_happy: {
    url:     `${BASE}/mood_happy/mood_happy-vggish-audioset-1/model.json`,
    classes: ["happy", "not_happy"],
  },
  mood_sad: {
    url:     `${BASE}/mood_sad/mood_sad-vggish-audioset-1/model.json`,
    classes: ["sad", "not_sad"],
  },
  mood_relaxed: {
    url:     `${BASE}/mood_relaxed/mood_relaxed-vggish-audioset-1/model.json`,
    classes: ["relaxed", "not_relaxed"],
  },
  tonal_atonal: {
    url:     `${BASE}/tonal_atonal/tonal_atonal-vggish-audioset-1/model.json`,
    classes: ["tonal", "atonal"],
  },
};

// ─── Internal types ───────────────────────────────────────────────────────────

type ClassifierResults = Record<string, number[]>; // classifier → per-class scores

type EssentiaVector = { delete: () => void };

interface EssentiaExtractor {
  computeFrameWise: (signal: Float32Array, hopSize?: number) => unknown;
  delete:           () => void;
}

interface VGGishModel {
  initialize: () => Promise<void>;
  predict:    (input: unknown, zeroPadding?: boolean) => Promise<unknown[]>;
  dispose:    () => void;
}

type AudioCtxLike = {
  decodeAudioData: (buf: ArrayBuffer) => Promise<{
    getChannelData:   (ch: number) => Float32Array;
    numberOfChannels: number;
    length:           number;
  }>;
  close: () => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoresToArray(predictions: unknown[], numClasses: number): number[] {
  const p = predictions[0];
  if (p instanceof Float32Array) return Array.from(p).slice(0, numClasses);
  if (Array.isArray(p))          return (p as number[]).slice(0, numClasses);
  return new Array(numClasses).fill(0);
}

function topN(classes: string[], scores: number[], n: number): { label: string; score: number }[] {
  return classes
    .map((label, i) => ({ label, score: scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .filter(x => x.score > 0.05);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Download audio from `audioUrl`, run VGGish ML classifiers, return
 * structured genre/mood/danceability/voice/timbre results.
 * Returns null on any unrecoverable failure.
 */
export async function analyzeWithVGGish(
  audioUrl: string,
): Promise<EssentiaAnalysisResult | null> {
  let extractor: EssentiaExtractor | null = null;

  try {
    console.log("[essentia-vggish] Starting VGGish analysis for:", audioUrl.slice(0, 80));

    // ── 1. Fetch audio ─────────────────────────────────────────────────────────
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[essentia-vggish] Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    // ── 2. Decode to 16kHz mono (VGGish requirement) ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AudioContext } = require("node-web-audio-api") as {
      AudioContext: new (opts?: { sampleRate?: number }) => AudioCtxLike;
    };
    const ctx = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close();

    const channels = audioBuffer.numberOfChannels;
    const length   = audioBuffer.length;
    const mono     = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    console.log(`[essentia-vggish] Decoded ${(length / 16000).toFixed(1)}s at 16kHz mono`);

    // ── 3. Load TF.js + Essentia ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tf = require("@tensorflow/tfjs") as typeof import("@tensorflow/tfjs");

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const essentiajs = require("essentia.js") as {
      EssentiaWASM: object;
      EssentiaModel: {
        EssentiaTFInputExtractor: new (wasm: object, type: string) => EssentiaExtractor;
        TensorflowVGGish: new (tf: unknown, url: string, verbose?: boolean) => VGGishModel;
      };
    };
    const { EssentiaWASM, EssentiaModel } = essentiajs;
    const { EssentiaTFInputExtractor, TensorflowVGGish } = EssentiaModel;

    // ── 4. Extract VGGish features ONCE (shared across all classifiers) ───────
    extractor = new EssentiaTFInputExtractor(EssentiaWASM, "vggish");
    const features = extractor.computeFrameWise(mono);
    console.log("[essentia-vggish] Features extracted");

    // ── 5. Run each classifier sequentially — load → predict → dispose ────────
    const results: ClassifierResults = {};

    for (const [name, def] of Object.entries(CLASSIFIERS)) {
      let model: VGGishModel | null = null;
      try {
        console.log(`[essentia-vggish] Running ${name}…`);
        model = new TensorflowVGGish(tf, def.url, false);
        await model.initialize();
        const preds = await model.predict(features, true);
        results[name] = scoresToArray(preds, def.classes.length);
        console.log(`[essentia-vggish] ${name}: ${results[name].map((v, i) => `${def.classes[i]}=${v.toFixed(2)}`).join(" ")}`);
      } catch (err) {
        console.warn(`[essentia-vggish] ${name} failed:`, err instanceof Error ? err.message : err);
      } finally {
        model?.dispose();
        // Give GC a chance to free model memory between loads
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    extractor.delete();
    extractor = null;

    // ── 6. Build result ───────────────────────────────────────────────────────
    return buildResult(results);

  } catch (err) {
    console.error("[essentia-vggish] Analysis failed:", err instanceof Error ? err.message : err);
    extractor?.delete();
    return null;
  }
}

// ─── Result builder ───────────────────────────────────────────────────────────

function buildResult(r: ClassifierResults): EssentiaAnalysisResult {
  // ── Genres — merge rosamerica (8 classes) + tzanetakis (10 classes) ─────────
  const genreMap: Record<string, number> = {};
  const rosaClasses = CLASSIFIERS.genre_rosamerica.classes;
  const tzanClasses = CLASSIFIERS.genre_tzanetakis.classes;

  (r["genre_rosamerica"] ?? []).forEach((score, i) => {
    const label = rosaClasses[i];
    if (label) genreMap[label] = Math.max(genreMap[label] ?? 0, score);
  });
  (r["genre_tzanetakis"] ?? []).forEach((score, i) => {
    // Normalize tzanetakis label casing + merge with rosamerica equivalents
    const raw = tzanClasses[i];
    const label = raw === "hiphop" ? "hip-hop" : raw.charAt(0).toUpperCase() + raw.slice(1);
    genreMap[label] = Math.max(genreMap[label] ?? 0, score);
  });
  const genres = Object.entries(genreMap)
    .filter(([, s]) => s > 0.05)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, score]) => ({ label, score }));

  // ── Moods — positive class from each binary classifier ──────────────────────
  const moodEntries = [
    { label: "aggressive", score: r["mood_aggressive"]?.[0] ?? 0 },
    { label: "happy",      score: r["mood_happy"]?.[0]      ?? 0 },
    { label: "sad",        score: r["mood_sad"]?.[0]        ?? 0 },
    { label: "relaxed",    score: r["mood_relaxed"]?.[0]    ?? 0 },
  ];
  const moods = moodEntries
    .filter(m => m.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // ── Danceability ─────────────────────────────────────────────────────────────
  const danceability = r["danceability"]?.[0] ?? 0.5; // index 0 = "danceable" score

  // ── Voice / Vocals ───────────────────────────────────────────────────────────
  const voiceScore        = r["voice_instrumental"]?.[0] ?? 0;
  const instrumentalScore = r["voice_instrumental"]?.[1] ?? 0;
  const voice: "vocal" | "instrumental" = voiceScore >= instrumentalScore ? "vocal" : "instrumental";

  // ── Timbre — tonal = bright, atonal = dark ───────────────────────────────────
  const tonalScore  = r["tonal_atonal"]?.[0] ?? 0;
  const atonalScore = r["tonal_atonal"]?.[1] ?? 0;
  let timbre: "bright" | "dark" | null = null;
  if (tonalScore > 0.55 && tonalScore > atonalScore)  timbre = "bright";
  if (atonalScore > 0.55 && atonalScore > tonalScore) timbre = "dark";

  // ── Auto-tags — flatten all predictions as searchable tags ──────────────────
  const autoTags: { label: string; score: number }[] = [];
  for (const [classifier, scores] of Object.entries(r)) {
    const classes = CLASSIFIERS[classifier]?.classes ?? [];
    scores.forEach((score, i) => {
      if (score > 0.1 && classes[i] && !classes[i].startsWith("not_")) {
        autoTags.push({ label: `${classifier}:${classes[i]}`, score });
      }
    });
  }
  autoTags.sort((a, b) => b.score - a.score);

  return {
    genres,
    moods,
    instruments: [], // VGGish audioset models don't include instrument classifiers
    danceability,
    voice,
    voiceGender:  null, // gender model not included to reduce load time
    timbre,
    autoTags: autoTags.slice(0, 30),
  };
}
