/**
 * Generate preview images for all VideoStyle records using fal.ai FLUX.
 * Saves JPGs to public/images/video-styles/[slug].jpg
 * Run: node scripts/generate-style-images.mjs
 */

import { fal } from "@fal-ai/client";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/images/video-styles");

// Load .env.local
import { config } from "dotenv";
config({ path: join(__dirname, "../.env.local") });

fal.config({ credentials: process.env.FAL_KEY });

const prisma = new PrismaClient();

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Music video-themed suffix for each image — keeps it cinematic
const SUFFIX = "music video still frame, professional cinematography, 16:9 aspect ratio, high quality";

async function generateStyle(style) {
  const slug = toSlug(style.name);
  const outPath = join(OUT_DIR, `${slug}.jpg`);

  console.log(`\n[${style.sortOrder}] ${style.name} → ${slug}.jpg`);

  const prompt = `${style.promptBase}, ${SUFFIX}`;

  try {
    const result = await fal.run("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size: "landscape_16_9",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      },
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned");

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buf);
    console.log(`  ✓ Saved (${(buf.length / 1024).toFixed(0)}KB)`);
    return slug;
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    return null;
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const styles = await prisma.videoStyle.findMany({ orderBy: { sortOrder: "asc" } });
  console.log(`Generating images for ${styles.length} styles…\n`);

  // Run 3 at a time to avoid rate limits
  const results = [];
  for (let i = 0; i < styles.length; i += 3) {
    const batch = styles.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(generateStyle));
    results.push(...batchResults);
  }

  const succeeded = results.filter(Boolean).length;
  console.log(`\nDone: ${succeeded}/${styles.length} images generated`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
