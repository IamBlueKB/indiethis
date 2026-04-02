/**
 * POST /api/dashboard/merch/platform-setup
 *
 * One-time setup: creates 3 IndieThis-branded merch products
 * attached to admin@indiethis.com, marked isFeatured: true.
 * PLATFORM_ADMIN only. Safe to call multiple times — skips products
 * that already exist (matched by title).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PLATFORM_EMAIL = "admin@indiethis.com";

const PRODUCTS = [
  {
    title:           "IndieThis Classic Tee",
    description:     "The official IndieThis tee. 100% cotton, unisex fit. Wear your independence.",
    imageUrl:        "/images/brand/indiethis-logo-dark-bg.svg",
    fulfillmentType: "SELF_FULFILLED" as const,
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
    fulfillmentType: "SELF_FULFILLED" as const,
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
    fulfillmentType: "SELF_FULFILLED" as const,
    shippingCost:    4.99,
    returnPolicy:    "All sales final on branded merch. Contact admin@indiethis.com for defective items.",
    processingDays:  5,
    variants: [
      { size: "OS", color: "Black", colorCode: "#0A0A0A", retailPrice: 27.99 },
    ],
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find the platform account
  const platform = await db.user.findUnique({
    where:  { email: PLATFORM_EMAIL },
    select: { id: true },
  });

  if (!platform) {
    return NextResponse.json(
      { error: `Platform account ${PLATFORM_EMAIL} not found. Create it first.` },
      { status: 404 },
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const p of PRODUCTS) {
    const existing = await db.merchProduct.findFirst({
      where: { artistId: platform.id, title: p.title },
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
            size:       v.size,
            color:      v.color,
            colorCode:  v.colorCode,
            retailPrice: v.retailPrice,
            basePrice:   0,
            inStock:     true,
          })),
        },
      },
    });

    created.push(p.title);
  }

  return NextResponse.json({
    success: true,
    created,
    skipped,
    message: created.length > 0
      ? `Created ${created.length} product${created.length !== 1 ? "s" : ""}: ${created.join(", ")}`
      : "All products already exist.",
  });
}
