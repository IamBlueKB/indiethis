import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { LicenseType } from "@prisma/client";
import {
  creditStudioForArtistPurchase,
  applyStudioCreditsToStripeInvoice,
} from "@/lib/studio-referral";
import { cancelFollowUpByEmail } from "@/lib/email-sequence";
import { activateReferral, deactivateReferral } from "@/lib/referral-tracking";
import { applyReferralRewardsToInvoice } from "@/lib/referral-billing";
import {
  activateAffiliateReferral,
  processAffiliateCommission,
  deactivateAffiliateReferral,
} from "@/lib/affiliate-commissions";
import { upsertFanScore } from "@/lib/fan-scores";
import { processAmbassadorReward } from "@/lib/ambassador-rewards";

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

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
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

      // --- Support tip (fan → artist, no platform userId) ---
      if (checkSession.metadata?.type === "SUPPORT_TIP") {
        const { artistId, supporterEmail, message } = checkSession.metadata;
        const paidAmount = checkSession.amount_total ? checkSession.amount_total / 100 : 0;

        if (artistId && supporterEmail && paidAmount > 0) {
          const stripePaymentId =
            typeof checkSession.payment_intent === "string"
              ? checkSession.payment_intent
              : checkSession.id;

          await db.artistSupport.create({
            data: {
              artistId,
              supporterEmail,
              amount:  paidAmount,
              message: message || null,
              stripePaymentId,
            },
          });

          // Update fan spend ranking
          void upsertFanScore(artistId, supporterEmail, { tip: paidAmount });
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

          // Update fan spend ranking
          if (buyerEmail) void upsertFanScore(artistId, buyerEmail, { merch: totalPrice });
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

        // Activate the user-referral record if this user was referred
        void activateReferral(userId);

        // Activate the affiliate referral if this user arrived via an affiliate link
        void activateAffiliateReferral(userId);

        // Cancel any pending follow-up sequences for this user —
        // no point sending "you should subscribe" to someone who just did.
        const subscribedUser = await db.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (subscribedUser?.email) {
          void cancelFollowUpByEmail(subscribedUser.email);
        }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub    = event.data.object as any;
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
      const sub            = event.data.object as Stripe.Subscription;
      const cancelledUserId = sub.metadata?.userId;

      await db.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data:  { status: "CANCELLED" },
      });

      // Deactivate the referral record — referrer no longer earns credit
      // for a subscriber who has churned.
      if (cancelledUserId) {
        void deactivateReferral(cancelledUserId);
        // Also deactivate affiliate commission tracking for this user
        void deactivateAffiliateReferral(cancelledUserId);
      }
      break;
    }

    case "invoice.payment_failed": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any;
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

    // Track affiliate commissions on every successful subscription invoice payment.
    // Fires for both the initial payment and every monthly renewal.
    case "invoice.paid": {
      // Cast to any — Stripe SDK type for Invoice varies by version;
      // the existing invoice.payment_failed handler uses the same pattern.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paidInvoice = event.data.object as any;

      // Only process subscription invoices (not one-off payments)
      const subId: string | undefined =
        typeof paidInvoice.subscription === "string"
          ? paidInvoice.subscription
          : (paidInvoice.subscription as { id: string } | null)?.id;

      if (!subId) break;

      // stripeSubscriptionId is not @unique — use findFirst
      const sub = await db.subscription.findFirst({
        where: { stripeSubscriptionId: subId },
        select: { userId: true },
      });

      if (!sub?.userId) break;

      const amountPaid = (paidInvoice.amount_paid as number) ?? 0;

      // amount_paid is in cents
      void processAffiliateCommission(sub.userId, amountPaid);

      // ── Stream Lease revenue splits ────────────────────────────────────────
      // Fetch full invoice with expanded line items to find stream lease entries.
      // Uses the invoice ID as an idempotency key — skips any lease already recorded.
      if (stripe) {
        try {
          const fullInvoice = await stripe.invoices.retrieve(paidInvoice.id as string, {
            expand: ["lines"],
          });

          const leaseLines = (fullInvoice.lines?.data ?? []).filter(
            (line) => !!(line.metadata as Record<string, string>)?.streamLeaseId
          );

          await Promise.all(
            leaseLines.map(async (line) => {
              const meta = line.metadata as Record<string, string>;
              const { streamLeaseId, producerId: lineProducerId, artistId: lineArtistId } = meta;
              if (!streamLeaseId || !lineProducerId || !lineArtistId) return;

              const totalAmount    = line.amount / 100;
              const producerAmount = Math.round(totalAmount * 0.70 * 100) / 100;
              const platformAmount = Math.round(totalAmount * 0.30 * 100) / 100;

              // Idempotency check — don't double-record if webhook fires twice
              const alreadyLogged = await db.streamLeasePayment.findFirst({
                where: { streamLeaseId, stripeInvoiceId: paidInvoice.id as string },
                select: { id: true },
              });
              if (alreadyLogged) return;

              // Log the payment split
              await db.streamLeasePayment.create({
                data: {
                  streamLeaseId,
                  artistId:       lineArtistId,
                  producerId:     lineProducerId,
                  totalAmount,
                  producerAmount,
                  platformAmount,
                  stripeInvoiceId: paidInvoice.id as string,
                  paidAt:          new Date(),
                },
              });

              // Record producer earning as a Payment entry
              await db.payment.create({
                data: {
                  userId:         lineProducerId,
                  type:           "STREAM_LEASE_EARNING",
                  amount:         producerAmount,
                  status:         "COMPLETED",
                  stripePaymentId: paidInvoice.id as string,
                  metadata:       { streamLeaseId },
                },
              });

              // Transfer to Stripe Connect if producer has connected their account
              const leaseProducer = await db.user.findUnique({
                where: { id: lineProducerId },
                select: { stripeConnectId: true },
              });
              if (leaseProducer?.stripeConnectId) {
                try {
                  await stripe!.transfers.create({
                    amount:      Math.round(producerAmount * 100),
                    currency:    "usd",
                    destination: leaseProducer.stripeConnectId,
                    description: `Stream Lease earning — lease ${streamLeaseId}`,
                    metadata:    { streamLeaseId, producerId: lineProducerId },
                  });
                } catch (transferErr) {
                  // Log but don't throw — payment is recorded; payout can be retried
                  console.error("[stream-lease] Stripe Connect transfer failed:", transferErr);
                }
              }
            })
          );
        } catch (leaseErr) {
          console.error("[stream-lease] invoice.paid processing failed:", leaseErr);
        }
      }

      // Ambassador PERCENTAGE_RECURRING reward
      // Find if this user has a promo redemption from an ambassador code
      const ambassadorRedemption = await db.promoRedemption.findFirst({
        where: {
          userId: sub.userId,
          status: "CONVERTED",
          promoCode: { ambassadorId: { not: null } },
        },
        include: { promoCode: { select: { ambassadorId: true, ambassador: { select: { rewardType: true } } } } },
      });
      if (
        ambassadorRedemption?.promoCode?.ambassadorId &&
        ambassadorRedemption.promoCode.ambassador?.rewardType === "PERCENTAGE_RECURRING"
      ) {
        void processAmbassadorReward(
          ambassadorRedemption.promoCode.ambassadorId,
          "CONVERSION",
          { subscriptionAmount: amountPaid / 100 }
        );
      }
      break;
    }

    // ── Stream Lease: add $1 per active lease to each new subscription invoice ──
    // Fires when Stripe drafts a new invoice. We add line items here so they
    // appear alongside the subscription charge on a single invoice.
    // Deduplication: check existing line item metadata to avoid double-charging
    // when a Phase-2 pending item is already present on this invoice.
    case "invoice.created": {
      if (!stripe) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draftInvoice = event.data.object as any;

      // Only process subscription invoices
      const draftSubId: string | undefined =
        typeof draftInvoice.subscription === "string"
          ? draftInvoice.subscription
          : (draftInvoice.subscription as { id: string } | null)?.id;
      if (!draftSubId) break;

      const draftCustomerId: string | undefined =
        typeof draftInvoice.customer === "string"
          ? draftInvoice.customer
          : (draftInvoice.customer as { id: string } | null)?.id;
      if (!draftCustomerId) break;

      // Find artist by Stripe customer ID
      const leaseArtist = await db.user.findFirst({
        where: { stripeCustomerId: draftCustomerId },
        select: { id: true },
      });
      if (!leaseArtist) break;

      // Load all active stream leases for this artist
      const activeLeases = await db.streamLease.findMany({
        where: { artistId: leaseArtist.id, isActive: true },
        include: {
          producer: { select: { name: true, artistName: true } },
        },
      });
      if (activeLeases.length === 0) break;

      // Build set of lease IDs already on this draft invoice
      // (Phase 2 may have added a pending item that Stripe auto-attached)
      const existingLeaseIds = new Set<string>(
        ((draftInvoice.lines?.data ?? []) as Array<{ metadata?: Record<string, string> }>)
          .map((l) => l.metadata?.streamLeaseId)
          .filter((id): id is string => !!id)
      );

      // Add $1 line item for each lease not already present
      const leasesToAdd = activeLeases.filter((l) => !existingLeaseIds.has(l.id));
      await Promise.all(
        leasesToAdd.map((lease) =>
          stripe!.invoiceItems.create({
            customer:    draftCustomerId,
            invoice:     draftInvoice.id as string,
            amount:      100,
            currency:    "usd",
            description: `Stream Lease: ${lease.trackTitle} — ${lease.producer.artistName ?? lease.producer.name}`,
            metadata: {
              streamLeaseId: lease.id,
              artistId:      leaseArtist.id,
              producerId:    lease.producerId,
              beatId:        lease.beatId,
            },
          })
        )
      );
      break;
    }

    // Apply billing adjustments before each subscription invoice is finalised:
    //   1. Studio referral credits (reduce what the studio owner pays)
    //   2. User referral reward tier (free month, 20% off, etc.)
    case "invoice.upcoming": {
      const upcomingInvoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof upcomingInvoice.customer === "string"
          ? upcomingInvoice.customer
          : (upcomingInvoice.customer as { id: string } | null)?.id;
      if (customerId) {
        void applyStudioCreditsToStripeInvoice(customerId);
        void applyReferralRewardsToInvoice(customerId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
