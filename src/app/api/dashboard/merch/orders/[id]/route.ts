import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMerchShippedEmail } from "@/lib/brevo/email";

// PATCH /api/dashboard/merch/orders/[id]
// Artists can update fulfillment status, tracking number, tracking URL.
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
    fulfillmentStatus?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";
    trackingNumber?: string;
    trackingUrl?: string;
    carrier?: string;
  };

  // Fetch order to verify ownership and get buyer info for shipped email
  const order = await db.merchOrder.findFirst({
    where:  { id, artistId: session.user.id },
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      fulfillmentStatus: true,
      items: {
        take: 1,
        select: { product: { select: { title: true, fulfillmentType: true } } },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.merchOrder.update({
    where: { id },
    data: {
      ...(body.fulfillmentStatus !== undefined && { fulfillmentStatus: body.fulfillmentStatus }),
      ...(body.trackingNumber   !== undefined && { trackingNumber: body.trackingNumber }),
      ...(body.trackingUrl      !== undefined && { trackingUrl:    body.trackingUrl }),
    },
  });

  // When marking SHIPPED for self-fulfilled, email the buyer
  const isNowShipped = body.fulfillmentStatus === "SHIPPED" && order.fulfillmentStatus !== "SHIPPED";
  const hasSelfFulfilled = order.items.some((i) => i.product.fulfillmentType === "SELF_FULFILLED");
  if (isNowShipped && hasSelfFulfilled && body.trackingNumber && order.buyerEmail) {
    const artist = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, artistName: true },
    });
    void sendMerchShippedEmail({
      buyerEmail:    order.buyerEmail,
      buyerName:     order.buyerName ?? "Valued Customer",
      orderId:       order.id,
      artistName:    artist?.artistName ?? artist?.name ?? "Artist",
      trackingNumber: body.trackingNumber,
      trackingUrl:   body.trackingUrl,
      carrier:       body.carrier,
    }).catch(() => {});
  }

  return NextResponse.json({ updated: updated.id });
}
