/**
 * POST /api/dashboard/music/canvas/checkout
 *
 * Creates a Stripe Checkout session for Track Canvas generation ($1.99).
 *
 * Body:    { trackId: string }
 * Returns: { checkoutUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getPricing } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trackId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trackId } = body;
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Verify track belongs to user
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, artistId: true },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.artistId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up price from PlatformPricing
  const pricing = await getPricing();
  const priceItem = pricing["CANVAS_GENERATE"];
  const priceValue = priceItem?.value ?? 1.99;
  const amountCents = Math.round(priceValue * 100);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Canvas Video Generation" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/music?paid=1&trackId=${trackId}`,
    cancel_url: `${appUrl}/dashboard/music`,
    metadata: {
      trackId,
      userId: session.user.id,
      type: "canvas_generate",
    },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
