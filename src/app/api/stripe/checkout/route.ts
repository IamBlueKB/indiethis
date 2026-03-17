import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, PLAN_PRICES } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { plan?: string };
  const plan = body.plan?.toLowerCase();

  if (!plan || !PLAN_PRICES[plan]) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const planConfig = PLAN_PRICES[plan];

  if (!planConfig.priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this plan." },
      { status: 503 }
    );
  }

  // Get or create Stripe customer
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, stripeCustomerId: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard/upgrade`,
    subscription_data: {
      metadata: { userId: session.user.id, tier: planConfig.tier },
    },
    metadata: { userId: session.user.id, tier: planConfig.tier },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
