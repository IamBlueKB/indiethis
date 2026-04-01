/**
 * POST /api/dashboard/ai/producer-match/checkout
 *
 * Creates a Stripe Checkout session for the Producer-Artist Match Report ($9.99).
 * On payment success the webhook triggers generateProducerArtistMatch(userId).
 *
 * Returns: { url: string }
 */

import { auth }                         from "@/lib/auth";
import { db }                           from "@/lib/db";
import { stripe }                       from "@/lib/stripe";
import { NextRequest, NextResponse }    from "next/server";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
const PRICING_KEY = "PRODUCER_ARTIST_MATCH";

export async function POST(_req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const subscription = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { stripeCustomerId: true, name: true, email: true },
  });

  const pricing  = await getPricing();
  const priceVal = pricing[PRICING_KEY]?.value ?? PRICING_DEFAULTS.PRODUCER_ARTIST_MATCH.value;
  const priceLbl = pricing[PRICING_KEY]?.display ?? PRICING_DEFAULTS.PRODUCER_ARTIST_MATCH.display;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode:          "payment",
    customer:      user?.stripeCustomerId ?? undefined,
    customer_email: !user?.stripeCustomerId && user?.email ? user.email : undefined,
    line_items: [{
      price_data: {
        currency:     "usd",
        unit_amount:  Math.round(priceVal * 100),
        product_data: {
          name:        `IndieThis Producer Match Report — ${priceLbl}`,
          description: "Top-5 bidirectional producer-artist matches based on your genre and catalogue.",
        },
      },
      quantity: 1,
    }],
    metadata: {
      userId,
      tool: "PRODUCER_ARTIST_MATCH",
    },
    success_url: `${APP_URL}/dashboard/ai/producer-match?success=1`,
    cancel_url:  `${APP_URL}/dashboard/ai/producer-match`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
