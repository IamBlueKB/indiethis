/**
 * generate-v3-landing-images.mjs
 *
 * Generates all new images needed for Cover Art Landing v3:
 *
 * A) 4 hero images → /public/images/cover-art-hero/
 *    hero-moody.png, hero-street.png, hero-chrome.png, hero-cinematic.png
 *
 * B) 2 before/after comparison images → /public/images/cover-art-comparison/
 *    original.png (before), styled.png (after) — SAME subject
 *
 * Uses fal-ai/bytedance/seedream/v4/text-to-image (production model).
 *
 * Run: node scripts/generate-v3-landing-images.mjs
 */

import falPkg from "@fal-ai/client";
const { fal: falClient } = falPkg;
import fs   from "fs";
import path from "path";
import https from "https";
import http  from "http";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error("FAL_KEY not found in .env.local"); process.exit(1); }
falClient.config({ credentials: FAL_KEY });

const HERO_DIR    = path.join(ROOT, "public", "images", "cover-art-hero");
const COMPARE_DIR = path.join(ROOT, "public", "images", "cover-art-comparison");
fs.mkdirSync(HERO_DIR,    { recursive: true });
fs.mkdirSync(COMPARE_DIR, { recursive: true });

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(destPath);
    proto.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(destPath); });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function generate(prompt, outputPath, seed) {
  console.log(`  Generating: ${path.basename(outputPath)} ...`);
  try {
    const result = await falClient.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
      input: {
        prompt,
        aspect_ratio:   "1:1",
        guidance_scale:  7,
        num_images:      1,
        seed:            seed ?? Math.floor(Math.random() * 99999),
      },
    });
    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL in response: " + JSON.stringify(result.data));
    await downloadImage(imageUrl, outputPath);
    console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${path.basename(outputPath)} — ${err.message}`);
    // Try fallback model
    console.log(`  ↩ Trying fallback model...`);
    const result = await falClient.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size:          { width: 1024, height: 1024 },
        num_inference_steps:  28,
        guidance_scale:       3.5,
        num_images:           1,
        enable_safety_checker: false,
        seed:                 seed,
      },
    });
    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("Fallback also failed");
    await downloadImage(imageUrl, outputPath);
    console.log(`  ✅ Saved via fallback: ${path.basename(outputPath)}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

// ─── A) Hero images ───────────────────────────────────────────────────────────

const HERO_IMAGES = [
  {
    slug:   "hero-moody",
    seed:   71201,
    prompt:
      "Square 1:1 album cover art, tight cropped portrait from nose to forehead, eyes closed, " +
      "single tear on cheek, dramatic side lighting casting half the face in shadow, " +
      "warm skin tones against pure black background, intimate and raw, emotional, " +
      "professional album artwork, no text no words no letters no numbers",
  },
  {
    slug:   "hero-street",
    seed:   71202,
    prompt:
      "Square 1:1 album cover art, low angle shot of fresh white sneakers on wet asphalt at night, " +
      "puddle reflecting neon city lights in blue and pink, urban atmosphere, " +
      "shallow depth of field, streetwear culture aesthetic, cinematic composition, " +
      "professional album artwork, no text no words no letters no numbers",
  },
  {
    slug:   "hero-chrome",
    seed:   71203,
    prompt:
      "Square 1:1 album cover art, liquid chrome melting over a matte black surface, " +
      "gold and silver metallic reflections, luxury minimalist aesthetic, " +
      "smooth organic flowing shapes, high contrast, ultra detailed material rendering, " +
      "professional album artwork, no text no words no letters no numbers",
  },
  {
    slug:   "hero-cinematic",
    seed:   71204,
    prompt:
      "Square 1:1 album cover art, lone figure standing on a rooftop at dusk, " +
      "city skyline silhouetted behind them, dramatic orange and purple sky at golden hour, " +
      "shot from behind, contemplative and melancholy mood, cinematic wide angle composition, " +
      "professional album artwork, no text no words no letters no numbers",
  },
];

// ─── B) Before/After comparison images (SAME subject) ────────────────────────

const COMPARE_IMAGES = [
  {
    slug:   "original",
    seed:   71301,
    prompt:
      "Candid portrait of a young man looking down, hood up, " +
      "natural ambient lighting from a window, slightly washed out muted colors, " +
      "phone camera quality, raw and unedited look, no filters, casual and real, " +
      "square 1:1 format, no text no words no letters no numbers",
  },
  {
    slug:   "styled",
    seed:   71302,
    prompt:
      "Square 1:1 album cover art, same young man looking down with hood up, " +
      "dramatic golden rim lighting from the left side, wisps of smoke curling around him, " +
      "deep rich shadows, warm amber and gold tones, cinematic and moody, " +
      "professional album artwork in Smoke and Shadow style, " +
      "no text no words no letters no numbers",
  },
];

async function main() {
  console.log("\n═══ Cover Art Landing v3 — Image Generation ═══\n");

  console.log("A) Hero images (4):\n");
  for (const img of HERO_IMAGES) {
    await generate(img.prompt, path.join(HERO_DIR, `${img.slug}.png`), img.seed);
  }

  console.log("\nB) Before/After comparison images:\n");
  for (const img of COMPARE_IMAGES) {
    await generate(img.prompt, path.join(COMPARE_DIR, `${img.slug}.png`), img.seed);
  }

  console.log("\n✅ All images generated.\n");
  console.log("Hero images → /public/images/cover-art-hero/");
  console.log("Comparison  → /public/images/cover-art-comparison/\n");
}

main().catch(err => { console.error("\nFatal:", err.message); process.exit(1); });
