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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

// ─── Pricing matrix ───────────────────────────────────────────────────────────

// Base prices in cents (non-subscriber)
const BASE_PRICES: Record<string, Record<string, number>> = {
  STANDARD: { MIX_AND_MASTER: 799,  MASTER_ONLY: 799  },
  PREMIUM:  { MIX_AND_MASTER: 1499, MASTER_ONLY: 1499 },
  PRO:      { MIX_AND_MASTER: 2499, MASTER_ONLY: 2499 },
};

// Exact subscriber PPU prices in cents (after included credits are exhausted)
const SUBSCRIBER_PRICES: Record<string, Record<string, number>> = {
  launch: { STANDARD: 599,  PREMIUM: 1199, PRO: 1999 },
  push:   { STANDARD: 499,  PREMIUM: 999,  PRO: 1499 },
  reign:  { STANDARD: 399,  PREMIUM: 799,  PRO: 999  },
};

function getPlanKey(subTier: string): string | null {
  const t = subTier.toLowerCase();
  if (t === "launch") return "launch";
  if (t === "push")   return "push";
  if (t === "reign")  return "reign";
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

    // ── TESTING: skip payment — re-enable before launch ───────────────────────
    if (process.env.MASTERING_PAYWALL_DISABLED === "true" || true) {
      return NextResponse.json({ creditsUsed: true, creditsRemaining: 99 });
    }

    let amountCents = BASE_PRICES[tier][mode];
    let subId: string | null = null;

    // Check subscription status and included credits
    if (session?.user?.id) {
      const sub = await prisma.subscription.findUnique({
        where:  { userId: session!.user!.id },
        select: { id: true, tier: true, status: true, aiMasterCreditsUsed: true, aiMasterCreditsLimit: true },
      });

      if (sub?.status === "ACTIVE") {
        subId = sub.id;

        // If the subscriber has included credits remaining, use one instead of charging
        if (sub.aiMasterCreditsUsed < sub.aiMasterCreditsLimit) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data:  { aiMasterCreditsUsed: { increment: 1 } },
          });
          return NextResponse.json({
            creditsUsed:     true,
            creditsRemaining: sub.aiMasterCreditsLimit - sub.aiMasterCreditsUsed - 1,
          });
        }

        // Credits exhausted — apply subscriber PPU pricing
        const planKey = getPlanKey(sub.tier ?? "");
        if (planKey && SUBSCRIBER_PRICES[planKey]?.[tier]) {
          amountCents = SUBSCRIBER_PRICES[planKey][tier];
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
