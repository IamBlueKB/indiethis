/**
 * Test Replicate model directly with Razor's Edge.wav
 * Uploads the file to Replicate file storage, runs the full analysis model,
 * and prints all 10 model outputs.
 */
import { readFileSync } from "fs";

const TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION = "f966cf9a214914965edb42de6591ec77cb01933943bfd5555b245d0fb7e80ffe";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public", "audio", "Razor's Edge.wav");

const fileData = readFileSync(FILE);
console.log(`File: ${FILE}`);
console.log(`Size: ${(fileData.length / 1024 / 1024).toFixed(1)} MB`);

// Upload to Replicate file storage
console.log("\nUploading to Replicate...");
const uploadRes = await fetch("https://api.replicate.com/v1/files", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "audio/wav",
    "Content-Length": String(fileData.length),
  },
  body: fileData,
});

const uploadData = await uploadRes.json();
if (!uploadRes.ok) {
  console.error("Upload failed:", uploadData);
  process.exit(1);
}

const audioUrl = uploadData.urls?.get ?? uploadData.url;
console.log("Audio URL:", audioUrl);

// Create prediction
const h = { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const createRes = await fetch("https://api.replicate.com/v1/predictions", {
  method: "POST",
  headers: h,
  body: JSON.stringify({ version: VERSION, input: { audio_url: audioUrl } }),
});

const pred = await createRes.json();
if (!createRes.ok) {
  console.error("Create prediction failed:", pred);
  process.exit(1);
}
console.log(`\nPrediction ID: ${pred.id}`);
console.log("Polling...\n");

const start = Date.now();
while (Date.now() - start < 300_000) {
  await new Promise((r) => setTimeout(r, 5000));
  const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: h });
  const d = await pr.json();
  process.stdout.write(`[${Math.round((Date.now() - start) / 1000)}s] ${d.status}\n`);

  if (d.status === "succeeded") {
    const o = d.output;
    console.log("\n========= RAZOR'S EDGE ANALYSIS =========");
    console.log(`BPM:         ${o.bpm}`);
    console.log(`Key:         ${o.musicalKey}`);
    console.log(`Energy:      ${o.energy.toFixed(3)}`);
    console.log(`Danceability:${o.danceability.toFixed(3)}`);
    console.log(`Vocal:       ${o.isVocal}`);
    console.log(`Tonal:       ${o.isTonal}`);
    console.log(`\nTop Genres:`);
    o.genres.slice(0, 5).forEach((g) => console.log(`  ${g.label}: ${g.score.toFixed(3)}`));
    console.log(`\nTop Moods:`);
    o.moods.forEach((m) => console.log(`  ${m.label}: ${m.score.toFixed(3)}`));
    console.log(`\nTop Instruments:`);
    o.instruments.slice(0, 5).forEach((i) => console.log(`  ${i.label}: ${i.score.toFixed(3)}`));
    console.log("=========================================\n");
    console.log("Full JSON:", JSON.stringify(o, null, 2));
    process.exit(0);
  }

  if (d.status === "failed" || d.status === "canceled") {
    console.error("FAILED:", d.error);
    if (d.logs) console.error("LOGS:", d.logs);
    process.exit(1);
  }
}

console.error("Timed out after 5 minutes");
process.exit(1);
