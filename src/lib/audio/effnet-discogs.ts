/**
 * src/lib/audio/effnet-discogs.ts
 *
 * EffNet-Discogs ML analysis using ONNX Runtime Web (WASM backend).
 * Uses onnxruntime-web instead of onnxruntime-node to avoid native binary
 * bloat (512MB) that exceeds Vercel's 300MB serverless function size limit.
 *
 * Architecture:
 *   1. Audio → 16kHz mono Float32Array
 *   2. EssentiaTFInputExtractor ('musicnn') → mel-spectrogram frames [96 mel bands]
 *   3. Stack 128 frames → patches [N, 128, 96]
 *   4. effnet-style.onnx → activations [N, 400] (Discogs styles) + embeddings [N, 1280]
 *   5. Mean embeddings [1, 1280] → classifier heads → individual predictions
 *
 * All models are loaded once and cached at module scope for warm reuse.
 * Models live in models/effnet-discogs/ at the project root.
 *
 * ONNX model verified input/output names:
 *   - base model: input 'melspectrogram' [N, 128, 96] → outputs 'activations' [N, 400] + 'embeddings' [N, 1280]
 *   - classifiers: input 'embeddings' [N, 1280] → output 'activations' [N, num_classes]
 */

import * as ort from "onnxruntime-web";
import * as path from "path";
import * as fs from "fs";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODELS_DIR = path.join(process.cwd(), "models", "effnet-discogs");

// Mel-spectrogram parameters (musicnn extractor, matches EffNet training config)
const FRAME_SIZE  = 512;   // audio samples per frame
const HOP_SIZE    = 256;   // hop between frames
const MEL_BANDS   = 96;    // mel frequency bins
const PATCH_FRAMES = 128;  // frames stacked per EffNet patch

// Cap the number of patches to analyze (prevents OOM on very long tracks)
// 200 patches × 128 frames × 10ms/frame = ~256 seconds analyzed
const MAX_PATCHES = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EffnetResult {
  // 400 Discogs style predictions (top genres)
  genres: { label: string; score: number }[];
  // Combined mood predictions
  moods: { label: string; score: number }[];
  // 40 instrument class predictions
  instruments: { label: string; score: number }[];
  // 0-1 danceability score
  danceability: number;
  // true if vocals detected
  isVocal: boolean;
  // true if track is tonal (not atonal noise)
  isTonal: boolean;
}

// ─── Module-level model cache ─────────────────────────────────────────────────

let baseSession: ort.InferenceSession | null = null;
let classifiers: Record<string, ort.InferenceSession> = {};
let genreLabels: string[] = [];
let moodThemeLabels: string[] = [];
let instrumentLabels: string[] = [];
let initialized = false;
let initPromise: Promise<void> | null = null;

// ─── Initialization ───────────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  if (initialized) return;

  const t0 = Date.now();
  console.log("[effnet] Loading models...");

  // Configure WASM backend for serverless:
  // - numThreads = 1: no SharedArrayBuffer in serverless, single-threaded only
  // - wasmPaths: explicit path to WASM files so ORT can locate them at runtime
  ort.env.wasm.numThreads = 1;
  const wasmDir = path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
  ort.env.wasm.wasmPaths = wasmDir + "/";

  // Load class labels from JSON metadata files
  const genreMeta = JSON.parse(
    fs.readFileSync(path.join(MODELS_DIR, "discogs-effnet-bs64-1.json"), "utf-8")
  );
  genreLabels = genreMeta.classes ?? [];

  const moodThemeMeta = JSON.parse(
    fs.readFileSync(path.join(MODELS_DIR, "mtg_jamendo_moodtheme-discogs-effnet-1.json"), "utf-8")
  );
  moodThemeLabels = moodThemeMeta.classes ?? [];

  const instrumentMeta = JSON.parse(
    fs.readFileSync(path.join(MODELS_DIR, "mtg_jamendo_instrument-discogs-effnet-1.json"), "utf-8")
  );
  instrumentLabels = instrumentMeta.classes ?? [];

  // Load all models in parallel for fast cold start
  const [styleSession, ...classifierSessions] = await Promise.all([
    ort.InferenceSession.create(path.join(MODELS_DIR, "effnet-style.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "moodtheme.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "instrument.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "danceability.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "voice.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "mood_aggressive.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "mood_happy.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "mood_sad.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "mood_relaxed.onnx")),
    ort.InferenceSession.create(path.join(MODELS_DIR, "tonal_atonal.onnx")),
  ]);

  baseSession = styleSession;
  const classifierNames = [
    "moodtheme", "instrument", "danceability", "voice",
    "mood_aggressive", "mood_happy", "mood_sad", "mood_relaxed", "tonal_atonal",
  ];
  classifierNames.forEach((name, i) => {
    classifiers[name] = classifierSessions[i];
  });

  initialized = true;
  console.log(`[effnet] All models loaded in ${Date.now() - t0}ms`);
  console.log(`[effnet] Genre labels: ${genreLabels.length}, Mood themes: ${moodThemeLabels.length}, Instruments: ${instrumentLabels.length}`);
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize().catch((err) => {
      initPromise = null; // allow retry on next call
      throw err;
    });
  }
  return initPromise;
}

