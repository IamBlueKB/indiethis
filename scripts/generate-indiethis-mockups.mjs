/**
 * Generates Printful mockups for the 3 IndieThis products and updates the DB.
 *
 * 1. Uploads the IndieThis logo to UploadThing (public URL)
 * 2. Fetches black variants from Printful for each product
 * 3. Generates mockups with the logo on the front
 * 4. Updates product imageUrl + converts to POD in DB
 *
 * Usage: node scripts/generate-indiethis-mockups.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { UTApi } from "uploadthing/server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db        = new PrismaClient();
const utapi     = new UTApi();

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const BASE_URL         = "https://api.printful.com";

// Pre-uploaded PNG URLs (populated by uploadLogo, reused across runs)
const LOGO_URLS = {
  "indiethis-logo-dark-bg.svg": "https://gcghrqi4kv.ufs.sh/f/rOmWbMsp1xCGsxj2tsv58v2kwQRzSxuYAIcqFaXdUBy16gtn",
  "indiethis-icon.svg":         "https://gcghrqi4kv.ufs.sh/f/rOmWbMsp1xCGsqiMe5v58v2kwQRzSxuYAIcqFaXdUBy16gtn",
};

// Printful catalog IDs — set skip: true once mockup is confirmed
const PRODUCTS = [
  { title: "IndieThis Classic Tee",  printfulProductId: 71,  logo: "indiethis-logo-dark-bg.svg", skip: true },
  { title: "IndieThis Hoodie",       printfulProductId: 146, logo: "indiethis-logo-dark-bg.svg", skip: true },
  { title: "IndieThis Snapback",     printfulProductId: 77,  logo: "indiethis-icon.svg"         },
];

async function pf(endpoint, options = {}, attempt = 0) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
      "Content-Type":  "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 429 && attempt < 5) {
    const retry = await res.json().catch(() => ({}));
    const wait  = (retry.result?.match(/\d+/)?.[0] ?? 30) * 1000 + 2000;
    console.log(`  Rate limited — waiting ${wait/1000}s...`);
    await new Promise(r => setTimeout(r, wait));
    return pf(endpoint, options, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful ${res.status} on ${endpoint}: ${body}`);
  }
  const json = await res.json();
  return json.result;
}

async function uploadLogo(filename) {
  const svgPath  = path.join(__dirname, "../public/images/brand", filename);
  const svgBuf   = fs.readFileSync(svgPath);

  // Convert SVG → PNG using sharp (Printful requires raster images)
  const sharp    = (await import("sharp")).default;
  const pngBuf   = await sharp(svgBuf).resize(1200, 1200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const pngName  = filename.replace(".svg", ".png");
  const blob     = new Blob([pngBuf], { type: "image/png" });
  const file     = new File([blob], pngName, { type: "image/png" });

  console.log(`  Uploading ${pngName} to UploadThing...`);
  const res = await utapi.uploadFiles(file);
  if (res.error) throw new Error(`UploadThing error: ${res.error.message}`);
  const url = res.data.ufsUrl ?? res.data.url;
  console.log(`  ✅ Uploaded: ${url}`);
  return url;
}

async function getBlackVariantIds(printfulProductId) {
  const variants = await pf(`/products/${printfulProductId}`);
  const all = variants.variants ?? variants;
  // Pick black/dark variants — any with "Black" in name
  const black = all.filter(v =>
    v.color?.toLowerCase().includes("black") ||
    v.name?.toLowerCase().includes("black")
  );
  // Take up to 3 variants so mockup generates quickly
  const picked = (black.length > 0 ? black : all).slice(0, 3);
  console.log(`  Variants (${picked.length}): ${picked.map(v => v.id).join(", ")}`);
  return picked.map(v => v.id);
}

async function getFirstPlacement(printfulProductId) {
  const data = await pf(`/mockup-generator/printfiles/${printfulProductId}`);
  const placements = Object.keys(data?.available_placements ?? {});
  // prefer "front", else first available
  return placements.includes("front") ? "front" : placements[0];
}

async function generateMockup(printfulProductId, variantIds, designUrl) {
  const placement = await getFirstPlacement(printfulProductId);
  console.log(`  Placement: ${placement}`);
  console.log(`  Submitting mockup task...`);
  const task = await pf(`/mockup-generator/create-task/${printfulProductId}`, {
    method: "POST",
    body:   JSON.stringify({
      variant_ids: variantIds,
      files: [{
        placement,
        image_url: designUrl,
        position: {
          area_width:  1800,
          area_height: 2400,
          width:       1200,
          height:      1200,
          top:         400,
          left:        300,
        },
      }],
    }),
  });
  const taskKey = task.task_key;
  console.log(`  Task key: ${taskKey} — polling...`);

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const result = await pf(`/mockup-generator/task?task_key=${taskKey}`);
    if (result.status === "completed" && result.mockups?.[0]) {
      const url = result.mockups[0].mockup_url;
      console.log(`  ✅ Mockup: ${url}`);
      return url;
    }
    if (result.status === "failed") throw new Error("Mockup generation failed");
    process.stdout.write(".");
  }
  throw new Error("Mockup generation timed out");
}

async function main() {
  // Upload logos — skip if already uploaded
  const logoUrls = { ...LOGO_URLS };
  const logos = [...new Set(PRODUCTS.map(p => p.logo))].filter(l => !logoUrls[l]);
  for (const logo of logos) {
    logoUrls[logo] = await uploadLogo(logo);
  }

  // Get admin account
  const admin = await db.user.findUnique({
    where:  { email: "admin@indiethis.com" },
    select: { id: true },
  });
  if (!admin) throw new Error("admin@indiethis.com not found");

  for (const product of PRODUCTS) {
    if (product.skip) { console.log(`\n── ${product.title} — skipped ──`); continue; }
    console.log(`\n── ${product.title} ──`);
    const designUrl = logoUrls[product.logo];

    // Get black variant IDs from Printful
    const variantIds = await getBlackVariantIds(product.printfulProductId);

    // Generate mockup
    const mockupUrl = await generateMockup(product.printfulProductId, variantIds, designUrl);

    // Update the product in DB
    const existing = await db.merchProduct.findFirst({
      where:  { artistId: admin.id, title: product.title },
      select: { id: true },
    });

    if (!existing) {
      console.log(`  ⚠️  Product not found in DB — skipping update`);
      continue;
    }

    await db.merchProduct.update({
      where: { id: existing.id },
      data:  {
        imageUrl:        mockupUrl,
        imageUrls:       [mockupUrl],
        fulfillmentType: "SELF_FULFILLED", // keep as self-fulfilled, just update image
      },
    });

    console.log(`  ✅ DB updated for ${product.title}`);
  }

  console.log("\n✅ All done! Refresh /explore to see the mockups.");
}

main()
  .catch(e => { console.error("\n❌", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
