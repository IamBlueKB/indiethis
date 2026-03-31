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
        select: { id: true, size: true, color: true, retailPrice: true, inStock: true },
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
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, imageUrl, printfulProductId, markup } = body;

  if (!title?.trim() || !imageUrl?.trim() || !printfulProductId) {
    return NextResponse.json({ error: "title, imageUrl, and printfulProductId are required" }, { status: 400 });
  }

  const product = await db.merchProduct.create({
    data: {
      artistId:          session.user.id,
      title:             title.trim(),
      description:       description?.trim() ?? null,
      imageUrl:          imageUrl.trim(),
      printfulProductId: parseInt(printfulProductId, 10),
      markup:            parseFloat(markup) || 0,
    },
  });

  // Content moderation scan — fire and forget
  void moderateContent(
    session.user.id,
    "MERCH",
    product.id,
    [product.title, product.description].filter(Boolean).join(" "),
  ).catch(() => {});

  return NextResponse.json({ product }, { status: 201 });
}
