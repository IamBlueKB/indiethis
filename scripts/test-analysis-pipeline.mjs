/**
 * Full analysis pipeline test on Razor's Edge audio.
 * Tests RhythmExtractor2013 BPM, KeyExtractor, energy, and VGGish ML classifiers.
 */

import { createRequire } from "module";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ── Load audio file ────────────────────────────────────────────────────────────

const audioDir  = join(__dirname, "..", "public", "audio");
const files     = readdirSync(audioDir);
// Find Razor's Edge (U+2019 apostrophe)
const audioFile = files.find(f => f.startsWith("Razor") && f.endsWith(".wav") && !f.includes("(1)"));
if (!audioFile) throw new Error("Razor's Edge.wav not found in " + audioDir);
const audioPath = join(audioDir, audioFile);
console.log(`\nAudio: ${audioPath} (${(readFileSync(audioPath).byteLength / 1024 / 1024).toFixed(1)} MB)\n`);

const rawData = readFileSync(audioPath);
const arrayBuffer = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength);

// ── Part 1: BPM / Key / Energy ────────────────────────────────────────────────

console.log("=== Part 1: BPM + Key + Energy ===\n");

const { AudioContext } = require("node-web-audio-api");
const { Essentia, EssentiaWASM } = require("essentia.js");
const essentia = new Essentia(EssentiaWASM);

// Decode at default sample rate (for BPM/key)
const ctx44 = new AudioContext();
let audioBuffer44;
try {
  audioBuffer44 = await ctx44.decodeAudioData(arrayBuffer.slice(0));
  console.log(`Decoded: ${(audioBuffer44.length / audioBuffer44.sampleRate).toFixed(1)}s @ ${audioBuffer44.sampleRate}Hz`);
} catch (e) {
  console.error("DECODE FAILED:", e.message);
  process.exit(1);
}
await ctx44.close();

const channelData = audioBuffer44.getChannelData(0);

// BPM
console.log("\n[RhythmExtractor2013]");
try {
  const t0 = Date.now();
  const vec    = essentia.arrayToVector(channelData);
  const result = essentia.RhythmExtractor2013(vec);
  vec.delete?.();
  console.log("  BPM:", result.bpm, "→ rounded:", Math.round(result.bpm));
  console.log("  Confidence:", result.confidence?.toFixed(4));
  console.log("  Time:", Date.now() - t0, "ms");
} catch (e) {
  console.error("  FAILED:", e.message, e.stack?.split("\n")[1]);
}

// Key
console.log("\n[KeyExtractor]");
try {
  const t0  = Date.now();
  const vec = essentia.arrayToVector(channelData);
  const r   = essentia.KeyExtractor(vec);
  vec.delete?.();
  console.log(`  Key: ${r.key} ${r.scale} (strength: ${r.strength?.toFixed(3)})`);
  console.log("  Time:", Date.now() - t0, "ms");
} catch (e) {
  console.error("  FAILED:", e.message);
}

// Energy
console.log("\n[Energy RMS]");
{
  let sumSq = 0;
  for (let i = 0; i < channelData.length; i++) sumSq += channelData[i] * channelData[i];
  const rms    = Math.sqrt(sumSq / channelData.length);
  const energy = Math.min(rms / 0.25, 1);
  console.log(`  RMS: ${rms.toFixed(4)} → energy: ${energy.toFixed(3)} (${Math.round(energy * 10)}/10)`);
}

// ── Part 2: VGGish ML Classification ─────────────────────────────────────────

console.log("\n\n=== Part 2: VGGish ML Classification ===\n");
console.log("Downloading models from essentia.upf.edu (may take 60-120s)...\n");

const tf = require("@tensorflow/tfjs");
console.log("TF.js version:", tf.version.tfjs, "| backend:", tf.getBackend() ?? "(not set)");

// Set backend explicitly
try {
  await tf.setBackend("cpu");
  console.log("Backend set to: cpu");
} catch (e) {
  console.warn("Could not set backend:", e.message);
}

const essentiajs = require("essentia.js");
const { EssentiaModel, EssentiaWASM: EWasm } = essentiajs;
const { EssentiaTFInputExtractor, TensorflowVGGish } = EssentiaModel;

// Decode at 16kHz (VGGish requirement)
const ctx16 = new AudioContext({ sampleRate: 16000 });
let audioBuffer16;
try {
  audioBuffer16 = await ctx16.decodeAudioData(arrayBuffer.slice(0));
  console.log(`\nDecoded to 16kHz: ${(audioBuffer16.length / 16000).toFixed(1)}s`);
} catch (e) {
  console.error("16kHz DECODE FAILED:", e.message);
  await ctx16.close();
  process.exit(1);
}
await ctx16.close();

const channels = audioBuffer16.numberOfChannels;
const length   = audioBuffer16.length;
const mono16   = new Float32Array(length);
for (let ch = 0; ch < channels; ch++) {
  const data = audioBuffer16.getChannelData(ch);
  for (let i = 0; i < length; i++) mono16[i] += data[i] / channels;
}

// Extract features
console.log("\n[EssentiaTFInputExtractor → vggish features]");
let features;
let extractor;
try {
  extractor  = new EssentiaTFInputExtractor(EWasm, "vggish");
  const t0   = Date.now();
  features   = extractor.computeFrameWise(mono16);
  console.log("  Features extracted in", Date.now() - t0, "ms");
  extractor.delete();
} catch (e) {
  console.error("  FAILED:", e.message);
  extractor?.delete();
  process.exit(1);
}

// Run ONE classifier first to test basic inference
const BASE = "https://essentia.upf.edu/models/classifiers";
const CLASSIFIERS = [
  { name: "genre_rosamerica", url: `${BASE}/genre_rosamerica/genre_rosamerica-vggish-audioset-1/model.json`,
    classes: ["classic","dance","hip-hop","jazz","pop","rhythm-and-blues","rock","speech"] },
  { name: "mood_aggressive",  url: `${BASE}/mood_aggressive/mood_aggressive-vggish-audioset-1/model.json`,
    classes: ["aggressive","not_aggressive"] },
  { name: "mood_sad",         url: `${BASE}/mood_sad/mood_sad-vggish-audioset-1/model.json`,
    classes: ["sad","not_sad"] },
  { name: "danceability",     url: `${BASE}/danceability/danceability-vggish-audioset-1/model.json`,
    classes: ["danceable","not_danceable"] },
];

for (const def of CLASSIFIERS) {
  let model = null;
  try {
    console.log(`\n[${def.name}]`);
    const t0 = Date.now();
    model = new TensorflowVGGish(tf, def.url, false);
    await model.initialize();
    console.log("  Model loaded in", Date.now() - t0, "ms");

    const t1   = Date.now();
    const preds = await model.predict(features, true);
    const scores = Array.isArray(preds[0]) ? preds[0] : Array.from(preds[0]);
    console.log("  Inference time:", Date.now() - t1, "ms");

    const results = def.classes.map((label, i) => `${label}=${scores[i]?.toFixed(3)}`).join("  ");
    console.log("  Results:", results);

    // Top class
    const top = def.classes.reduce((best, label, i) =>
      (scores[i] > scores[best.i] ? { label, i, score: scores[i] } : best),
      { label: def.classes[0], i: 0, score: scores[0] }
    );
    console.log(`  ★ Top: ${top.label} (${(top.score * 100).toFixed(1)}%)`);

  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    console.error("  Stack:", e.stack?.split("\n").slice(0, 3).join(" | "));
  } finally {
    model?.dispose();
    await new Promise(r => setTimeout(r, 100));
  }
}

console.log("\n\nDone.");
