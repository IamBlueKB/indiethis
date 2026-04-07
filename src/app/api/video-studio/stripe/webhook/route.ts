/**
 * POST /api/video-studio/stripe/webhook
 *
 * Handles Stripe webhook events for Music Video Studio payments.
 * Event: checkout.session.completed with metadata.tool === "MUSIC_VIDEO"
 *
 * On successful payment:
 *   1. Updates MusicVideo.stripePaymentId
 *   2. Triggers generation pipeline in background
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe }                    from "@/lib/stripe";
import { db }                        from "@/lib/db";
import { startGeneration }           from "@/lib/video-studio/generate";
import Stripe                        from "stripe";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const sig     = req.headers.get("stripe-signature") ?? "";
  const secret  = process.env.STRIPE_VIDEO_STUDIO_WEBHOOK_SECRET
                ?? process.env.STRIPE_WEBHOOK_SECRET
                ?? "";

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event      = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    console.error("[video-studio/webhook] signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object as Stripe.Checkout.Session;
    const { musicVideoId, tool } = checkout.metadata ?? {};

    if (tool !== "MUSIC_VIDEO" || !musicVideoId) {
      // Not our event — ack and ignore
      return NextResponse.json({ received: true });
    }

    // Update payment record
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { stripePaymentId: checkout.id },
    });

    // Link to user if authenticated at checkout
    const userId = checkout.metadata?.userId;
    if (userId) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data:  { userId },
      });
    }

    // Kick off generation in background — don't await
    void startGeneration(musicVideoId).catch(err =>
      console.error("[video-studio/webhook] generation error:", err)
    );
  }

  return NextResponse.json({ received: true });
}
