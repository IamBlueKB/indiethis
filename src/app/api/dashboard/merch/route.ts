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
        select: { id: true, size: true, color: true, colorCode: true, retailPrice: true, basePrice: true, inStock: true },
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
// Accepts two shapes:
//   A) Full wizard payload — `variants` array with individual retail prices (from /merch/create wizard)
//   B) Simple payload     — `markup` flat markup applied to all catalog variants (legacy)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    printfulProductId: number;
    title:             string;
    description?:      string;
    imageUrl:          string;
    designUrl?:        string;
    placement?:        string;
    isActive?:         boolean;
    markup?:           number;
    variants?: {
      printfulVariantId: number;
      size:              string;
      color:             string;
      colorCode:         string;
      basePrice:         number;
      retailPrice:       number;
      imageUrl?:         string;
    }[];
  };

  const { title, description, imageUrl, printfulProductId, markup, variants, designUrl, placement, isActive } = body;

  if (!title?.trim() || !imageUrl?.trim() || !printfulProductId) {
    return NextResponse.json({ error: "title, imageUrl, and printfulProductId are required" }, { status: 400 });
  }

  // ── Shape A: explicit variants array ─────────────────────────────────────
  if (variants && variants.length > 0) {
    // Validate all variants have retail > base
    for (const v of variants) {
      if (v.retailPrice <= v.basePrice) {
        return NextResponse.json(
          { error: `Retail price for ${v.color} ${v.size} must be greater than base cost $${v.basePrice.toFixed(2)}` },
          { status: 400 },
        );
      }
    }

    const product = await db.merchProduct.create({
      data: {
        artistId:          session.user.id,
        title:             title.trim(),
        description:       description?.trim() ?? null,
        imageUrl:          imageUrl.trim(),
        printfulProductId: printfulProductId,
        markup:            0, // individual per-variant pricing — markup field unused
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

  // ── Shape B: markup-based (legacy / fallback) ────────────────────────────
  const { getCatalogEntry } = await import("@/lib/printful-catalog");
  const markupFloat  = parseFloat(String(markup ?? 0)) || 0;
  const catalogEntry = await getCatalogEntry(printfulProductId);

  const product = await db.merchProduct.create({
    data: {
      artistId:          session.user.id,
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
