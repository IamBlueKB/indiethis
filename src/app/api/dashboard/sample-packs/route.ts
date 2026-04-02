import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/sample-packs
// Returns all sample packs owned by the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const packs = await prisma.digitalProduct.findMany({
    where:   { userId: session.user.id, type: "SAMPLE_PACK" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, price: true, description: true,
      genre: true, coverArtUrl: true, published: true,
      samplePackFileUrl: true, samplePackFileSize: true,
      sampleCount: true, previewSampleUrls: true, createdAt: true,
      _count: { select: { purchases: true } },
    },
  });

  return NextResponse.json(packs);
}

// POST /api/dashboard/sample-packs
// Creates a new sample pack listing (starts as unpublished draft)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    price?: number;
    genre?: string;
    coverArtUrl?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.price || body.price < 99 || body.price > 19999) {
    return NextResponse.json({ error: "Price must be between $0.99 and $199.99" }, { status: 400 });
  }

  const pack = await prisma.digitalProduct.create({
    data: {
      userId:      session.user.id,
      type:        "SAMPLE_PACK",
      title:       body.title.trim(),
      description: body.description?.trim() ?? null,
      price:       body.price,
      genre:       body.genre?.trim() ?? null,
      coverArtUrl: body.coverArtUrl ?? null,
      published:   false,
    },
    select: {
      id: true, title: true, price: true, description: true,
      genre: true, coverArtUrl: true, published: true,
      samplePackFileUrl: true, samplePackFileSize: true,
      sampleCount: true, previewSampleUrls: true, createdAt: true,
      _count: { select: { purchases: true } },
    },
  });

  return NextResponse.json(pack, { status: 201 });
}