// ─── Mel-spectrogram extraction ────────────────────────────────────────────────

/**
 * Extract mel-spectrogram patches from a 16kHz mono audio signal.
 * Uses essentia.js EssentiaTFInputExtractor with 'musicnn' configuration.
 * Returns a Float32Array suitable for ONNX input, shaped [N, 128, 96].
 */
function extractPatches(audio: Float32Array): { data: Float32Array; numPatches: number } {
  // Lazy-require essentia.js to avoid loading it at module initialization time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const essentiajs = require("essentia.js") as {
    EssentiaWASM: object;
    EssentiaModel: {
      EssentiaTFInputExtractor: new (wasm: object, type: string, debug?: boolean) => {
        compute: (frame: Float32Array) => { melSpectrum: Float32Array };
        delete: () => void;
      };
    };
  };

  const extractor = new essentiajs.EssentiaModel.EssentiaTFInputExtractor(
    essentiajs.EssentiaWASM,
    "musicnn",
    false,
  );

  try {
    // Accumulate mel-spectrum frames
    const allFrames: Float32Array[] = [];

    for (let i = 0; i + FRAME_SIZE <= audio.length; i += HOP_SIZE) {
      const frame = audio.slice(i, i + FRAME_SIZE);
      const { melSpectrum } = extractor.compute(frame);
      allFrames.push(new Float32Array(melSpectrum));

      // Stop if we have enough frames for MAX_PATCHES patches
      if (allFrames.length >= MAX_PATCHES * PATCH_FRAMES) break;
    }

    // Group frames into patches of PATCH_FRAMES each
    const numPatches = Math.floor(allFrames.length / PATCH_FRAMES);
    if (numPatches === 0) {
      console.warn(`[effnet] Not enough frames for a single patch (got ${allFrames.length}, need ${PATCH_FRAMES})`);
      return { data: new Float32Array(0), numPatches: 0 };
    }

    const patchData = new Float32Array(numPatches * PATCH_FRAMES * MEL_BANDS);
    for (let p = 0; p < numPatches; p++) {
      for (let f = 0; f < PATCH_FRAMES; f++) {
        const srcFrame = allFrames[p * PATCH_FRAMES + f];
        const destOffset = (p * PATCH_FRAMES + f) * MEL_BANDS;
        patchData.set(srcFrame, destOffset);
      }
    }

    console.log(`[effnet] Extracted ${allFrames.length} mel frames → ${numPatches} patches`);
    return { data: patchData, numPatches };
  } finally {
    extractor.delete();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Average a [N, D] tensor to [1, D] by computing the mean across the N axis. */
function meanAcrossPatches(data: Float32Array, numPatches: number, dim: number): Float32Array {
  const result = new Float32Array(dim);
  for (let i = 0; i < numPatches; i++) {
    for (let j = 0; j < dim; j++) {
      result[j] += data[i * dim + j];
    }
  }
  for (let j = 0; j < dim; j++) result[j] /= numPatches;
  return result;
}

/** Run a classifier head given the mean embedding. Returns the activation array. */
async function runClassifier(name: string, embedding: Float32Array): Promise<Float32Array | null> {
  const session = classifiers[name];
  if (!session) return null;
  const tensor = new ort.Tensor("float32", embedding, [1, 1280]);
  const output = await session.run({ embeddings: tensor });
  return output.activations.data as Float32Array;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyze a 16kHz mono audio signal using EffNet-Discogs ML models.
 * Returns null on failure — callers must treat this as a soft error.
 */
export async function analyzeWithEffnet(
  audio: Float32Array,
): Promise<EffnetResult | null> {
  try {
    await ensureInitialized();

    // 1. Extract mel-spectrogram patches
    const { data: patchData, numPatches } = extractPatches(audio);
    if (numPatches === 0) {
      console.warn("[effnet] No patches extracted — audio too short?");
      return null;
    }

    // 2. Run base model: mel-spectrogram → style activations + embeddings
    const inputTensor = new ort.Tensor("float32", patchData, [numPatches, PATCH_FRAMES, MEL_BANDS]);
    const baseOutput = await baseSession!.run({ melspectrogram: inputTensor });

    const activationsData = baseOutput.activations.data as Float32Array;  // [N × 400]
    const embeddingsData  = baseOutput.embeddings.data  as Float32Array;  // [N × 1280]

    // 3. Average style activations and embeddings across patches
    const meanActivations = meanAcrossPatches(activationsData, numPatches, 400);
    const meanEmbedding   = meanAcrossPatches(embeddingsData,  numPatches, 1280);

    // 4. Top genres from 400 Discogs style predictions
    const genreScores = Array.from(meanActivations);
    const genres = genreLabels
      .map((label, i) => ({ label, score: genreScores[i] }))
      .filter((g) => g.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 5. Run classifier heads on mean embedding
    const moods: { label: string; score: number }[] = [];

    // MTG Jamendo mood/theme (56 classes)
    const moodThemeActs = await runClassifier("moodtheme", meanEmbedding);
    if (moodThemeActs) {
      const moodThemeResults = moodThemeLabels
        .map((label, i) => ({ label, score: moodThemeActs[i] }))
        .filter((m) => m.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      moods.push(...moodThemeResults);
    }

    // Binary mood classifiers
    // class order: aggressive[0]/not_aggressive[1]
    const aggressiveActs = await runClassifier("mood_aggressive", meanEmbedding);
    if (aggressiveActs && aggressiveActs[0] > 0.3) {
      moods.push({ label: "aggressive", score: aggressiveActs[0] });
    }

    // class order: happy[0]/non_happy[1]
    const happyActs = await runClassifier("mood_happy", meanEmbedding);
    if (happyActs && happyActs[0] > 0.3) {
      moods.push({ label: "happy", score: happyActs[0] });
    }

    // class order: non_sad[0]/sad[1]
    const sadActs = await runClassifier("mood_sad", meanEmbedding);
    if (sadActs && sadActs[1] > 0.3) {
      moods.push({ label: "sad", score: sadActs[1] });
    }

    // class order: non_relaxed[0]/relaxed[1]
    const relaxedActs = await runClassifier("mood_relaxed", meanEmbedding);
    if (relaxedActs && relaxedActs[1] > 0.3) {
      moods.push({ label: "relaxed", score: relaxedActs[1] });
    }

    // Deduplicate and sort moods
    const seenMoods = new Set<string>();
    const dedupedMoods = moods
      .filter((m) => { if (seenMoods.has(m.label)) return false; seenMoods.add(m.label); return true; })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // Instrument classifier (40 classes)
    const instrumentActs = await runClassifier("instrument", meanEmbedding);
    const instruments = instrumentActs
      ? instrumentLabels
          .map((label, i) => ({ label, score: instrumentActs[i] }))
          .filter((inst) => inst.score > 0.1)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
      : [];

    // Danceability: class order [danceable, not_danceable] → index 0 is danceability score
    const danceActs = await runClassifier("danceability", meanEmbedding);
    const danceability = danceActs ? danceActs[0] : 0.5;

    // Voice/Instrumental: class order [instrumental, voice] → index 1 is vocal score
    const voiceActs = await runClassifier("voice", meanEmbedding);
    const isVocal = voiceActs ? voiceActs[1] > voiceActs[0] : true;

    // Tonal/Atonal: class order [atonal, tonal] → index 1 is tonal score
    const tonalActs = await runClassifier("tonal_atonal", meanEmbedding);
    const isTonal = tonalActs ? tonalActs[1] > tonalActs[0] : true;

    const result: EffnetResult = {
      genres,
      moods: dedupedMoods,
      instruments,
      danceability,
      isVocal,
      isTonal,
    };

    console.log("[effnet] Analysis complete:", {
      topGenre:    genres[0]?.label,
      topMood:     dedupedMoods[0]?.label,
      topInst:     instruments[0]?.label,
      danceability: danceability.toFixed(2),
      isVocal,
      isTonal,
    });

    return result;
  } catch (error) {
    console.error("[effnet] Analysis failed:", error);
    return null;
  }
}

/**
 * Download audio from a URL, decode to 16kHz mono, and run EffNet analysis.
 * Returns null on failure.
 */
export async function analyzeUrlWithEffnet(audioUrl: string): Promise<EffnetResult | null> {
  try {
    console.log("[effnet] Fetching audio:", audioUrl.slice(0, 80));

    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error("[effnet] Audio fetch failed:", response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[effnet] Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

    // Decode to 16kHz mono using node-web-audio-api
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AudioContext } = require("node-web-audio-api") as {
      AudioContext: new (opts?: { sampleRate?: number }) => {
        decodeAudioData: (buf: ArrayBuffer) => Promise<{
          getChannelData: (ch: number) => Float32Array;
          numberOfChannels: number;
          length: number;
          sampleRate: number;
        }>;
        close: () => Promise<void>;
      };
    };

    const ctx = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close();

    // Downmix to mono
    const channels = audioBuffer.numberOfChannels;
    const length   = audioBuffer.length;
    const mono     = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += channelData[i] / channels;
    }

    console.log(`[effnet] Decoded ${(length / 16000).toFixed(1)}s at 16kHz mono`);
    return analyzeWithEffnet(mono);
  } catch (error) {
    console.error("[effnet] URL analysis failed:", error);
    return null;
  }
}
