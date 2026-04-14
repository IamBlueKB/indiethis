/**
 * Download all EffNet-Discogs ONNX model files to models/effnet-discogs/
 * These are the ONNX-format versions — no Python or conversion needed.
 */

import { mkdirSync, createWriteStream, existsSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "..", "models", "effnet-discogs");

mkdirSync(MODELS_DIR, { recursive: true });

const BASE = "https://essentia.upf.edu/models";

const files = [
  // Base model — 400 Discogs style predictions + 1280-dim embeddings (both from same ONNX)
  [`${BASE}/music-style-classification/discogs-effnet/discogs-effnet-bsdynamic-1.onnx`, "effnet-style.onnx"],
  // Classifier heads (take 1280-dim embeddings as input)
  [`${BASE}/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.onnx`, "moodtheme.onnx"],
  [`${BASE}/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.onnx`, "instrument.onnx"],
  [`${BASE}/classification-heads/danceability/danceability-discogs-effnet-1.onnx`, "danceability.onnx"],
  [`${BASE}/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.onnx`, "voice.onnx"],
  [`${BASE}/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.onnx`, "mood_aggressive.onnx"],
  [`${BASE}/classification-heads/mood_happy/mood_happy-discogs-effnet-1.onnx`, "mood_happy.onnx"],
  [`${BASE}/classification-heads/mood_sad/mood_sad-discogs-effnet-1.onnx`, "mood_sad.onnx"],
  [`${BASE}/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.onnx`, "mood_relaxed.onnx"],
  [`${BASE}/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.onnx`, "tonal_atonal.onnx"],
];

async function download(url, filename) {
  const dest = join(MODELS_DIR, filename);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`  SKIP (exists) ${filename}`);
    return;
  }
  const t0 = Date.now();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  await pipeline(r.body, createWriteStream(dest));
  const size = statSync(dest).size;
  console.log(`  ✓ ${filename} (${(size / 1024 / 1024).toFixed(1)}MB, ${Date.now() - t0}ms)`);
}

console.log(`Downloading ONNX models to: ${MODELS_DIR}\n`);
for (const [url, filename] of files) {
  try {
    await download(url, filename);
  } catch (e) {
    console.error(`  ✗ FAILED ${filename}: ${e.message}`);
  }
}
console.log("\nDone.");
