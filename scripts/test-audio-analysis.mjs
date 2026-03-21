/**
 * Generates a 128 BPM beat WAV then runs BPM + key detection using the
 * same logic as src/lib/audio-analysis.ts — proves the pipeline end-to-end.
 */
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require   = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET_BPM  = 128;
const SAMPLE_RATE = 44100;
const DURATION    = 8;
const OUT_FILE    = join(__dirname, "../public/demo/beat-128bpm.wav");

// ── 1. Generate WAV ──────────────────────────────────────────────────────────

function makeBeatsWav(bpm, durationSec, sampleRate) {
  const numSamples  = Math.floor(sampleRate * durationSec);
  const beatSamples = Math.round((60 / bpm) * sampleRate);
  const dataBytes   = numSamples * 2;
  const buf         = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0);   buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);   buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36);  buf.writeUInt32LE(dataBytes, 40);

  const pcm = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++)
    pcm[i] += 0.15 * Math.sin(2 * Math.PI * 220 * i / sampleRate); // A3 bass

  for (let beat = 0; beat * beatSamples < numSamples; beat++) {
    const start   = beat * beatSamples;
    const kickLen = Math.min(Math.floor(sampleRate * 0.12), numSamples - start);
    for (let j = 0; j < kickLen; j++) {
      const env = Math.exp(-j / (sampleRate * 0.04));
      pcm[start + j] += 0.75 * env * Math.sin(2 * Math.PI * 60 * j / sampleRate);
    }
  }

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

mkdirSync(join(__dirname, "../public/demo"), { recursive: true });
const wav = makeBeatsWav(TARGET_BPM, DURATION, SAMPLE_RATE);
writeFileSync(OUT_FILE, wav);
console.log(`✓ Generated: ${(wav.length / 1024).toFixed(1)} KB  (${DURATION}s @ ${TARGET_BPM} BPM, A3 key)\n`);

// ── 2. Decode ────────────────────────────────────────────────────────────────

const { AudioContext }           = require("node-web-audio-api");
const { Essentia, EssentiaWASM } = require("essentia.js");

const audioCtx  = new AudioContext();
const arrayBuf  = readFileSync(OUT_FILE).buffer;
const audioBuf  = await audioCtx.decodeAudioData(arrayBuf.slice(0));
const channelData = audioBuf.getChannelData(0);
const sampleRate  = audioBuf.sampleRate;
console.log(`Decoded: ${audioBuf.duration.toFixed(2)}s, ${sampleRate} Hz`);

// ── 3. BPM (direct algorithm — no Web Worker) ────────────────────────────────

function lowpass240(data, sr) {
  const rc = 1 / (2 * Math.PI * 240), dt = 1 / sr, alpha = dt / (rc + dt);
  const out = new Float32Array(data.length);
  out[0] = data[0];
  for (let i = 1; i < data.length; i++) out[i] = out[i-1] + alpha*(data[i]-out[i-1]);
  return out;
}

function detectBpm(data, sr) {
  const filtered = lowpass240(data, sr);
  const n = filtered.length;
  let maxAmp = 0;
  for (let i = 0; i < n; i++) if (filtered[i] > maxAmp) maxAmp = filtered[i];
  if (maxAmp <= 0.25) return null;

  const minThreshold = 0.3 * maxAmp;
  let peaks = [], threshold = maxAmp * 0.95;
  while (peaks.length < 30 && threshold >= minThreshold) {
    peaks = [];
    let above = false;
    for (let i = 0; i < n; i++) {
      if (filtered[i] > threshold) { above = true; }
      else if (above) {
        above = false; peaks.push(i - 1);
        i += Math.floor(sr / 4) - 1;
      }
    }
    if (above) peaks.push(n - 1);
    threshold -= 0.05 * maxAmp;
  }
  if (peaks.length < 2) return null;

  const intervals = [];
  for (let i = 0; i < peaks.length; i++) {
    const maxJ = Math.min(peaks.length - i, 10);
    for (let j = 1; j < maxJ; j++) {
      const interval = peaks[i+j] - peaks[i];
      const ex = intervals.find(x => x.interval === interval);
      if (ex) ex.count++; else intervals.push({ interval, count: 1 });
    }
  }

  const tempos = [];
  for (const { interval, count } of intervals) {
    let tempo = 60 / (interval / sr);
    while (tempo < 80) tempo *= 2; while (tempo > 200) tempo /= 2;
    if (tempo < 80 || tempo > 200) continue;
    const bpm = Math.round(tempo);
    const ex = tempos.find(t => Math.abs(t.bpm - bpm) <= 1);
    if (ex) ex.score += count; else tempos.push({ bpm, score: count });
  }
  if (!tempos.length) return null;
  tempos.sort((a, b) => b.score - a.score);
  return tempos[0].bpm;
}

console.log("\nRunning BPM detection…");
const detectedBpm = detectBpm(channelData, sampleRate);

// ── 4. Key ────────────────────────────────────────────────────────────────────

console.log("Running key detection…");
const essentia  = new Essentia(EssentiaWASM);
const vector    = essentia.arrayToVector(channelData);
const keyData   = essentia.KeyExtractor(vector);
const detectedKey = keyData?.key ? `${keyData.key} ${keyData.scale}` : null;

await audioCtx.close();

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Expected BPM : ${TARGET_BPM}       → Detected: ${detectedBpm ?? "null"} ${detectedBpm === TARGET_BPM ? "✓ EXACT" : detectedBpm ? `(off by ${Math.abs(detectedBpm - TARGET_BPM)})` : "✗"}`);
console.log(`Expected Key : A major/minor → Detected: ${detectedKey ?? "null"}`);
console.log(`${"─".repeat(40)}\n`);
