import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PRINTFUL_API = "https://api.printful.com";

/**
 * POST /api/dashboard/merch/orders/defect-claim
 *
 * Body: { orderId, description, items: [{itemId, quantity, reason}] }
 *
 * Submits a defect/replacement claim for a POD merch order via Printful's
 * order reshipment API. Printful handles the replacement at no cost for
 * manufacturing defects.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    orderId:     string;
    description: string;
    items:       { itemId: string; quantity: number; reason: string }[];
  };

  if (!body.orderId || !body.description || !body.items?.length) {
    return NextResponse.json({ error: "orderId, description, and items are required." }, { status: 400 });
  }

  // Verify ownership
  const order = await db.merchOrder.findFirst({
    where:  { id: body.orderId, artistId: session.user.id },
    select: { id: true, printfulOrderId: true, fulfillmentStatus: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.printfulOrderId) {
    return NextResponse.json({ error: "This is not a print-on-demand order." }, { status: 400 });
  }
  if (!["SHIPPED", "DELIVERED"].includes(order.fulfillmentStatus)) {
    return NextResponse.json({ error: "Defect claims can only be submitted for shipped or delivered orders." }, { status: 400 });
  }

  if (!process.env.PRINTFUL_API_KEY) {
    return NextResponse.json({ error: "Printful not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${PRINTFUL_API}/orders/${order.printfulOrderId}/issues`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PRINTFUL_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          type:        "defect_or_wrong_product",
          description: body.description,
          items:       body.items,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { result?: string };
      return NextResponse.json(
        { error: errBody.result ?? "Printful claim submission failed." },
        { status: response.status }
      );
    }

    const result = await response.json() as { result?: { id?: number } };
    return NextResponse.json({ ok: true, claimId: result.result?.id });
  } catch (err) {
    console.error("[merch/orders/defect-claim]", err);
    return NextResponse.json({ error: "Failed to submit claim. Please try again." }, { status: 500 });
  }
}
