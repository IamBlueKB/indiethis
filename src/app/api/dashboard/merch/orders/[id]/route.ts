import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/dashboard/merch/orders/[id]
// Artists can update fulfillment status and tracking number.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    fulfillmentStatus?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";
    trackingNumber?: string;
  };

  const updated = await db.merchOrder.updateMany({
    where: { id, artistId: session.user.id },
    data: {
      ...(body.fulfillmentStatus !== undefined && { fulfillmentStatus: body.fulfillmentStatus }),
      ...(body.trackingNumber   !== undefined && { trackingNumber: body.trackingNumber }),
    },
  });

  return NextResponse.json({ updated: updated.count });
}
