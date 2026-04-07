/**
 * POST /api/cover-art/checkout
 *
 * Public — no auth required. Creates a CoverArtJob for a guest user
 * and returns a Stripe Checkout URL.
 *
 * Body: {
 *   tier:               "STANDARD" | "PREMIUM" | "PRO"
 *   styleId:            string
 *   prompt:             string
 *   guestEmail:         string
 *   referenceImageUrl?: string
 * }
 *
 * Response: { jobId: string; url: string }
 */

import { NextRequest, NextResponse }  from "next/server";
import { db }                         from "@/lib/db";
import { stripe }                     from "@/lib/stripe";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

const GUEST_PRICING_KEY: Record<string, string> = {
  STANDARD: "AI_COVER_ART_STANDARD_GUEST",
  PREMIUM:  "AI_COVER_ART_PREMIUM_GUEST",
  PRO:      "AI_COVER_ART_PRO_GUEST",
};

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    tier?:              string;
    styleId?:           string;
    prompt?:            string;
    guestEmail?:        string;
    referenceImageUrl?: string;
  };

  const tier = (body.tier ?? "STANDARD").toUpperCase() as "STANDARD" | "PREMIUM" | "PRO";
  if (!["STANDARD", "PREMIUM", "PRO"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!body.styleId) {
    return NextResponse.json({ error: "Style selection is required" }, { status: 400 });
  }
  if (!body.guestEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guestEmail.trim())) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  // Verify style exists
  const style = await db.coverArtStyle.findUnique({
    where:  { id: body.styleId },
    select: { id: true },
  });
  if (!style) return NextResponse.json({ error: "Style not found" }, { status: 404 });

  const guestEmail = body.guestEmail.trim();

  // Create job in PENDING state
  const job = await db.coverArtJob.create({
    data: {
      guestEmail,
      tier,
      styleId:          body.styleId,
      prompt:           body.prompt.trim(),
      referenceImageUrl: body.referenceImageUrl ?? null,
      status:           "PENDING",
    },
  });

  // Look up Stripe customer for this guest email (create if needed)
  let customerId: string | undefined;
  const existingUser = await db.user.findUnique({
    where:  { email: guestEmail },
    select: { stripeCustomerId: true },
  });
  if (existingUser?.stripeCustomerId) {
    customerId = existingUser.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: guestEmail,
      metadata: { guestEmail },
    });
    customerId = customer.id;
  }

  // Price lookup
  const pricing    = await getPricing();
  const priceKey   = GUEST_PRICING_KEY[tier];
  const amount     = Math.round(
    (pricing[priceKey]?.value ?? (PRICING_DEFAULTS as Record<string, { value: number }>)[priceKey]?.value ?? 0) * 100
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode:     "payment",
    line_items: [{
      price_data: {
        currency:     "usd",
        product_data: { name: `Cover Art Studio — ${tier.charAt(0) + tier.slice(1).toLowerCase()} — IndieThis` },
        unit_amount:  amount,
      },
      quantity: 1,
    }],
    customer_email: customerId ? undefined : guestEmail,
    success_url: `${appUrl}/cover-art?paid=1&jobId=${job.id}`,
    cancel_url:  `${appUrl}/cover-art`,
    metadata:    { guestEmail, tool: `COVER_ART_${tier}`, jobId: job.id },
  });

  return NextResponse.json({ jobId: job.id, url: checkoutSession.url });
}
