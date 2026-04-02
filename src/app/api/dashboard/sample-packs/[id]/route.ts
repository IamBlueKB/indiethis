import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/dashboard/sample-packs/[id]
// Update title, description, price, genre, coverArtUrl, published
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    price?: number;
    genre?: string;
    coverArtUrl?: string;
    published?: boolean;
  };

  // Verify ownership
  const product = await prisma.digitalProduct.findFirst({
    where: { id, userId: session.user.id, type: "SAMPLE_PACK" },
    select: { id: true, samplePackFileUrl: true, previewSampleUrls: true, published: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If attempting to publish, verify zip + at least 1 preview exist
  if (body.published === true) {
    if (!product.samplePackFileUrl) {
      return NextResponse.json(
        { error: "Upload a zip file before publishing." },
        { status: 400 }
      );
    }
    const previews = product.previewSampleUrls as string[] | null;
    if (!previews || previews.length === 0) {
      return NextResponse.json(
        { error: "Select at least 1 preview sample before publishing." },
        { status: 400 }
      );
    }
  }

  if (body.price !== undefined) {
    // $0.99 – $199.99 for sample packs
    if (body.price < 99 || body.price > 19999) {
      return NextResponse.json({ error: "Price must be between $0.99 and $199.99" }, { status: 400 });
    }
  }

  const updated = await prisma.digitalProduct.update({
    where: { id },
    data: {
      ...(body.title       !== undefined && { title:       body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price       !== undefined && { price:       body.price }),
      ...(body.genre       !== undefined && { genre:       body.genre }),
      ...(body.coverArtUrl !== undefined && { coverArtUrl: body.coverArtUrl }),
      ...(body.published   !== undefined && { published:   body.published }),
    },
    select: {
      id: true, title: true, price: true, description: true,
      genre: true, coverArtUrl: true, published: true,
      samplePackFileUrl: true, samplePackFileSize: true, sampleCount: true,
      previewSampleUrls: true, createdAt: true,
      _count: { select: { purchases: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/dashboard/sample-packs/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const product = await prisma.digitalProduct.findFirst({
    where: { id, userId: session.user.id, type: "SAMPLE_PACK" },
    select: { id: true, _count: { select: { purchases: true } } },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (product._count.purchases > 0) {
    return NextResponse.json(
      { error: "Cannot delete a sample pack that has been purchased." },
      { status: 409 }
    );
  }

  await prisma.digitalProduct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
