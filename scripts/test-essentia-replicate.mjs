/**
 * Test script: uploads Razor's Edge.wav to Replicate Files API,
 * then runs mtg/music-classifiers with all 3 model types and logs raw output.
 *
 * The model returns a URI to a JSON file, not inline JSON.
 * This script fetches those URIs and logs the actual data.
 *
 * Run with: node --env-file=.env.local scripts/test-essentia-replicate.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Replicate from "replicate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = "fb1f50036eaaf8918ca419f236b0b48d28bc3ef20b4b3f915cf9ed1a3d3064ab";
const MODEL = `mtg/music-classifiers:${VERSION}`;

// Find the Razor's Edge file
const audioDir = join(__dirname, "../public/audio");
const files = readdirSync(audioDir);
const razorsEdgeFile = files.find(f => f.toLowerCase().includes("razor"));
if (!razorsEdgeFile) { console.error("Could not find Razor's Edge file"); process.exit(1); }

const AUDIO_PATH = join(audioDir, razorsEdgeFile);
console.log("[test] Using file:", razorsEdgeFile);

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Upload file once, reuse for all 3 model types
console.log("[test] Uploading to Replicate Files API...");
const fileBuffer = readFileSync(AUDIO_PATH);
const blob = new Blob([fileBuffer], { type: "audio/wav" });
const file = await replicate.files.create(blob, { filename: "razors-edge.wav" });
console.log("[test] Uploaded:", file.urls.get);

const MODEL_TYPES = ["effnet-discogs", "musicnn-msd", "vggish-audioset"];

for (const modelType of MODEL_TYPES) {
  console.log(`\n[test] Running model_type: ${modelType} ...`);
  try {
    const outputUri = await replicate.run(MODEL, {
      input: { audio: file.urls.get, model_type: modelType },
    });

    console.log(`[test] Output URI: ${outputUri}`);

    // Fetch the actual JSON from the output URI
    const resp = await fetch(outputUri);
    const data = await resp.json();

    console.log(`\n========== ${modelType} RAW OUTPUT ==========`);
    console.log(JSON.stringify(data, null, 2));
    console.log(`========== END ${modelType} ==========\n`);

    if (typeof data === "object" && data !== null) {
      console.log(`Top-level keys [${modelType}]:`, Object.keys(data));
    } else if (Array.isArray(data)) {
      console.log(`Array length [${modelType}]:`, data.length);
      console.log(`First item [${modelType}]:`, JSON.stringify(data[0], null, 2));
    }
  } catch (err) {
    console.error(`[test] ${modelType} failed:`, err.message);
  }
}

console.log("\n[test] All model types complete.");
