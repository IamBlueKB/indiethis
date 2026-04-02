/**
 * PATCH /api/dashboard/merch/[id]/feature
 *
 * Toggles isFeatured on a MerchProduct. PLATFORM_ADMIN only.
 * Returns { isFeatured: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const product = await db.merchProduct.findUnique({
    where:  { id },
    select: { isFeatured: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const updated = await db.merchProduct.update({
    where: { id },
    data:  { isFeatured: !product.isFeatured },
    select: { isFeatured: true },
  });

  return NextResponse.json({ isFeatured: updated.isFeatured });
}
