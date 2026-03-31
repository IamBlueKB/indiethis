import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderateContent } from "@/lib/agents/content-moderation";

// GET /api/dashboard/merch
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await db.merchProduct.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        select: { id: true, size: true, color: true, colorCode: true, retailPrice: true, basePrice: true, inStock: true, stockQuantity: true },
        orderBy: { retailPrice: "asc" },
      },
      orderItems: {
        select: { id: true, unitPrice: true, subtotal: true, order: { select: { artistEarnings: true } } },
      },
    },
  });

  return NextResponse.json({ products });
}

// POST /api/dashboard/merch
//
// Accepts three shapes:
//   A) POD wizard payload  — `variants` array with printfulVariantId + retail prices
//   B) Self-fulfilled      — `fulfillmentType: "SELF_FULFILLED"` + manual variants
//   C) Simple markup-based — `markup` flat markup applied to all catalog variants (legacy)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    fulfillmentType?:  "POD" | "SELF_FULFILLED";
    printfulProductId?: number;
    title:             string;
    description?:      string;
    imageUrl:          string;
    imageUrls?:        string[];
    designUrl?:        string;
    placement?:        string;
    isActive?:         boolean;
    markup?:           number;
    returnPolicy?:     string;
    processingDays?:   number;
    variants?: {
      printfulVariantId?: number;
      size:               string;
      color:              string;
      colorCode:          string;
      basePrice:          number;
      retailPrice:        number;
      imageUrl?:          string;
      stockQuantity?:     number;
    }[];
  };

  const {
    fulfillmentType = "POD",
    title, description, imageUrl, imageUrls = [],
    printfulProductId, markup, variants,
    returnPolicy, processingDays,
    isActive,
  } = body;

  if (!title?.trim() || !imageUrl?.trim()) {
    return NextResponse.json({ error: "title and imageUrl are required" }, { status: 400 });
  }

  // ── Shape B: Self-fulfilled ────────────────────────────────────────────────
  if (fulfillmentType === "SELF_FULFILLED") {
    if (!returnPolicy?.trim()) {
      return NextResponse.json({ error: "Return policy is required for self-fulfilled products" }, { status: 400 });
    }
    if (!variants || variants.length === 0) {
      return NextResponse.json({ error: "At least one variant is required" }, { status: 400 });
    }
    for (const v of variants) {
      if (v.retailPrice <= 0) {
        return NextResponse.json({ error: `Price for ${v.color} ${v.size} must be greater than $0` }, { status: 400 });
      }
    }

    const product = await db.merchProduct.create({
      data: {
        artistId:       session.user.id,
        fulfillmentType: "SELF_FULFILLED",
        title:          title.trim(),
        description:    description?.trim() ?? null,
        imageUrl:       imageUrl.trim(),
        imageUrls:      imageUrls,
        markup:         0,
        returnPolicy:   returnPolicy.trim(),
        processingDays: processingDays ?? 3,
        isActive:       isActive ?? true,
      },
    });

    await db.merchVariant.createMany({
      data: variants.map((v) => ({
        productId:     product.id,
        size:          v.size || "One Size",
        color:         v.color || "",
        colorCode:     v.colorCode || "#000000",
        imageUrl:      v.imageUrl ?? null,
        basePrice:     0,
        retailPrice:   v.retailPrice,
        inStock:       true,
        stockQuantity: v.stockQuantity ?? null,
      })),
    });

    void moderateContent(
      session.user.id,
      "MERCH",
      product.id,
      [product.title, product.description].filter(Boolean).join(" "),
    ).catch(() => {});

    return NextResponse.json({ product }, { status: 201 });
  }

  // ── Shape A: POD with explicit variants array ─────────────────────────────
  if (!printfulProductId) {
    return NextResponse.json({ error: "printfulProductId is required for POD products" }, { status: 400 });
  }

  if (variants && variants.length > 0) {
    // Validate all variants have retail > base
    for (const v of variants) {
      if (v.retailPrice <= (v.basePrice ?? 0)) {
        return NextResponse.json(
          { error: `Retail price for ${v.color} ${v.size} must be greater than base cost $${(v.basePrice ?? 0).toFixed(2)}` },
          { status: 400 },
        );
      }
    }

    const product = await db.merchProduct.create({
      data: {
        artistId:          session.user.id,
        fulfillmentType:   "POD",
        title:             title.trim(),
        description:       description?.trim() ?? null,
        imageUrl:          imageUrl.trim(),
        printfulProductId: printfulProductId,
        markup:            0,
        isActive:          isActive ?? true,
      },
    });

    await db.merchVariant.createMany({
      data: variants.map((v) => ({
        productId:         product.id,
        printfulVariantId: v.printfulVariantId,
        size:              v.size || "One Size",
        color:             v.color || "",
        colorCode:         v.colorCode || "#000000",
        imageUrl:          v.imageUrl ?? null,
        basePrice:         v.basePrice,
        retailPrice:       v.retailPrice,
        inStock:           true,
      })),
    });

    void moderateContent(
      session.user.id,
      "MERCH",
      product.id,
      [product.title, product.description].filter(Boolean).join(" "),
    ).catch(() => {});

    return NextResponse.json({ product }, { status: 201 });
  }

  // ── Shape C: markup-based (legacy / fallback) ────────────────────────────
  const { getCatalogEntry } = await import("@/lib/printful-catalog");
  const markupFloat  = parseFloat(String(markup ?? 0)) || 0;
  const catalogEntry = await getCatalogEntry(printfulProductId);

  const product = await db.merchProduct.create({
    data: {
      artistId:          session.user.id,
      fulfillmentType:   "POD",
      title:             title.trim(),
      description:       description?.trim() ?? null,
      imageUrl:          imageUrl.trim(),
      printfulProductId: printfulProductId,
      markup:            markupFloat,
      isActive:          isActive ?? true,
    },
  });

  if (catalogEntry && catalogEntry.variants.length > 0) {
    await db.merchVariant.createMany({
      data: catalogEntry.variants.map((v) => ({
        productId:         product.id,
        printfulVariantId: v.id,
        size:              v.size || "One Size",
        color:             v.color || "",
        colorCode:         v.color_code || "#000000",
        imageUrl:          v.image || null,
        basePrice:         parseFloat(v.price),
        retailPrice:       parseFloat(v.price) + markupFloat,
        inStock:           v.in_stock,
      })),
    });
  }

  void moderateContent(
    session.user.id,
    "MERCH",
    product.id,
    [product.title, product.description].filter(Boolean).join(" "),
  ).catch(() => {});

  return NextResponse.json({ product }, { status: 201 });
}
