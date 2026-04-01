/**
 * POST /api/dashboard/ai/booking-report/checkout
 *
 * Creates a Stripe Checkout session for the AI Booking Report ($14.99).
 * Reign plan users get the report free — no checkout needed.
 * On successful payment the webhook fires generateBookingReport(userId, mode).
 *
 * Body (optional): { mode: "ARTIST" | "DJ" }
 * Returns: { url: string } | { free: true } (Reign)
 */

import { auth }                         from "@/lib/auth";
import { db }                           from "@/lib/db";
import { stripe }                       from "@/lib/stripe";
import { NextRequest, NextResponse }    from "next/server";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";
import { generateBookingReport }        from "@/lib/agents/booking-agent";
import type { BookingMode }             from "@/lib/agents/booking-agent";

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
const PRICING_KEY = "BOOKING_REPORT";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => ({})) as { mode?: string };
  const mode: BookingMode = body.mode === "DJ" ? "DJ" : "ARTIST";

  // Require an active subscription
  const subscription = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { tier: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  // Reign plan: free — generate immediately
  if (subscription.tier === "REIGN") {
    void generateBookingReport(userId, mode).catch((err) =>
      console.error("[booking-report] Reign free generation error:", err)
    );
    return NextResponse.json({ free: true });
  }

  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { stripeCustomerId: true, name: true, email: true },
  });

  const pricing  = await getPricing();
  const priceVal = pricing[PRICING_KEY]?.value   ?? PRICING_DEFAULTS.BOOKING_REPORT.value;
  const priceLbl = pricing[PRICING_KEY]?.display ?? PRICING_DEFAULTS.BOOKING_REPORT.display;

  const dashPath = mode === "DJ"
    ? "/dashboard/dj/booking-report"
    : "/dashboard/ai/booking-report";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode:           "payment",
    customer:       user?.stripeCustomerId ?? undefined,
    customer_email: !user?.stripeCustomerId && user?.email ? user.email : undefined,
    line_items: [{
      price_data: {
        currency:     "usd",
        unit_amount:  Math.round(priceVal * 100),
        product_data: {
          name:        `IndieThis Booking Opportunities Report — ${priceLbl}`,
          description: "10 curated performance and exposure opportunities tailored to your sound and location.",
        },
      },
      quantity: 1,
    }],
    metadata: {
      userId,
      tool: "BOOKING_REPORT",
      mode,
    },
    success_url: `${APP_URL}${dashPath}?success=1`,
    cancel_url:  `${APP_URL}${dashPath}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
