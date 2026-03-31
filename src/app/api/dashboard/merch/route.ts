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
      orders: {
        select: { id: true, totalPrice: true, artistEarnings: true },
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
  const { title, description, imageUrl, basePrice, artistMarkup, productType } = body;

  if (!title?.trim() || !imageUrl?.trim() || !productType) {
    return NextResponse.json({ error: "title, imageUrl, and productType are required" }, { status: 400 });
  }

  const product = await db.merchProduct.create({
    data: {
      artistId: session.user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      imageUrl: imageUrl.trim(),
      basePrice: parseFloat(basePrice) || 0,
      artistMarkup: parseFloat(artistMarkup) || 0,
      productType,
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
