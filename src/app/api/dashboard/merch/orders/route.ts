import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/merch/orders
// Returns all merch orders for the authenticated artist, newest first.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !["ARTIST", "STUDIO", "DJ"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await db.merchOrder.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          product: { select: { title: true, imageUrl: true, fulfillmentType: true } },
          variant: { select: { size: true, color: true } },
        },
      },
    },
  });

  return NextResponse.json({ orders });
}
