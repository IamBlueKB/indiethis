/**
 * POST /api/dashboard/dj/mixes/canvas/checkout
 *
 * Creates a Stripe Checkout session for DJ Mix Canvas generation ($1.99).
 *
 * Body:    { mixId: string }
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

  let body: { mixId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mixId } = body;
  if (!mixId) {
    return NextResponse.json({ error: "mixId is required" }, { status: 400 });
  }

  // Resolve DJ profile for this user
  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!djProfile) {
    return NextResponse.json({ error: "No DJ profile found" }, { status: 403 });
  }

  // Verify mix belongs to this DJ profile
  const mix = await db.dJMix.findUnique({
    where: { id: mixId },
    select: { id: true, djProfileId: true },
  });

  if (!mix) {
    return NextResponse.json({ error: "Mix not found" }, { status: 404 });
  }
  if (mix.djProfileId !== djProfile.id) {
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
    success_url: `${appUrl}/dashboard/dj/mixes?paid=1&mixId=${mixId}`,
    cancel_url: `${appUrl}/dashboard/dj/mixes`,
    metadata: {
      mixId,
      userId: session.user.id,
      type: "canvas_generate_mix",
    },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
