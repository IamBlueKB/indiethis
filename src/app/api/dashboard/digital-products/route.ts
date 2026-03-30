import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { DigitalProductType } from "@prisma/client";

// GET /api/dashboard/digital-products
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await db.digitalProduct.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tracks: true, purchases: true } },
    },
  });

  return NextResponse.json({ products });
}

// POST /api/dashboard/digital-products
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    type?: DigitalProductType;
    title?: string;
    price?: number;
    description?: string;
    coverArtUrl?: string;
    trackIds?: string[];
  };

  if (!body.type || !["SINGLE", "ALBUM"].includes(body.type)) {
    return NextResponse.json({ error: "type must be SINGLE or ALBUM" }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!body.price || typeof body.price !== "number") {
    return NextResponse.json({ error: "Price is required" }, { status: 400 });
  }

  // Price validation (cents)
  if (body.type === "SINGLE") {
    if (body.price < 99)   return NextResponse.json({ error: "Minimum price for a single is $0.99" }, { status: 400 });
    if (body.price > 9999) return NextResponse.json({ error: "Maximum price for a single is $99.99" }, { status: 400 });
  }
  if (body.type === "ALBUM") {
    if (body.price < 499)  return NextResponse.json({ error: "Minimum price for an album is $4.99" }, { status: 400 });
    if (body.price > 9999) return NextResponse.json({ error: "Maximum price for an album is $99.99" }, { status: 400 });
  }

  const trackIds = body.trackIds ?? [];

  // Verify tracks belong to this user
  if (trackIds.length > 0) {
    const tracks = await db.track.findMany({
      where: { id: { in: trackIds }, artistId: session.user.id },
      select: { id: true },
    });
    if (tracks.length !== trackIds.length) {
      return NextResponse.json({ error: "One or more tracks not found" }, { status: 400 });
    }
  }

  const product = await db.digitalProduct.create({
    data: {
      userId: session.user.id,
      type: body.type,
      title: body.title.trim(),
      price: body.price,
      description: body.description?.trim() ?? null,
      coverArtUrl: body.coverArtUrl ?? null,
      tracks: trackIds.length > 0 ? { connect: trackIds.map((id) => ({ id })) } : undefined,
    },
    include: { _count: { select: { tracks: true, purchases: true } } },
  });

  return NextResponse.json({ product }, { status: 201 });
}
