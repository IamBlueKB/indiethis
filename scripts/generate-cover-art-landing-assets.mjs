/**
 * generate-cover-art-landing-assets.mjs
 *
 * Generates two sets of images for the Cover Art landing page:
 *
 *  A) Before/After comparison slider images (same subject, different treatment)
 *      → public/images/cover-art-comparison/before.png
 *      → public/images/cover-art-comparison/after.png
 *
 *  B) 6 secondary genre card images (genre-specific alt styles)
 *      → public/images/cover-art-examples/hiphop-alt.png
 *      → public/images/cover-art-examples/rnb-alt.png
 *      → public/images/cover-art-examples/pop-alt.png
 *      → public/images/cover-art-examples/indie-alt.png
 *      → public/images/cover-art-examples/electronic-alt.png
 *      → public/images/cover-art-examples/acoustic-alt.png
 *
 * Run: node scripts/generate-cover-art-landing-assets.mjs
 */

import falPkg from "@fal-ai/client";
const { fal: falClient } = falPkg;
import fs   from "fs";
import path from "path";
import https from "https";
import http  from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const EXAMPLES  = path.join(ROOT, "public", "images", "cover-art-examples");
const COMPARE   = path.join(ROOT, "public", "images", "cover-art-comparison");

// Read FAL key from env or inline (same pattern as generate-landing-examples.mjs)
import dotenv from "dotenv";
dotenv.config({ path: path.join(ROOT, ".env.local") });

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY not found in .env.local");
  process.exit(1);
}

falClient.config({ credentials: FAL_KEY });
const fal = falClient;

// Ensure output dirs exist
fs.mkdirSync(EXAMPLES, { recursive: true });
fs.mkdirSync(COMPARE,  { recursive: true });

// ─── Download helper ──────────────────────────────────────────────────────────

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

// ─── Generate helper ──────────────────────────────────────────────────────────

async function generate(prompt, outputPath, seed) {
  console.log(`  Generating: ${path.basename(outputPath)} ...`);
  try {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size:         { width: 1024, height: 1024 },
        num_inference_steps: 28,
        guidance_scale:      3.5,
        num_images:          1,
        enable_safety_checker: false,
        ...(seed ? { seed } : {}),
      },
    });
    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL in response");
    await downloadImage(imageUrl, outputPath);
    console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
    return outputPath;
  } catch (err) {
    console.error(`  ❌ Failed: ${path.basename(outputPath)} — ${err.message}`);
    throw err;
  }
}

// ─── A) Comparison slider images ─────────────────────────────────────────────

const COMPARISON_IMAGES = [
  {
    slug:   "before",
    seed:   44271,
    prompt:
      "Simple candid portrait photograph of a young woman with dark curly hair, " +
      "looking slightly off camera, natural window light from the left, " +
      "plain grey wall background, unedited and unprocessed look, " +
      "flat slightly washed out colors, phone camera quality, no makeup styling, " +
      "candid and unposed, amateur photography feel, " +
      "no text no words no letters no numbers no overlays",
  },
  {
    slug:   "after",
    seed:   44272,
    prompt:
      "Professional album cover art, dramatic portrait of a young woman with dark curly hair, " +
      "same face same hair looking slightly off camera, " +
      "Smoke and Shadow style, rich golden rim lighting from the left, " +
      "wisps of smoke curling around her shoulders dissolving into deep darkness, " +
      "Caravaggio chiaroscuro, deep crushing blacks surrounding the figure, " +
      "warm amber and gold tones in the lighting, cinematic and moody, " +
      "high contrast, professional retouching, album-ready artwork, " +
      "no text no words no letters no numbers",
  },
];

// ─── B) Genre secondary card images ──────────────────────────────────────────

const GENRE_ALT_IMAGES = [
  {
    slug:   "hiphop-alt",
    seed:   55301,
    prompt:
      "Square format album cover art, cyberpunk aesthetic, " +
      "hooded figure standing in neon-lit rain-soaked urban street at night, " +
      "electric blue and hot pink neon reflections pooling on wet pavement, " +
      "holographic advertisements glowing in the background, " +
      "futuristic dystopian city, high contrast neon colours against deep black shadows, " +
      "cinematic and immersive, " +
      "no text no words no letters no numbers, professional album cover art",
  },
  {
    slug:   "rnb-alt",
    seed:   55302,
    prompt:
      "Square format album cover art, soft watercolor painting style, " +
      "woman's profile rendered in loose expressive watercolor washes, " +
      "warm pastel tones — blush pink, pale lavender, soft peach and gold, " +
      "paint bleeds and blooms into the white paper at the edges, " +
      "ethereal and dreamlike, flowing and gentle, " +
      "fine art quality, emotionally intimate, " +
      "no text no words no letters no numbers, professional album cover art",
  },
  {
    slug:   "pop-alt",
    seed:   55303,
    prompt:
      "Square format album cover art, bold abstract geometric design, " +
      "large overlapping angular shapes and triangles arranged in a dynamic composition, " +
      "vivid electric pink, coral orange, cobalt blue and yellow-green color palette, " +
      "Bauhaus-inspired modern graphic design, flat graphic illustration, " +
      "high energy and confident, " +
      "no text no words no letters no numbers, professional album cover art",
  },
  {
    slug:   "indie-alt",
    seed:   55304,
    prompt:
      "Square format album cover art, monochrome black and white film photography, " +
      "solitary figure standing on a long empty road stretching into a flat horizon, " +
      "dramatic stormy overcast sky, heavy silver clouds, " +
      "extreme contrast, deep shadows, fine grain film texture, " +
      "melancholy and introspective, lonely and cinematic, " +
      "shot on 35mm film, high contrast print, " +
      "no text no words no letters no numbers, professional album cover art",
  },
  {
    slug:   "electronic-alt",
    seed:   55305,
    prompt:
      "Square format album cover art, psychedelic digital art, " +
      "swirling vortex of neon energy fields dissolving into kaleidoscopic liquid patterns, " +
      "electric violet, acid green, deep cyan and magenta spiraling outward, " +
      "fractal geometry meets fluid simulation, otherworldly and hypnotic, " +
      "trippy and visually intense, maximum visual complexity, " +
      "no text no words no letters no numbers, professional album cover art",
  },
  {
    slug:   "acoustic-alt",
    seed:   55306,
    prompt:
      "Square format album cover art, clean minimal gradient, " +
      "smooth gradient wash fading from warm amber at the top to soft cream and bone white at the bottom, " +
      "single acoustic guitar silhouette perfectly centered in the frame, " +
      "very minimal and airy, soft and warm, peaceful and organic, " +
      "negative space, understated elegance, " +
      "no text no words no letters no numbers, professional album cover art",
  },
];

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══ Cover Art Landing Page Asset Generation ═══\n");

  // A) Comparison slider
  console.log("A) Comparison slider images:\n");
  for (const img of COMPARISON_IMAGES) {
    const outPath = path.join(COMPARE, `${img.slug}.png`);
    await generate(img.prompt, outPath, img.seed);
    await new Promise(r => setTimeout(r, 1500)); // small delay between requests
  }

  // B) Genre alt images
  console.log("\nB) Genre secondary card images:\n");
  for (const img of GENRE_ALT_IMAGES) {
    const outPath = path.join(EXAMPLES, `${img.slug}.png`);
    await generate(img.prompt, outPath, img.seed);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("\n✅ All assets generated.\n");
}

main().catch(err => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
