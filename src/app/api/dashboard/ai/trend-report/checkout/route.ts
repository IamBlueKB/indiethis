/**
 * POST /api/dashboard/ai/trend-report/checkout
 *
 * Creates a Stripe Checkout session for the Trend Report ($4.99).
 * Reign plan: free — report generated immediately, no Stripe session.
 * On successful payment the webhook triggers generateTrendReport(userId).
 *
 * Returns: { url: string } | { free: true }
 */

import { auth }                         from "@/lib/auth";
import { db }                           from "@/lib/db";
import { stripe }                       from "@/lib/stripe";
import { NextRequest, NextResponse }    from "next/server";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";
import { generateTrendReport }          from "@/lib/agents/trend-forecaster";

const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
const PRICING_KEY     = "TREND_REPORT";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Require an active subscription
  const subscription = await db.subscription.findFirst({
    where:  { userId, status: "ACTIVE" },
    select: { tier: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  // Reign plan: free — generate immediately
  if (subscription.tier === "REIGN") {
    void generateTrendReport(userId).catch((err) =>
      console.error("[trend-report] Reign free generation error:", err)
    );
    return NextResponse.json({ free: true });
  }

  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { stripeCustomerId: true, name: true, email: true },
  });

  const pricing  = await getPricing();
  const priceVal = pricing[PRICING_KEY]?.value ?? PRICING_DEFAULTS.TREND_REPORT.value;
  const priceLbl = pricing[PRICING_KEY]?.display ?? PRICING_DEFAULTS.TREND_REPORT.display;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode:          "payment",
    customer:      user?.stripeCustomerId ?? undefined,
    customer_email: !user?.stripeCustomerId && user?.email ? user.email : undefined,
    line_items: [{
      price_data: {
        currency:     "usd",
        unit_amount:  Math.round(priceVal * 100),
        product_data: {
          name:        `IndieThis Trend Report — ${priceLbl}`,
          description: "Personalised genre trend analysis, release timing tips, and monetisation insights.",
        },
      },
      quantity: 1,
    }],
    metadata: {
      userId,
      tool: "TREND_REPORT",
    },
    success_url: `${APP_URL}/dashboard/ai/trend-report?success=1`,
    cancel_url:  `${APP_URL}/dashboard/ai/trend-report`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
