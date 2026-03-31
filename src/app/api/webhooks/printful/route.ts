/**
 * POST /api/webhooks/printful
 *
 * Handles Printful order status webhook events.
 * Register this URL in your Printful store webhook settings.
 * Events handled: package_shipped, package_returned
 *
 * No signature verification — Printful webhooks don't use HMAC by default;
 * the orderId lookup inherently scopes to known orders.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMerchShippedEmail } from "@/lib/brevo/email";
import { createNotification } from "@/lib/notifications";

type PrintfulWebhookEvent = {
  type:  string;
  store: number;
  data:  {
    order?: { external_id?: string };
    shipment?: { tracking_number?: string; tracking_url?: string; carrier?: string };
  };
};

export async function POST(req: NextRequest) {
  try {
    const event = await req.json() as PrintfulWebhookEvent;
    const { type, data } = event;

    if (type === "package_shipped") {
      const orderId  = data.order?.external_id;
      const shipment = data.shipment;

      if (!orderId || !shipment?.tracking_number) {
        return NextResponse.json({ ok: false, error: "Missing order or tracking data" }, { status: 400 });
      }

      const order = await db.merchOrder.findUnique({
        where:  { id: orderId },
        select: { id: true, artistId: true, buyerEmail: true, buyerName: true },
      });

      if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

      await db.merchOrder.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: "SHIPPED",
          trackingNumber:    shipment.tracking_number,
          trackingUrl:       shipment.tracking_url ?? null,
        },
      });

      // Get artist info
      const artist = await db.user.findUnique({
        where:  { id: order.artistId },
        select: { name: true, artistName: true },
      });

      // Email buyer
      if (order.buyerEmail) {
        void sendMerchShippedEmail({
          buyerEmail:     order.buyerEmail,
          buyerName:      order.buyerName ?? "Valued Customer",
          orderId:        order.id,
          artistName:     artist?.artistName ?? artist?.name ?? "Artist",
          trackingNumber: shipment.tracking_number,
          trackingUrl:    shipment.tracking_url,
          carrier:        shipment.carrier,
        }).catch(() => {});
      }

      // Notify artist
      void createNotification({
        userId:  order.artistId,
        type:    "MERCH_ORDER",
        title:   "Order shipped via Printful",
        message: `Order ${orderId.slice(-8).toUpperCase()} is on its way — tracking: ${shipment.tracking_number}`,
        link:    "/dashboard/merch",
      }).catch(() => {});
    }

    if (type === "package_returned") {
      const orderId = data.order?.external_id;
      if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });

      const order = await db.merchOrder.findUnique({
        where:  { id: orderId },
        select: { id: true, artistId: true },
      });
      if (!order) return NextResponse.json({ ok: false }, { status: 404 });

      void createNotification({
        userId:  order.artistId,
        type:    "MERCH_ORDER",
        title:   "Package returned",
        message: `Order ${orderId.slice(-8).toUpperCase()} was returned. Check your Printful dashboard.`,
        link:    "/dashboard/merch",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhooks/printful]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
