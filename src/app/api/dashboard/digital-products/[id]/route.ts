import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/dashboard/digital-products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const product = await db.digitalProduct.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (product.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    title?: string;
    price?: number;
    description?: string;
    coverArtUrl?: string;
    published?: boolean;
    trackIds?: string[];
  };

  // Price validation if price is being changed
  if (body.price !== undefined) {
    const current = await db.digitalProduct.findUnique({ where: { id }, select: { type: true } });
    if (current?.type === "SINGLE") {
      if (body.price < 99)   return NextResponse.json({ error: "Minimum price for a single is $0.99" }, { status: 400 });
      if (body.price > 9999) return NextResponse.json({ error: "Maximum price for a single is $99.99" }, { status: 400 });
    }
    if (current?.type === "ALBUM") {
      if (body.price < 499)  return NextResponse.json({ error: "Minimum price for an album is $4.99" }, { status: 400 });
      if (body.price > 9999) return NextResponse.json({ error: "Maximum price for an album is $99.99" }, { status: 400 });
    }
  }

  const updated = await db.digitalProduct.update({
    where: { id },
    data: {
      ...(body.title      !== undefined && { title: body.title.trim() }),
      ...(body.price      !== undefined && { price: body.price }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.coverArtUrl !== undefined && { coverArtUrl: body.coverArtUrl ?? null }),
      ...(body.published  !== undefined && { published: body.published }),
      ...(body.trackIds   !== undefined && {
        tracks: {
          set: body.trackIds.map((tid) => ({ id: tid })),
        },
      }),
    },
    include: { _count: { select: { tracks: true, purchases: true } } },
  });

  return NextResponse.json({ product: updated });
}

// DELETE /api/dashboard/digital-products/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const product = await db.digitalProduct.findUnique({
    where: { id },
    select: { userId: true, _count: { select: { purchases: true } } },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (product.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (product._count.purchases > 0) {
    return NextResponse.json(
      { error: "Cannot delete a product that has purchases" },
      { status: 409 }
    );
  }

  await db.digitalProduct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
