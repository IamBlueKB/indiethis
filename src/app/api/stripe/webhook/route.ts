import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { LicenseType } from "@prisma/client";
import {
  creditStudioForArtistPurchase,
  applyStudioCreditsToStripeInvoice,
} from "@/lib/studio-referral";

type TierCredits = {
  aiVideoCreditsLimit: number;
  aiArtCreditsLimit: number;
  aiMasterCreditsLimit: number;
  lyricVideoCreditsLimit: number;
  aarReportCreditsLimit: number;
  pressKitCreditsLimit: number;
};

const TIER_CREDITS: Record<string, TierCredits> = {
  LAUNCH: { aiVideoCreditsLimit: 0, aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  PUSH:   { aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 3,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 0 },
  REIGN:  { aiVideoCreditsLimit: 5, aiArtCreditsLimit: 15, aiMasterCreditsLimit: 10, lyricVideoCreditsLimit: 3, aarReportCreditsLimit: 5, pressKitCreditsLimit: 0 },
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkSession = event.data.object as Stripe.Checkout.Session;
      const userId = checkSession.metadata?.userId;

      // --- Beat license purchase ---
      if (checkSession.metadata?.type === "BEAT_LICENSE") {
        const { userId: buyerId, trackId, producerId, licenseType, previewId } = checkSession.metadata;
        if (buyerId && trackId && producerId && licenseType) {
          const paidAmount = checkSession.amount_total ? checkSession.amount_total / 100 : 0;

          let previewDbId: string;
          if (previewId) {
            // My Previews flow — reuse the existing preview record, mark it purchased
            await db.beatPreview.update({
              where: { id: previewId },
              data: { status: "PURCHASED" },
            });
            previewDbId = previewId;
          } else {
            // Browse Beats flow — create a new preview record to anchor the license
            const preview = await db.beatPreview.create({
              data: {
                producerId,
                artistId: buyerId,
                trackId,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                isDownloadable: true,
                status: "PURCHASED",
              },
            });
            previewDbId = preview.id;
          }

          await db.beatLicense.create({
            data: {
              beatPreviewId: previewDbId,
              trackId,
              producerId,
              artistId: buyerId,
              licenseType: licenseType as LicenseType,
              price: paidAmount,
            },
          });
        }
        break;
      }

      // --- Merch purchase (no userId — buyer is a fan, not a platform user) ---
      if (checkSession.metadata?.type === "MERCH") {
        const { productId, artistId, buyerEmail, quantity: qtyStr } = checkSession.metadata;
        const qty = Math.max(1, parseInt(qtyStr ?? "1", 10));

        const product = await db.merchProduct.findUnique({
          where: { id: productId },
          select: { basePrice: true, artistMarkup: true },
        });

        if (product) {
          const totalPrice      = (product.basePrice + product.artistMarkup) * qty;
          const artistEarnings  = product.artistMarkup * qty;
          const platformCut     = product.basePrice * 0.15 * qty; // 15% of base price

          await db.merchOrder.create({
            data: {
              merchProductId: productId,
              artistId,
              buyerEmail,
              quantity: qty,
              totalPrice,
              platformCut,
              artistEarnings,
              stripePaymentId:
                typeof checkSession.payment_intent === "string"
                  ? checkSession.payment_intent
                  : checkSession.id,
            },
          });
        }
        break;
      }

      if (!userId) break;

      // --- Subscription checkout ---
      if (checkSession.mode === "subscription") {
        const tier = checkSession.metadata?.tier;
        if (!tier) break;

        const credits = TIER_CREDITS[tier] ?? TIER_CREDITS.LAUNCH;
        const stripeSubscriptionId = checkSession.subscription as string | null;
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await db.subscription.upsert({
          where: { userId },
          update: {
            tier: tier as "LAUNCH" | "PUSH" | "REIGN",
            status: "ACTIVE",
            stripeSubscriptionId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            ...credits,
            aiVideoCreditsUsed: 0,
            aiArtCreditsUsed: 0,
            aiMasterCreditsUsed: 0,
            lyricVideoCreditsUsed: 0,
            aarReportCreditsUsed: 0,
            pressKitCreditsUsed: 0,
          },
          create: {
            userId,
            tier: tier as "LAUNCH" | "PUSH" | "REIGN",
            status: "ACTIVE",
            stripeSubscriptionId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            ...credits,
            aiVideoCreditsUsed: 0,
            aiArtCreditsUsed: 0,
            aiMasterCreditsUsed: 0,
            lyricVideoCreditsUsed: 0,
            aarReportCreditsUsed: 0,
            pressKitCreditsUsed: 0,
          },
        });

        // Credit any studios that referred this artist (fire-and-forget)
        void creditStudioForArtistPurchase(userId, "SUBSCRIPTION");

        break;
      }

      // --- Pay-per-use (one-time payment) ---
      if (checkSession.mode === "payment") {
        const tool = checkSession.metadata?.tool;
        if (!tool) break;

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Credit increments by tool
        const creditField: Record<string, { increment: number }> | null =
          tool === "LYRIC_VIDEO" ? { lyricVideoCreditsLimit: { increment: 1 } }
          : tool === "COVER_ART"  ? { aiArtCreditsLimit:      { increment: 1 } }
          : tool === "AI_VIDEO"   ? { aiVideoCreditsLimit:    { increment: 1 } }
          : tool === "MASTERING"  ? { aiMasterCreditsLimit:   { increment: 1 } }
          : tool === "AAR_REPORT" ? { aarReportCreditsLimit:  { increment: 1 } }
          : tool === "PRESS_KIT"  ? { pressKitCreditsLimit:   { increment: 1 } }
          : null;

        if (!creditField) break;

        await db.subscription.upsert({
          where: { userId },
          update: creditField,
          create: {
            userId,
            tier: "LAUNCH",
            status: "ACTIVE",
            stripeSubscriptionId: null,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            aiVideoCreditsLimit:    tool === "AI_VIDEO"    ? 1 : 0,
            aiArtCreditsLimit:      tool === "COVER_ART"   ? 1 : 0,
            aiMasterCreditsLimit:   tool === "MASTERING"   ? 1 : 0,
            lyricVideoCreditsLimit: tool === "LYRIC_VIDEO" ? 1 : 0,
            aarReportCreditsLimit:  tool === "AAR_REPORT"  ? 1 : 0,
            pressKitCreditsLimit:   tool === "PRESS_KIT"   ? 1 : 0,
            aiVideoCreditsUsed: 0,
            aiArtCreditsUsed:   0,
            aiMasterCreditsUsed: 0,
            lyricVideoCreditsUsed: 0,
            aarReportCreditsUsed: 0,
            pressKitCreditsUsed: 0,
          },
        });

        // Credit any studios that referred this artist (fire-and-forget)
        void creditStudioForArtistPurchase(userId, "PAY_PER_USE");

        break;
      }

      break;
    }

    case "customer.subscription.updated": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const tier   = sub.metadata?.tier;
      if (!userId || !tier) break;

      const isActive = sub.status === "active" || sub.status === "trialing";
      const credits  = TIER_CREDITS[tier] ?? TIER_CREDITS.LAUNCH;

      await db.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          tier: tier as "LAUNCH" | "PUSH" | "REIGN",
          status: isActive ? "ACTIVE" : "PAST_DUE",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
          ...credits,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "CANCELLED" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as { id: string } | null)?.id;
      if (subId) {
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }

    // Apply studio referral credits before each subscription invoice is
    // finalised so the credit reduces what the studio owner actually pays.
    case "invoice.upcoming": {
      const upcomingInvoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof upcomingInvoice.customer === "string"
          ? upcomingInvoice.customer
          : (upcomingInvoice.customer as { id: string } | null)?.id;
      if (customerId) {
        void applyStudioCreditsToStripeInvoice(customerId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
