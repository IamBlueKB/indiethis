/**
 * Download all EffNet-Discogs model files to models/effnet-discogs/
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
  // Feature extractor (base embedding model — likely same as style classifier)
  [`${BASE}/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb`,   "discogs-effnet-bs64-1.pb"],
  [`${BASE}/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.json`, "discogs-effnet-bs64-1.json"],

  // Style classifier (400 Discogs styles — this IS the main model)
  [`${BASE}/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.pb`,   "discogs-style-bs64-1.pb"],
  [`${BASE}/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.json`, "discogs-style-bs64-1.json"],

  // Classification heads
  [`${BASE}/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.pb`,   "mtg_jamendo_moodtheme-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.json`, "mtg_jamendo_moodtheme-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb`,   "mtg_jamendo_instrument-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json`, "mtg_jamendo_instrument-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/danceability/danceability-discogs-effnet-1.pb`,   "danceability-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/danceability/danceability-discogs-effnet-1.json`, "danceability-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.pb`,   "voice_instrumental-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.json`, "voice_instrumental-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.pb`,   "mood_aggressive-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.json`, "mood_aggressive-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/mood_happy/mood_happy-discogs-effnet-1.pb`,   "mood_happy-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mood_happy/mood_happy-discogs-effnet-1.json`, "mood_happy-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/mood_sad/mood_sad-discogs-effnet-1.pb`,   "mood_sad-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mood_sad/mood_sad-discogs-effnet-1.json`, "mood_sad-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.pb`,   "mood_relaxed-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.json`, "mood_relaxed-discogs-effnet-1.json"],
  [`${BASE}/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.pb`,   "tonal_atonal-discogs-effnet-1.pb"],
  [`${BASE}/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.json`, "tonal_atonal-discogs-effnet-1.json"],
];

async function download(url, filename) {
  const dest = join(MODELS_DIR, filename);
  if (existsSync(dest) && statSync(dest).size > 100) {
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

console.log(`Downloading to: ${MODELS_DIR}\n`);
for (const [url, filename] of files) {
  try {
    await download(url, filename);
  } catch (e) {
    console.error(`  ✗ FAILED ${filename}: ${e.message}`);
  }
}
console.log("\nDone.");
