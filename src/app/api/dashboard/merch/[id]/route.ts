import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/dashboard/merch/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !["ARTIST", "STUDIO", "DJ"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    title?:          string;
    description?:    string;
    isActive?:       boolean;
    markup?:         number;
    returnPolicy?:   string;
    processingDays?: number;
  };

  const updated = await db.merchProduct.updateMany({
    where: { id, artistId: session.user.id },
    data: {
      ...(body.title          !== undefined && { title:          body.title.trim() }),
      ...(body.description    !== undefined && { description:    body.description }),
      ...(body.isActive       !== undefined && { isActive:       body.isActive }),
      ...(body.markup         !== undefined && { markup:         body.markup }),
      ...(body.returnPolicy   !== undefined && { returnPolicy:   body.returnPolicy }),
      ...(body.processingDays !== undefined && { processingDays: body.processingDays }),
    },
  });

  return NextResponse.json({ updated: updated.count });
}

// DELETE /api/dashboard/merch/[id]
// Returns 409 if the product has existing orders (cannot delete).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !["ARTIST", "STUDIO", "DJ"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const product = await db.merchProduct.findFirst({
    where: { id, artistId: session.user.id },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block delete if any orders have been placed for this product
  const orderCount = await db.merchOrderItem.count({ where: { productId: id } });
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — this product has ${orderCount} order${orderCount === 1 ? "" : "s"}. Unpublish it instead.` },
      { status: 409 },
    );
  }

  await db.merchProduct.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
