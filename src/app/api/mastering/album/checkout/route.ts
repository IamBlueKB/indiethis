/**
 * POST /api/mastering/album/checkout
 *
 * Creates a single Stripe PaymentIntent for an entire album mastering job.
 * Charges perTrackPrice × trackCount in one payment — the resulting
 * paymentIntentId is sent to POST /api/mastering/album for each track.
 *
 * Body:
 *   tier:        "STANDARD" | "PREMIUM" | "PRO"
 *   trackCount:  number   (2–20)
 *
 * Returns:
 *   { clientSecret, paymentIntentId, amountCents, perTrackCents }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const TIER_CENTS: Record<string, number> = {
  STANDARD: 1199,
  PREMIUM:  1799,
  PRO:      2799,
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { tier, trackCount } = await req.json() as { tier: string; trackCount: number };

    if (!TIER_CENTS[tier]) {
      return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
    }
    if (!trackCount || trackCount < 2 || trackCount > 20) {
      return NextResponse.json({ error: "trackCount must be 2–20." }, { status: 400 });
    }

    const perTrackCents = TIER_CENTS[tier]!;
    const amountCents   = perTrackCents * trackCount;

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

    const intent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: "usd",
      metadata: {
        product:    "album_mastering",
        tier,
        trackCount: String(trackCount),
        userId:     session.user.id,
      },
    });

    return NextResponse.json({
      clientSecret:   intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
      perTrackCents,
    });
  } catch (err) {
    console.error("POST /api/mastering/album/checkout:", err);
    return NextResponse.json({ error: "Failed to create checkout." }, { status: 500 });
  }
}
