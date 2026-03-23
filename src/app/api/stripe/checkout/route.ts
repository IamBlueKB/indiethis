import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, PLAN_PRICES } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { plan?: string; onboarding?: boolean };
  const plan       = body.plan?.toLowerCase();
  const onboarding = !!body.onboarding;

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

  // Get or create Stripe customer; also check for a pending affiliate referral
  // so we can auto-apply the 10% / 3-month discount at checkout.
  const [user, affiliateRef] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, stripeCustomerId: true },
    }),
    db.affiliateReferral.findUnique({
      where: { referredUserId: session.user.id },
      select: {
        monthsRemaining: true,
        affiliate: { select: { discountCode: true, status: true } },
      },
    }),
  ]);

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

  // Resolve affiliate discount coupon — applies 10% off for the first 3 months.
  // Only applies if the user was referred via an affiliate link and the affiliate is still APPROVED.
  let affiliateCouponId: string | undefined;
  const hasAffiliateDiscount =
    affiliateRef &&
    affiliateRef.monthsRemaining > 0 &&
    affiliateRef.affiliate.status === "APPROVED";

  if (hasAffiliateDiscount) {
    const AFFILIATE_COUPON_ID = "affiliate-10pct-3mo";
    try {
      // Ensure the coupon exists in Stripe (idempotent — no-op if already present)
      await stripe.coupons.retrieve(AFFILIATE_COUPON_ID).catch(async () => {
        await stripe!.coupons.create({
          id:                   AFFILIATE_COUPON_ID,
          percent_off:          10,
          duration:             "repeating",
          duration_in_months:   3,
          name:                 "Affiliate Referral — 10% off for 3 months",
          metadata:             { source: "affiliate_program" },
        });
      });
      affiliateCouponId = AFFILIATE_COUPON_ID;
    } catch (err) {
      // Non-fatal — proceed without discount rather than blocking checkout
      console.error("[checkout] failed to ensure affiliate coupon:", err);
    }
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: onboarding
      ? `${appUrl}/signup/setup?session_id={CHECKOUT_SESSION_ID}`
      : `${appUrl}/dashboard?upgraded=1`,
    cancel_url: onboarding
      ? `${appUrl}/pricing?onboarding=1`
      : `${appUrl}/dashboard/upgrade`,
    subscription_data: {
      metadata: { userId: session.user.id, tier: planConfig.tier },
    },
    metadata: { userId: session.user.id, tier: planConfig.tier },
    // Auto-apply affiliate coupon if eligible; otherwise allow manual promo codes
    ...(affiliateCouponId
      ? { discounts: [{ coupon: affiliateCouponId }] }
      : { allow_promotion_codes: true }),
  });

  return NextResponse.json({ url: checkoutSession.url });
}
