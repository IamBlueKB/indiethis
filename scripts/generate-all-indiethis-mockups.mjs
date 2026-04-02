/**
 * Generates IndieThis-branded mockups for all 7 product categories,
 * deletes the old seeded products, and saves fresh ones to the DB.
 *
 * Usage: node scripts/generate-all-indiethis-mockups.mjs
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
const PLATFORM_EMAIL   = "admin@indiethis.com";

// Pre-uploaded PNG design URLs (logo & icon already on UploadThing CDN)
const DESIGNS = {
  logo: "https://gcghrqi4kv.ufs.sh/f/rOmWbMsp1xCGsxj2tsv58v2kwQRzSxuYAIcqFaXdUBy16gtn",
  icon: "https://gcghrqi4kv.ufs.sh/f/rOmWbMsp1xCGsqiMe5v58v2kwQRzSxuYAIcqFaXdUBy16gtn",
};

// One representative product per category
const CATALOG = [
  {
    title:            "IndieThis Classic Tee",
    description:      "The official IndieThis tee. Soft unisex fit, 100% cotton. Wear your independence.",
    printfulProductId: 71,
    design:           "logo",
    shippingCost:     4.99,
    variants: [
      { size: "S",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "M",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "L",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "XL",  color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "2XL", color: "Black", colorCode: "#0A0A0A", retailPrice: 32.99 },
    ],
  },
  {
    title:            "IndieThis Hoodie",
    description:      "Heavyweight pullover hoodie. Kangaroo pocket, ribbed cuffs. Built for the studio.",
    printfulProductId: 146,
    design:           "logo",
    shippingCost:     6.99,
    variants: [
      { size: "S",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "M",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "L",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "XL",  color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "2XL", color: "Black", colorCode: "#0A0A0A", retailPrice: 59.99 },
    ],
  },
  {
    title:            "IndieThis Snapback",
    description:      "Flat-brim snapback with the IndieThis icon embroidered on the front.",
    printfulProductId: 77,
    design:           "icon",
    shippingCost:     4.99,
    variants: [
      { size: "OS", color: "Black", colorCode: "#0A0A0A", retailPrice: 34.99 },
    ],
  },
  {
    title:            "IndieThis Dad Hat",
    description:      "Unstructured low-profile cotton twill cap. The icon on the front, clean everyday wear.",
    printfulProductId: 162,
    design:           "icon",
    shippingCost:     4.99,
    variants: [
      { size: "OS", color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
    ],
  },
  {
    title:            "IndieThis Poster",
    description:      "High-quality matte poster. Frame it, hang it, rep the movement.",
    printfulProductId: 1,
    design:           "logo",
    shippingCost:     3.99,
    variants: [
      { size: '12"×18"', color: "White", colorCode: "#FFFFFF", retailPrice: 19.99 },
      { size: '18"×24"', color: "White", colorCode: "#FFFFFF", retailPrice: 24.99 },
      { size: '24"×36"', color: "White", colorCode: "#FFFFFF", retailPrice: 34.99 },
    ],
  },
  {
    title:            "IndieThis Mug",
    description:      "11oz ceramic mug with the IndieThis logo. Dishwasher safe. Morning fuel for creators.",
    printfulProductId: 19,
    design:           "logo",
    shippingCost:     4.99,
    variants: [
      { size: "11oz", color: "White", colorCode: "#FFFFFF", retailPrice: 19.99 },
    ],
  },
  {
    title:            "IndieThis Phone Case",
    description:      "Dual-layer tough case with the IndieThis logo. Fits iPhone and Samsung Galaxy.",
    printfulProductId: 92,
    design:           "logo",
    shippingCost:     3.99,
    variants: [
      { size: "iPhone 15", color: "Black", colorCode: "#0A0A0A", retailPrice: 24.99 },
      { size: "iPhone 14", color: "Black", colorCode: "#0A0A0A", retailPrice: 24.99 },
    ],
  },
  {
    title:            "IndieThis Sticker",
    description:      "Waterproof die-cut IndieThis sticker. Stick it anywhere.",
    printfulProductId: 352,
    design:           "icon",
    shippingCost:     1.99,
    variants: [
      { size: '3"',  color: "White", colorCode: "#FFFFFF", retailPrice: 4.99 },
      { size: '4"',  color: "White", colorCode: "#FFFFFF", retailPrice: 5.99 },
    ],
  },
];

// ─── Printful helpers ─────────────────────────────────────────────────────────

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
    const json = await res.json().catch(() => ({}));
    const secs  = (String(json.result ?? "").match(/\d+/) ?? ["30"])[0];
    const wait  = parseInt(secs) * 1000 + 2000;
    console.log(`  Rate limited — waiting ${wait / 1000}s...`);
    await new Promise(r => setTimeout(r, wait));
    return pf(endpoint, options, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful ${res.status} on ${endpoint}: ${body}`);
  }
  return (await res.json()).result;
}

async function getBlackVariantIds(productId) {
  const data     = await pf(`/products/${productId}`);
  const variants = data.variants ?? data;
  const black    = variants.filter(v =>
    v.color?.toLowerCase().includes("black") ||
    v.name?.toLowerCase().includes("black")
  );
  return (black.length > 0 ? black : variants).slice(0, 3).map(v => v.id);
}

async function getFirstPlacement(productId) {
  const data       = await pf(`/mockup-generator/printfiles/${productId}`);
  const placements = Object.keys(data?.available_placements ?? {});
  if (placements.includes("front"))     return "front";
  if (placements.includes("default"))   return "default";
  return placements[0];
}

async function generateAndStore(productId, designUrl) {
  const placement  = await getFirstPlacement(productId);
  const variantIds = await getBlackVariantIds(productId);
  console.log(`  Placement: ${placement} | Variants: ${variantIds.join(", ")}`);

  const task = await pf(`/mockup-generator/create-task/${productId}`, {
    method: "POST",
    body: JSON.stringify({
      variant_ids: variantIds,
      files: [{
        placement,
        image_url: designUrl,
        position: { area_width: 1800, area_height: 2400, width: 1200, height: 1200, top: 400, left: 300 },
      }],
    }),
  });
  const taskKey = task.task_key;
  console.log(`  Task: ${taskKey} — polling...`);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const result = await pf(`/mockup-generator/task?task_key=${taskKey}`);
    if (result.status === "completed" && result.mockups?.[0]) {
      const tmpUrl  = result.mockups[0].mockup_url;
      // Download and re-upload to UploadThing for permanent storage
      const buf     = await (await fetch(tmpUrl)).arrayBuffer();
      const fname   = `indiethis-${productId}-mockup.png`;
      const up      = await utapi.uploadFiles(new File([buf], fname, { type: "image/png" }));
      if (up.error) throw new Error(`UploadThing: ${up.error.message}`);
      const url     = up.data.ufsUrl ?? up.data.url;
      console.log(`  ✅ ${url.slice(0, 60)}...`);
      return url;
    }
    if (result.status === "failed") throw new Error("Mockup generation failed");
    process.stdout.write(".");
  }
  throw new Error("Mockup generation timed out");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const admin = await db.user.findUnique({
    where:  { email: PLATFORM_EMAIL },
    select: { id: true },
  });
  if (!admin) throw new Error(`${PLATFORM_EMAIL} not found`);

  // Delete all existing IndieThis products
  const deleted = await db.merchProduct.deleteMany({ where: { artistId: admin.id } });
  console.log(`🗑  Deleted ${deleted.count} existing IndieThis products\n`);

  for (const product of CATALOG) {
    console.log(`── ${product.title} (Printful #${product.printfulProductId}) ──`);
    const designUrl = DESIGNS[product.design];

    let mockupUrl;
    try {
      mockupUrl = await generateAndStore(product.printfulProductId, designUrl);
    } catch (err) {
      console.error(`  ❌ ${err.message} — skipping`);
      continue;
    }

    await db.merchProduct.create({
      data: {
        artistId:        admin.id,
        fulfillmentType: "SELF_FULFILLED",
        title:           product.title,
        description:     product.description,
        imageUrl:        mockupUrl,
        imageUrls:       [mockupUrl],
        shippingCost:    product.shippingCost,
        returnPolicy:    "All sales final on branded merch. Contact admin@indiethis.com for defective items.",
        processingDays:  5,
        markup:          0,
        isActive:        true,
        isFeatured:      true,
        variants: {
          create: product.variants.map(v => ({
            size:        v.size,
            color:       v.color,
            colorCode:   v.colorCode,
            retailPrice: v.retailPrice,
            basePrice:   0,
            inStock:     true,
          })),
        },
      },
    });

    console.log(`  ✅ Saved to DB\n`);
    // Brief pause between products to avoid rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log("✅ All done! Refresh /explore to see all IndieThis products.");
}

main()
  .catch(e => { console.error("\n❌", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
