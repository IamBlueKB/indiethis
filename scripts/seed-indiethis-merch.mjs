/**
 * Seed 3 IndieThis-branded merch products for admin@indiethis.com.
 * Safe to run multiple times — skips products that already exist.
 * Usage: node scripts/seed-indiethis-merch.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PLATFORM_EMAIL = "admin@indiethis.com";

const PRODUCTS = [
  {
    title:           "IndieThis Classic Tee",
    description:     "The official IndieThis tee. 100% cotton, unisex fit. Wear your independence.",
    imageUrl:        "/images/brand/indiethis-logo-dark-bg.svg",
    fulfillmentType: "SELF_FULFILLED",
    shippingCost:    5.99,
    returnPolicy:    "All sales final on branded merch. Contact admin@indiethis.com for defective items.",
    processingDays:  5,
    variants: [
      { size: "S",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "M",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "L",   color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "XL",  color: "Black", colorCode: "#0A0A0A", retailPrice: 29.99 },
      { size: "XXL", color: "Black", colorCode: "#0A0A0A", retailPrice: 32.99 },
    ],
  },
  {
    title:           "IndieThis Hoodie",
    description:     "Heavyweight pullover hoodie. Kangaroo pocket, ribbed cuffs. Built for the studio.",
    imageUrl:        "/images/brand/indiethis-logo-dark-bg.svg",
    fulfillmentType: "SELF_FULFILLED",
    shippingCost:    7.99,
    returnPolicy:    "All sales final on branded merch. Contact admin@indiethis.com for defective items.",
    processingDays:  5,
    variants: [
      { size: "S",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "M",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "L",   color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
      { size: "XL",  color: "Black", colorCode: "#0A0A0A", retailPrice: 54.99 },
    ],
  },
  {
    title:           "IndieThis Snapback",
    description:     "Structured snapback with the IndieThis icon embroidered on the front. One size fits most.",
    imageUrl:        "/images/brand/indiethis-icon.svg",
    fulfillmentType: "SELF_FULFILLED",
    shippingCost:    4.99,
    returnPolicy:    "All sales final on branded merch. Contact admin@indiethis.com for defective items.",
    processingDays:  5,
    variants: [
      { size: "OS", color: "Black", colorCode: "#0A0A0A", retailPrice: 27.99 },
    ],
  },
];

async function main() {
  const platform = await db.user.findUnique({
    where:  { email: PLATFORM_EMAIL },
    select: { id: true },
  });

  if (!platform) {
    console.error(`❌ Account ${PLATFORM_EMAIL} not found. Run reset-admin-password.mjs first.`);
    process.exit(1);
  }

  // Ensure artistSlug is set — required for explore page links
  await db.user.update({
    where: { id: platform.id },
    data:  { artistSlug: "indiethis", artistName: "IndieThis" },
  });
  console.log("✅ artistSlug: indiethis");

  const created = [];
  const skipped = [];

  for (const p of PRODUCTS) {
    const existing = await db.merchProduct.findFirst({
      where:  { artistId: platform.id, title: p.title },
      select: { id: true },
    });

    if (existing) {
      skipped.push(p.title);
      continue;
    }

    await db.merchProduct.create({
      data: {
        artistId:        platform.id,
        fulfillmentType: p.fulfillmentType,
        title:           p.title,
        description:     p.description,
        imageUrl:        p.imageUrl,
        shippingCost:    p.shippingCost,
        returnPolicy:    p.returnPolicy,
        processingDays:  p.processingDays,
        markup:          0,
        isActive:        true,
        isFeatured:      true,
        variants: {
          create: p.variants.map((v) => ({
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

    created.push(p.title);
  }

  if (created.length > 0) console.log("✅ Created:", created.join(", "));
  if (skipped.length > 0) console.log("⏭  Skipped:", skipped.join(", "));
  if (created.length === 0 && skipped.length === 0) console.log("Nothing to do.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
