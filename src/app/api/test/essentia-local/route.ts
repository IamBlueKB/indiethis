/**
 * GET /api/test/essentia-local
 *
 * TEST ONLY — do not wire to production.
 *
 * Loads a VGGish-backed Essentia model via TensorFlow.js (pure-JS, no native deps),
 * runs inference on the Razor's Edge audio file, and reports:
 *   - Memory usage at each stage (heapUsed + rss in MB)
 *   - Execution time per stage
 *   - Inference output (first 5 values)
 *   - Any error with full message + location
 *
 * Model: danceability-vggish-audioset-1 from essentia.upf.edu
 *   — a real VGGish-backed classifier from the same library used by mtg/music-classifiers.
 *   — Swap the MODEL_URL to any other essentia VGGish model to test larger variants.
 *
 * To test a heavier model (~288MB range), replace MODEL_URL with:
 *   https://essentia.upf.edu/models/classifiers/genre_dortmund/genre_dortmund-vggish-audioset-1/model.json
 *
 * Audio: public/audio/Razor's Edge.wav (decoded via node-web-audio-api at 16kHz)
 *
 * Vercel constraints being tested:
 *   - maxDuration: 60s
 *   - Memory: model load + WASM + audio buffer must fit in ~1GB
 *   - Function bundle size: TFjs is pure-JS, no native deps, safe to bundle
 *
 * The production Replicate pipeline is UNCHANGED.
 */

import { NextResponse } from "next/server";
import * as fs         from "fs";
import * as path       from "path";

export const maxDuration = 60;
export const dynamic     = "force-dynamic";
export const runtime     = "nodejs";

// ─── Model URL ─────────────────────────────────────────────────────────────────
// VGGish-backed danceability classifier from essentia.upf.edu.
// Swap to genre_dortmund-vggish-audioset-1 or genre_rosamerica-vggish-audioset-1
// to test larger models.
const MODEL_URL =
  "https://essentia.upf.edu/models/classifiers/danceability/danceability-vggish-audioset-1/model.json";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mb(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}

function snap(label: string, t0: number) {
  const m = process.memoryUsage();
  return {
    label,
    elapsedMs:   Date.now() - t0,
    heapUsedMB:  mb(m.heapUsed),
    heapTotalMB: mb(m.heapTotal),
    rssMB:       mb(m.rss),
    externalMB:  mb(m.external),
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const t0      = Date.now();
  const stages: ReturnType<typeof snap>[] = [];

  try {
    // ── Stage 0: baseline ──────────────────────────────────────────────────────
    stages.push(snap("baseline", t0));

    // ── Stage 1: import TensorFlow.js ─────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tf = require("@tensorflow/tfjs") as typeof import("@tensorflow/tfjs");
    stages.push(snap("after_tfjs_import", t0));

    // ── Stage 2: import essentia.js ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const essentiajs = require("essentia.js") as {
      EssentiaWASM: object;
      EssentiaModel: {
        EssentiaTFInputExtractor: new (wasm: object, type: string) => {
          computeFrameWise: (signal: Float32Array, hopSize?: number) => unknown;
          delete:           () => void;
          shutdown:         () => void;
          frameSize:        number;
          sampleRate:       number;
        };
        TensorflowVGGish: new (tfjs: unknown, modelUrl: string, verbose?: boolean) => {
          initialize: () => Promise<void>;
          predict:    (input: unknown, zeroPadding?: boolean) => Promise<unknown[]>;
          dispose:    () => void;
        };
      };
    };
    const { EssentiaWASM, EssentiaModel } = essentiajs;
    const { EssentiaTFInputExtractor, TensorflowVGGish } = EssentiaModel;
    stages.push(snap("after_essentia_import", t0));

    // ── Stage 3: decode audio ──────────────────────────────────────────────────
    // node-web-audio-api provides a Node.js AudioContext.
    // We set sampleRate=16000 so decodeAudioData resamples automatically.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AudioContext } = require("node-web-audio-api") as {
      AudioContext: new (opts?: { sampleRate?: number }) => {
        sampleRate:    number;
        decodeAudioData: (buf: ArrayBuffer) => Promise<{
          getChannelData:    (ch: number) => Float32Array;
          numberOfChannels:  number;
          duration:          number;
          sampleRate:        number;
          length:            number;
        }>;
        close: () => Promise<void>;
      };
    };

    const audioPath   = path.join(process.cwd(), "public", "audio", "Razor's Edge.wav");
    const fileBuffer  = fs.readFileSync(audioPath);
    const audioCtx    = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioCtx.decodeAudioData(fileBuffer.buffer as ArrayBuffer);

    // Mix to mono: average all channels into a single Float32Array
    const channels = audioBuffer.numberOfChannels;
    const length   = audioBuffer.length;
    const mono     = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }

    stages.push(snap("after_audio_decode", t0));
    const audioInfo = {
      durationSec:     audioBuffer.duration.toFixed(2),
      sampleRate:      audioBuffer.sampleRate,
      channels:        audioBuffer.numberOfChannels,
      samples:         audioBuffer.length,
      monoArrayLength: mono.length,
    };

    await audioCtx.close();

    // ── Stage 4: create extractor ──────────────────────────────────────────────
    // EssentiaWASM is already initialized (the UMD build pre-initializes it).
    // EssentiaTFInputExtractor expects 16000Hz audio for VGGish (400-sample frames).
    const extractor = new EssentiaTFInputExtractor(EssentiaWASM, "vggish");
    stages.push(snap("after_extractor_init", t0));

    // ── Stage 5: extract mel-spectrogram features ──────────────────────────────
    const features = extractor.computeFrameWise(mono);
    stages.push(snap("after_feature_extraction", t0));

    // ── Stage 6: load VGGish model ─────────────────────────────────────────────
    // Model is downloaded at request time (not bundled). ~30-100MB depending on variant.
    const vggish = new TensorflowVGGish(tf, MODEL_URL, false);
    await vggish.initialize();
    stages.push(snap("after_model_load", t0));

    // ── Stage 7: run inference ─────────────────────────────────────────────────
    const predictions = await vggish.predict(features, true);
    stages.push(snap("after_inference", t0));

    // ── Stage 8: cleanup ───────────────────────────────────────────────────────
    extractor.delete();
    vggish.dispose();
    stages.push(snap("after_cleanup", t0));

    // Summarise prediction output — predictions is an array of arrays or flat values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = (predictions as any[]).slice(0, 3).map((p: unknown) => {
      if (Array.isArray(p)) return p.slice(0, 5);
      if (p instanceof Float32Array) return Array.from(p).slice(0, 5);
      return p;
    });

    return NextResponse.json({
      success:          true,
      totalElapsedMs:   Date.now() - t0,
      modelUrl:         MODEL_URL,
      audioInfo,
      predictionCount:  (predictions as unknown[]).length,
      samplePredictions: summary,
      stages,
    });

  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        success:        false,
        totalElapsedMs: Date.now() - t0,
        error:          e.message ?? String(err),
        stack:          e.stack?.split("\n").slice(0, 8).join("\n"),
        stages,
      },
      { status: 500 }
    );
  }
}
