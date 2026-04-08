/**
 * POST /api/mastering/checkout
 *
 * Creates a Stripe PaymentIntent for a mastering job.
 * Payment MUST succeed before /api/mastering/job is called to start processing.
 *
 * Subscriber discounts are applied here based on the user's active plan.
 *
 * Body:
 *   mode:  "MIX_AND_MASTER" | "MASTER_ONLY"
 *   tier:  "STANDARD" | "PREMIUM" | "PRO"
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

// ─── Pricing matrix ───────────────────────────────────────────────────────────

// Base prices in cents (non-subscriber)
const BASE_PRICES: Record<string, Record<string, number>> = {
  STANDARD: { MIX_AND_MASTER: 1799, MASTER_ONLY: 1199 },
  PREMIUM:  { MIX_AND_MASTER: 1799, MASTER_ONLY: 1799 },
  PRO:      { MIX_AND_MASTER: 2799, MASTER_ONLY: 2799 },
};

// Subscriber discount factors per subscription plan
const PLAN_FACTORS: Record<string, Record<string, number>> = {
  // planId → { STANDARD, PREMIUM, PRO }
  launch: { STANDARD: 0.83, PREMIUM: 0.75, PRO: 0.83 }, // $9.99 / $14.99 / $24.99
  push:   { STANDARD: 0.67, PREMIUM: 0.72, PRO: 0.72 }, // $7.99 / $12.99 / $19.99
  reign:  { STANDARD: 0.50, PREMIUM: 0.56, PRO: 0.53 }, // $5.99 / $9.99  / $14.99
};

function getPlanKey(planId: string): string | null {
  if (planId.toLowerCase().includes("launch")) return "launch";
  if (planId.toLowerCase().includes("push"))   return "push";
  if (planId.toLowerCase().includes("reign"))  return "reign";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body    = await req.json() as {
      mode: string;
      tier: string;
    };

    const { mode, tier } = body;

    if (!BASE_PRICES[tier] || !BASE_PRICES[tier][mode]) {
      return NextResponse.json({ error: "Invalid tier or mode." }, { status: 400 });
    }

    let amountCents = BASE_PRICES[tier][mode];

    // Apply subscriber discount
    if (session?.user?.id) {
      const sub = await prisma.subscription.findUnique({
        where:  { userId: session.user.id },
        select: { stripePriceId: true, status: true },
      });

      if (sub?.status === "active" && sub.stripePriceId) {
        const planKey = getPlanKey(sub.stripePriceId);
        if (planKey && PLAN_FACTORS[planKey]?.[tier]) {
          amountCents = Math.round(amountCents * PLAN_FACTORS[planKey][tier]);
        }
      }
    }

    // Get or create Stripe customer
    let customerId: string | undefined;
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { stripeCustomerId: true, email: true, name: true },
      });
      if (user?.stripeCustomerId) {
        customerId = user.stripeCustomerId;
      } else if (user?.email) {
        const customer = await stripe.customers.create({
          email: user.email,
          name:  user.name ?? undefined,
        });
        customerId = customer.id;
        await prisma.user.update({
          where: { id: session.user.id },
          data:  { stripeCustomerId: customer.id },
        });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount:               amountCents,
      currency:             "usd",
      customer:             customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        mode,
        tier,
        userId: session?.user?.id ?? "guest",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents,
    });
  } catch (err) {
    console.error("POST /api/mastering/checkout:", err);
    return NextResponse.json({ error: "Failed to create checkout." }, { status: 500 });
  }
}
