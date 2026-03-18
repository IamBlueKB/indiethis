// Generates 3 short WAV demo tracks in /public/demo/
// Each is a ~3s sine-wave tone at a different pitch.
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/demo");
mkdirSync(outDir, { recursive: true });

function makeToneWav(freqHz, durationSec = 3, sampleRate = 22050) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes  = numSamples * 2; // 16-bit PCM

  const buf = Buffer.alloc(44 + dataBytes);

  // RIFF header
  buf.write("RIFF",  0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE",  8);
  buf.write("fmt ",  12);
  buf.writeUInt32LE(16, 16);          // chunk size
  buf.writeUInt16LE(1,  20);          // PCM
  buf.writeUInt16LE(1,  22);          // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2,  32);          // block align
  buf.writeUInt16LE(16, 34);          // bits per sample
  buf.write("data",  36);
  buf.writeUInt32LE(dataBytes, 40);

  // PCM samples — sine wave with short fade in/out
  const fadeLen = Math.floor(sampleRate * 0.05); // 50ms fade
  for (let i = 0; i < numSamples; i++) {
    let amp = 0.6;
    if (i < fadeLen)                  amp *= i / fadeLen;
    if (i > numSamples - fadeLen)     amp *= (numSamples - i) / fadeLen;
    const sample = Math.round(amp * 32767 * Math.sin(2 * Math.PI * freqHz * i / sampleRate));
    buf.writeInt16LE(sample, 44 + i * 2);
  }

  return buf;
}

const tracks = [
  { name: "midnight-drive.wav", freq: 220, label: "Midnight Drive (A3)" },
  { name: "golden-hour.wav",    freq: 277, label: "Golden Hour (C#4)" },
  { name: "neon-nights.wav",    freq: 330, label: "Neon Nights (E4)" },
];

for (const { name, freq, label } of tracks) {
  const wav = makeToneWav(freq, 4);
  writeFileSync(join(outDir, name), wav);
  console.log(`✓ ${label} → public/demo/${name} (${(wav.length / 1024).toFixed(1)} KB)`);
}

console.log("\nServed at /demo/*.wav — update track fileUrls to match.");
