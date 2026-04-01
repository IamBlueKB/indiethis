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
import { triggerMerchAutomations, triggerTipAutomations } from "@/lib/fan-automation-triggers";
import { processAmbassadorReward } from "@/lib/ambassador-rewards";
import {
  sendEmail, sendOnboardingWelcomeEmail,
  sendMerchOrderConfirmationEmail, sendSelfFulfilledOrderEmail,
} from "@/lib/brevo/email";
import { createOrder as createPrintfulOrder } from "@/lib/printful";
import { getStreamLeasePricing } from "@/lib/stream-lease-pricing";
import { createNotification } from "@/lib/notifications";
import { createUserFromPending } from "@/lib/create-user-from-pending";
import { startPaymentRecoverySequence } from "@/lib/agents/payment-recovery";

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
  PUSH:   { aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 3,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 1 },
  REIGN:  { aiVideoCreditsLimit: 5, aiArtCreditsLimit: 15, aiMasterCreditsLimit: 10, lyricVideoCreditsLimit: 3, aarReportCreditsLimit: 5, pressKitCreditsLimit: 3 },
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

      // --- Invoice payment ---
      if (checkSession.metadata?.type === "invoice_payment") {
        const invoiceId = checkSession.metadata.invoiceId;
        if (invoiceId) {
          const inv = await db.invoice.findUnique({
            where: { id: invoiceId },
            include: {
              studio: { select: { ownerId: true, name: true } },
              contact: { select: { name: true, email: true } },
            },
          });
          if (inv && inv.status !== "PAID") {
            const paidAmount = checkSession.amount_total ? checkSession.amount_total / 100 : inv.total;
            await db.invoice.update({
              where: { id: invoiceId },
              data: { status: "PAID", paidAt: new Date(), paymentMethod: "STRIPE" },
            });
            await db.contact.update({
              where: { id: inv.contactId },
              data: { totalSpent: { increment: paidAmount } },
            });
            await db.activityLog.create({
              data: {
                contactId: inv.contactId,
                studioId: inv.studioId,
                type: "PAYMENT_RECEIVED",
                description: `Invoice #${String(inv.invoiceNumber).padStart(4, "0")} paid via Stripe — $${paidAmount.toFixed(2)}`,
                metadata: { invoiceId, amount: paidAmount },
              },
            });
            await createNotification({
              userId: inv.studio.ownerId,
              type: "PAYMENT_RECEIVED",
              title: `Invoice #${String(inv.invoiceNumber).padStart(4, "0")} paid`,
              message: `${inv.contact.name} paid $${paidAmount.toFixed(2)} via card.`,
              link: `/studio/invoices`,
            });
          }
        }
        break;
      }

      // --- Intake deposit payment ---
      if (checkSession.metadata?.type === "intake_deposit") {
        const { submissionId, studioId } = checkSession.metadata;
        if (submissionId) {
          const paidAmount = checkSession.amount_total ? checkSession.amount_total / 100 : 0;
          await db.intakeSubmission.update({
            where: { id: submissionId },
            data: { depositPaid: true, depositAmount: paidAmount, paymentMethod: "stripe" },
          }).catch(() => {});
          if (studioId) {
            const sub = await db.intakeSubmission.findUnique({
              where: { id: submissionId },
              select: { artistName: true },
            });
            const owner = await db.studio.findUnique({ where: { id: studioId }, select: { ownerId: true } });
            if (owner?.ownerId) {
              await createNotification({
                userId: owner.ownerId,
                type: "PAYMENT_RECEIVED",
                title: "Deposit received",
                message: `${sub?.artistName ?? "Artist"} paid a $${paidAmount.toFixed(2)} session deposit via card.`,
                link: "/studio/inbox",
              });
            }
          }
        }
        break;
      }

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

          // Auto-cancel any active stream lease this artist has on this beat.
          // A full license grants distribution rights outside IndieThis, so the
          // $1/mo restriction no longer applies — the lease is superseded.
          await db.streamLease.updateMany({
            where: { artistId: buyerId, beatId: trackId, isActive: true },
            data:  { isActive: false, cancelledAt: new Date() },
          });

          // Notify producer of the beat license sale
          const soldTrack = await db.track.findUnique({
            where: { id: trackId },
            select: { title: true },
          });
          const buyer = await db.user.findUnique({
            where: { id: buyerId },
            select: { name: true, artistName: true },
          });
          const buyerName = buyer?.artistName ?? buyer?.name ?? "An artist";
          void createNotification({
            userId: producerId,
            type: "BEAT_LICENSE_SOLD",
            title: "Beat license sold!",
            message: `${buyerName} purchased a ${licenseType} license for "${soldTrack?.title ?? "your beat"}" — $${paidAmount.toFixed(2)}`,
            link: "/dashboard/producer/licensing",
          }).catch(() => {});
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

          // Fan automation triggers
          void triggerTipAutomations(artistId, supporterEmail, paidAmount);

          // Notify artist of tip received
          void createNotification({
            userId: artistId,
            type: "TIP_RECEIVED",
            title: "You received a tip! 💸",
            message: `${supporterEmail} sent you $${paidAmount.toFixed(2)}${message ? `: "${message}"` : ""}`,
            link: "/dashboard/earnings",
          }).catch(() => {});
        }
        break;
      }

      // --- Merch purchase (no userId — buyer is a fan, not a platform user) ---
      if (checkSession.metadata?.type === "MERCH") {
        const meta = checkSession.metadata;
        const { artistId, buyerEmail } = meta;

        // Parse multi-item array from metadata; fall back to legacy single-item
        let rawItems: { v: string; q: number }[] = [];
        try { rawItems = meta.items ? JSON.parse(meta.items) : []; } catch { /* */ }
        if (rawItems.length === 0 && meta.variantId) {
          rawItems = [{ v: meta.variantId, q: Math.max(1, parseInt(meta.quantity ?? "1", 10)) }];
        }

        // Parse shipping address + cost
        let shippingAddress: Record<string, string> | null = null;
        try { shippingAddress = meta.shippingAddress ? JSON.parse(meta.shippingAddress) : null; } catch { /* */ }
        const shippingCost = parseFloat(meta.shippingCost ?? "0") || 0;

        // Fetch all variants with product info
        const variantIds = rawItems.map((i) => i.v);
        const variants = await db.merchVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            retailPrice: true,
            basePrice: true,
            printfulVariantId: true,
            size: true,
            color: true,
            product: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                markup: true,
                fulfillmentType: true,
              },
            },
          },
        });

        if (variants.length > 0 && artistId && buyerEmail) {
          // Compute totals
          let itemsSubtotal = 0;
          let artistEarningsTotal = 0;
          let platformCutTotal = 0;

          const itemsData: {
            orderId: string;
            variantId: string;
            productId: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
          }[] = [];

          let hasSelfFulfilled = false;

          for (const ri of rawItems) {
            const v = variants.find((v) => v.id === ri.v);
            if (!v) continue;
            const qty      = Math.max(1, ri.q);
            const subtotal = v.retailPrice * qty;
            itemsSubtotal += subtotal;

            if (v.product.fulfillmentType === "POD") {
              // POD: profit = retailPrice - basePrice; platform takes 15% of profit
              const profit        = v.retailPrice - v.basePrice;
              platformCutTotal    += Math.round(profit * 0.15 * qty * 100) / 100;
              artistEarningsTotal += Math.round(profit * 0.85 * qty * 100) / 100;
            } else {
              // Self-fulfilled: platform takes 15% of product price; artist keeps rest + shipping
              platformCutTotal    += Math.round(v.retailPrice * 0.15 * qty * 100) / 100;
              artistEarningsTotal += Math.round(v.retailPrice * 0.85 * qty * 100) / 100;
              hasSelfFulfilled = true;
            }

            itemsData.push({
              orderId:   "", // filled after order creation
              variantId: v.id,
              productId: v.product.id,
              quantity:  qty,
              unitPrice: v.retailPrice,
              subtotal,
            });
          }

          // Self-fulfilled: artist keeps the shipping cost
          if (hasSelfFulfilled && shippingCost > 0) {
            artistEarningsTotal += shippingCost;
          }

          const totalPrice = itemsSubtotal + shippingCost;

          // Buyer name from shipping address
          const buyerName = (shippingAddress?.name as string | undefined) ?? buyerEmail.split("@")[0] ?? "Buyer";

          const order = await db.merchOrder.create({
            data: {
              artistId,
              buyerEmail,
              buyerName,
              shippingAddress: shippingAddress ?? undefined,
              shippingCost,
              totalPrice,
              platformCut:    platformCutTotal,
              artistEarnings: artistEarningsTotal,
              stripePaymentId:
                typeof checkSession.payment_intent === "string"
                  ? checkSession.payment_intent
                  : checkSession.id,
            },
          });

          // Create order items
          await db.merchOrderItem.createMany({
            data: itemsData.map((d) => ({ ...d, orderId: order.id })),
          });

          // Accumulate artist balance
          void db.user.update({
            where: { id: artistId },
            data: {
              artistBalance:       { increment: artistEarningsTotal },
              artistTotalEarnings: { increment: artistEarningsTotal },
            },
          }).catch(() => {});

          // DJ attribution for merch (10% of artist earnings → DJ)
          const djAttributionId = checkSession.metadata?.djAttributionId ?? null;
          if (djAttributionId && artistEarningsTotal > 0) {
            void (async () => {
              try {
                const attribution = await db.dJAttribution.findUnique({
                  where: { id: djAttributionId },
                  select: { id: true, djProfileId: true, expiresAt: true },
                });
                const artistOpts = await db.user.findUnique({
                  where: { id: artistId },
                  select: { djDiscoveryOptIn: true },
                });
                if (attribution && artistOpts?.djDiscoveryOptIn && attribution.expiresAt > new Date()) {
                  const djCut = Math.round(artistEarningsTotal * 0.10 * 100) / 100;
                  const djCutCents = Math.round(djCut * 100);
                  await db.dJProfile.update({
                    where: { id: attribution.djProfileId },
                    data: { balance: { increment: djCutCents }, totalEarnings: { increment: djCutCents } },
                  });
                  await db.user.update({
                    where: { id: artistId },
                    data: { artistBalance: { increment: -(djCut) } },
                  });
                }
              } catch { /* non-critical */ }
            })();
          }

          // Fan scoring + automations
          void upsertFanScore(artistId, buyerEmail, { merch: totalPrice });
          void triggerMerchAutomations(artistId, buyerEmail);

          // Decrement stock for self-fulfilled variants
          for (const ri of rawItems) {
            const v = variants.find((vv) => vv.id === ri.v);
            if (!v || v.product.fulfillmentType !== "SELF_FULFILLED") continue;
            const qty = Math.max(1, ri.q);
            void db.merchVariant.update({
              where: { id: v.id },
              data:  { stockQuantity: { decrement: qty } },
            }).then(async (updated) => {
              const remaining = updated.stockQuantity ?? 0;
              if (remaining <= 3 && remaining >= 0) {
                void createNotification({
                  userId:  artistId,
                  type:    "MERCH_ORDER",
                  title:   "Low stock warning",
                  message: `Your "${v.product.title}" has only ${remaining} left in stock`,
                  link:    "/dashboard/merch",
                }).catch(() => {});
              }
            }).catch(() => {});
          }

          // Notify artist
          const firstProduct = variants[0]!.product;
          const artistEarningsDisplay = artistEarningsTotal.toFixed(2);
          void createNotification({
            userId:  artistId,
            type:    "MERCH_ORDER",
            title:   "New merch order!",
            message: rawItems.length === 1
              ? `You sold a "${firstProduct.title}" to ${buyerName}! You earn $${artistEarningsDisplay}`
              : `You sold ${rawItems.length} items to ${buyerName}! You earn $${artistEarningsDisplay}`,
            link:    "/dashboard/merch",
          }).catch(() => {});

          // Build item summaries for emails
          const emailItems = itemsData.map((d) => {
            const v = variants.find((v) => v.id === d.variantId)!;
            return { title: v.product.title, size: v.size, color: v.color, quantity: d.quantity, unitPrice: d.unitPrice };
          });

          // Get artist info for emails
          const artist = await db.user.findUnique({
            where:  { id: artistId },
            select: { email: true, name: true, artistName: true, artistSlug: true },
          });

          // Send buyer confirmation email
          if (shippingAddress) {
            const addr = shippingAddress as { name?: string; address1: string; address2?: string; city: string; state: string; zip: string; country: string };
            void sendMerchOrderConfirmationEmail({
              buyerEmail,
              buyerName,
              orderId:     order.id,
              artistName:  artist?.artistName ?? artist?.name ?? "Artist",
              artistSlug:  artist?.artistSlug ?? "",
              shippingAddress: {
                line1:   addr.address1,
                line2:   addr.address2,
                city:    addr.city,
                state:   addr.state,
                zip:     addr.zip,
                country: addr.country,
              },
              items:        emailItems,
              subtotal:     itemsSubtotal,
              shippingCost,
              total:        totalPrice,
            }).catch(() => {});
          }

          // For self-fulfilled items: notify artist with shipping details
          if (hasSelfFulfilled && artist?.email && shippingAddress) {
            const sfAddr = shippingAddress as { name?: string; address1: string; address2?: string; city: string; state: string; zip: string; country: string };
            void sendSelfFulfilledOrderEmail({
              artistEmail: artist.email,
              artistName:  artist.artistName ?? artist.name ?? "Artist",
              orderId:     order.id,
              buyerName,
              buyerEmail,
              shippingAddress: {
                line1:   sfAddr.address1,
                line2:   sfAddr.address2,
                city:    sfAddr.city,
                state:   sfAddr.state,
                zip:     sfAddr.zip,
                country: sfAddr.country,
              },
              items:       emailItems.filter((_, i) => variants[i]?.product.fulfillmentType === "SELF_FULFILLED"),
              totalPrice,
            }).catch(() => {});
          }

          // For POD items: submit to Printful
          const podVariants = variants.filter((v) => v.product.fulfillmentType === "POD" && v.printfulVariantId);
          if (podVariants.length > 0 && shippingAddress && process.env.PRINTFUL_API_KEY) {
            void (async () => {
              try {
                const sfAddr = shippingAddress as { name?: string; address1: string; address2?: string; city: string; state: string; zip: string; country: string };
                const printfulItems = itemsData
                  .filter((d) => podVariants.find((v) => v.id === d.variantId))
                  .map((d) => {
                    const v = podVariants.find((pv) => pv.id === d.variantId)!;
                    return {
                      variant_id:   v.printfulVariantId!,
                      quantity:     d.quantity,
                      retail_price: d.unitPrice.toFixed(2),
                      files:        [] as { url: string; placement: string }[],
                    };
                  });

                const printfulOrder = await createPrintfulOrder(
                  order.id,
                  {
                    name:         buyerName,
                    address1:     sfAddr.address1,
                    address2:     sfAddr.address2,
                    city:         sfAddr.city,
                    state_code:   sfAddr.state,
                    country_code: sfAddr.country || "US",
                    zip:          sfAddr.zip,
                    email:        buyerEmail,
                  },
                  printfulItems,
                  {
                    subtotal: itemsSubtotal.toFixed(2),
                    shipping: shippingCost.toFixed(2),
                  },
                );

                await db.merchOrder.update({
                  where: { id: order.id },
                  data:  {
                    printfulOrderId:   printfulOrder.id,
                    fulfillmentStatus: "PROCESSING",
                  },
                });
              } catch (printfulErr) {
                console.error("[webhook/merch] Printful order failed:", printfulErr);
              }
            })();
          }
        }
        break;
      }

      // --- Digital product purchase ---
      if (checkSession.metadata?.type === "DIGITAL_PRODUCT") {
        const { productId, buyerEmail, platformFee: feeStr, artistEarnings: earningsStr } = checkSession.metadata;
        if (productId && buyerEmail) {
          const alreadyPurchased = await db.digitalPurchase.findFirst({
            where: { stripePaymentId: checkSession.id },
            select: { id: true },
          });
          if (!alreadyPurchased) {
            const djAttributionIdMeta = checkSession.metadata?.djAttributionId ?? null;
            const artistEarnings = parseInt(earningsStr ?? "0", 10);

            const purchase = await db.digitalPurchase.create({
              data: {
                digitalProductId: productId,
                buyerEmail,
                amount:          checkSession.amount_total ?? 0,
                platformFee:     parseInt(feeStr ?? "0", 10),
                artistEarnings,
                stripePaymentId: checkSession.id,
                ...(djAttributionIdMeta ? { djAttributionId: djAttributionIdMeta } : {}),
              },
              include: {
                digitalProduct: {
                  select: { title: true, userId: true },
                },
              },
            });

            // DJ attribution split — 10% of artist portion if artist opted in
            if (djAttributionIdMeta) {
              void (async () => {
                try {
                  const artistUser = await db.user.findUnique({
                    where: { id: purchase.digitalProduct.userId },
                    select: { djDiscoveryOptIn: true },
                  });
                  if (artistUser?.djDiscoveryOptIn) {
                    const djCut = Math.round(artistEarnings * 0.10);
                    const djProfile = await db.dJProfile.findUnique({
                      where: { id: djAttributionIdMeta },
                      select: { id: true },
                    });
                    if (djProfile) {
                      await db.dJProfile.update({
                        where: { id: djProfile.id },
                        data: {
                          balance:       { increment: djCut },
                          totalEarnings: { increment: djCut },
                        },
                      });
                      await db.dJAttribution.create({
                        data: {
                          djProfileId:  djProfile.id,
                          fanSessionId: checkSession.id,
                          sourceType:   "PURCHASE",
                          sourceId:     purchase.id,
                          artistId:     purchase.digitalProduct.userId,
                          amount:       djCut,
                          expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        },
                      });
                    }
                  }
                } catch (e) {
                  console.error("[DJ Attribution] split failed:", e);
                }
              })();
            }

            // Send buyer download email
            const dlLink = `${process.env.NEXTAUTH_URL ?? "https://indiethis.com"}/dl/digital/${purchase.downloadToken}`;
            void sendEmail({
              to: { email: buyerEmail },
              subject: `Your download is ready: ${purchase.digitalProduct.title}`,
              htmlContent: `
                <p>Thanks for your purchase!</p>
                <p>Your download link for <strong>${purchase.digitalProduct.title}</strong> is ready:</p>
                <p><a href="${dlLink}">${dlLink}</a></p>
                <p>This link allows up to ${purchase.maxDownloads} downloads.</p>
                <p>— The IndieThis Team</p>
              `,
            }).catch(() => {});

            // Notify artist
            void createNotification({
              userId: purchase.digitalProduct.userId,
              type: "MUSIC_SALE",
              title: "New digital sale!",
              message: `Someone purchased "${purchase.digitalProduct.title}" — you earn $${(purchase.artistEarnings / 100).toFixed(2)}`,
              link: "/dashboard/music/sales",
            }).catch(() => {});
          }
        }
        break;
      }

      // --- Atomic new-signup fallback (PendingSignup flow) ---
      // The /signup/complete page is the primary account creator; this webhook
      // handler is the idempotent fallback in case the user closes the tab before
      // the complete page polls successfully.
      const pendingSignupId = checkSession.metadata?.pending_signup_id;
      if (pendingSignupId) {
        const pending = await db.pendingSignup.findUnique({ where: { id: pendingSignupId } });
        if (pending) {
          const alreadyExists = await db.user.findUnique({
            where:  { email: pending.email },
            select: { id: true },
          });
          if (!alreadyExists) {
            const stripeSubscriptionId =
              typeof checkSession.subscription === "string"
                ? checkSession.subscription
                : (checkSession.subscription as { id: string } | null)?.id ?? null;
            const tier = pending.tier ?? checkSession.metadata?.tier ?? "LAUNCH";
            await createUserFromPending(pending, stripeSubscriptionId, tier);
          }
        }
        return NextResponse.json({ received: true });
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
            smsBroadcastsUsed: 0,
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
            smsBroadcastsUsed: 0,
          },
        });

        // Credit any studios that referred this artist (fire-and-forget)
        void creditStudioForArtistPurchase(userId, "SUBSCRIPTION");

        // Activate the user-referral record if this user was referred
        void activateReferral(userId);

        // Activate the affiliate referral if this user arrived via an affiliate link
        void activateAffiliateReferral(userId);

        // Record plan selection timestamp for onboarding funnel analytics
        void db.user.update({
          where: { id: userId },
          data:  { planSelectedAt: new Date() },
        }).catch(console.error);

        // Onboarding welcome email (Day 0) — fire and log
        void (async () => {
          try {
            const newUser = await db.user.findUnique({
              where:  { id: userId },
              select: { email: true, name: true, onboardingEmails: { select: { emailType: true } } },
            });
            const alreadySent = newUser?.onboardingEmails.some((e) => e.emailType === "WELCOME");
            if (newUser && !alreadySent) {
              await sendOnboardingWelcomeEmail({ email: newUser.email, name: newUser.name ?? "there" });
              await db.onboardingEmailLog.create({ data: { userId, emailType: "WELCOME" } });
            }
          } catch (e) { console.error("[onboarding-welcome]", e); }
        })();

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

        // --- Release Bundle: queue cover art + lyric video, then canvas auto-follows ---
        if (tool === "RELEASE_BUNDLE") {
          const trackId = checkSession.metadata?.trackId;
          if (trackId && userId) {
            void (async () => {
              try {
                const track = await db.track.findUnique({
                  where: { id: trackId },
                  include: { audioFeatures: true },
                });
                if (!track) return;

                const { createAIJob } = await import("@/lib/ai-jobs");
                const { processAIJob } = await import("@/lib/ai-job-processor");

                // Build a basic prompt from audio features — processor will optimize via Sonnet
                const af = track.audioFeatures;
                const promptParts = [
                  af?.genre ? `${af.genre} music` : "music",
                  af?.mood  ? `${af.mood} mood`   : "atmospheric mood",
                  "album cover art, cinematic composition, professional music industry quality",
                ].filter(Boolean);
                const artistPrompt = promptParts.join(", ");

                // 1. Queue cover art — bundleTrackId triggers canvas after completion
                const coverArtResult = await createAIJob({
                  type:           "COVER_ART",
                  triggeredBy:    "ARTIST",
                  triggeredById:  userId,
                  artistId:       userId,
                  inputData: {
                    artistPrompt,
                    style:          "cinematic",
                    mood:           af?.mood ?? "atmospheric",
                    quality:        "standard",
                    bundleUserId:   userId,
                    bundleTrackId:  trackId,
                  },
                  priceAlreadyCharged: true,
                  chargedAmount:       4.99,
                });
                if (coverArtResult.success && coverArtResult.jobId) {
                  void processAIJob(coverArtResult.jobId).catch(() => {});
                }

                // 2. Queue lyric video (Whisper transcription + LyricVideo composition)
                const lyricResult = await createAIJob({
                  type:          "LYRIC_VIDEO",
                  triggeredBy:   "ARTIST",
                  triggeredById: userId,
                  artistId:      userId,
                  inputData: {
                    trackUrl:    track.fileUrl,
                    trackId:     track.id,
                    visualStyle: "cinematic",
                    fontStyle:   "modern",
                    accentColor: "#D4A843",
                    aspectRatio: "9:16",
                  },
                  priceAlreadyCharged: true,
                  chargedAmount:       14.99,
                });
                if (lyricResult.success && lyricResult.jobId) {
                  void processAIJob(lyricResult.jobId).catch(() => {});
                }

                // Notify artist
                await createNotification({
                  userId,
                  type:    "AI_JOB_COMPLETE",
                  title:   "Your release bundle is processing",
                  message: `Cover art and lyric video for "${track.title}" are in the queue. Canvas video will auto-generate once cover art is ready.`,
                  link:    "/dashboard/music",
                });
              } catch (e) {
                console.error("[webhook] RELEASE_BUNDLE queue error:", e);
              }
            })();
          }
          break;
        }

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
            smsBroadcastsUsed: 0,
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
      const sub             = event.data.object as Stripe.Subscription;
      const cancelledUserId = sub.metadata?.userId;

      await db.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data:  { status: "CANCELLED" },
      });

      // Auto-cancel all active stream leases when subscription is cancelled.
      // Songs stay live until end of billing period (cancellAt is set, isActive = false).
      // The invoice.created handler checks isActive, so no future charges will fire.
      if (cancelledUserId) {
        const now = new Date();
        const activeLeaseCount = await db.streamLease.count({
          where: { artistId: cancelledUserId, isActive: true },
        });

        if (activeLeaseCount > 0) {
          await db.streamLease.updateMany({
            where: { artistId: cancelledUserId, isActive: true },
            data:  { isActive: false, cancelledAt: now },
          });
          console.log(`[subscription.deleted] Auto-cancelled ${activeLeaseCount} stream lease(s) for user ${cancelledUserId}`);
        }

        // Deactivate the referral record — referrer no longer earns credit
        // for a subscriber who has churned.
        void deactivateReferral(cancelledUserId);
        // Also deactivate affiliate commission tracking for this user
        void deactivateAffiliateReferral(cancelledUserId);
      }
      break;
    }

    case "invoice.payment_failed": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failedInvoice = event.data.object as any;
      const failedSubId = typeof failedInvoice.subscription === "string"
        ? failedInvoice.subscription
        : (failedInvoice.subscription as { id: string } | null)?.id;
      const failedCustomerId: string | undefined =
        typeof failedInvoice.customer === "string"
          ? failedInvoice.customer
          : (failedInvoice.customer as { id: string } | null)?.id;

      // Always mark subscription PAST_DUE
      if (failedSubId) {
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: failedSubId },
          data: { status: "PAST_DUE" },
        });
      }

      // ── Stream Lease: grace period + email ───────────────────────────────
      if (failedCustomerId) {
        const failedUser = await db.user.findFirst({
          where: { stripeCustomerId: failedCustomerId },
          select: { id: true, email: true, name: true, artistName: true, artistSlug: true },
        });

        if (failedUser) {
          const activeLeases = await db.streamLease.findMany({
            where: { artistId: failedUser.id, isActive: true },
            select: { id: true, trackTitle: true, producerId: true },
          });

          if (activeLeases.length > 0) {
            const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
            const graceUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

            // Set 3-day grace period on subscription
            await db.subscription.updateMany({
              where: { userId: failedUser.id },
              data: { streamLeaseGraceUntil: graceUntil },
            });

            // Log FAILED payment record for each active lease (idempotent)
            const failedInvoiceId = failedInvoice.id as string;
            await Promise.all(
              activeLeases.map(async (lease) => {
                const already = await db.streamLeasePayment.findFirst({
                  where: { streamLeaseId: lease.id, stripeInvoiceId: failedInvoiceId, status: "FAILED" },
                  select: { id: true },
                });
                if (already) return;
                await db.streamLeasePayment.create({
                  data: {
                    streamLeaseId:   lease.id,
                    artistId:        failedUser.id,
                    producerId:      lease.producerId,
                    totalAmount:     1.00,
                    producerAmount:  0.70,
                    platformAmount:  0.30,
                    stripeInvoiceId: failedInvoiceId,
                    status:          "FAILED",
                    failedAt:        new Date(),
                    failureReason:   "Invoice payment failed",
                  },
                });
              })
            );

            // In-app notification: payment failed
            void createNotification({
              userId: failedUser.id,
              type: "SUBSCRIPTION_FAILED",
              title: "Payment failed — action required",
              message: `Your payment didn't go through. Update your payment method within 3 days to keep your ${activeLeases.length} stream lease${activeLeases.length !== 1 ? "s" : ""} active.`,
              link: "/dashboard/settings",
            }).catch(() => {});

            // Email artist: update payment method within 3 days
            const artistName = failedUser.artistName ?? failedUser.name;
            const billingUrl = `${appUrl}/dashboard/settings`;
            if (failedUser.email) {
              void sendEmail({
                to:      { email: failedUser.email, name: artistName },
                subject: "Action required: Update your payment method to keep your songs live",
                htmlContent: `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;background:#fff">
  <div style="background:#FF3B30;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center">
    <p style="color:#fff;font-size:13px;font-weight:600;margin:0;letter-spacing:.08em;text-transform:uppercase">Payment Failed</p>
    <p style="color:#fff;font-size:22px;font-weight:700;margin:8px 0 0">Your payment didn't go through</p>
  </div>
  <p style="font-size:15px;line-height:1.6;margin-bottom:12px">Hi ${artistName},</p>
  <p style="font-size:15px;line-height:1.6;margin-bottom:12px">Your last payment failed. You have <strong>3 days</strong> to update your payment method before your ${activeLeases.length} stream-leased ${activeLeases.length === 1 ? "song" : "songs"} come down.</p>
  <p style="font-size:15px;line-height:1.6;margin-bottom:24px">If payment isn't updated by ${graceUntil.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, your stream leases will be cancelled. You can reactivate them later from your dashboard.</p>
  <a href="${billingUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px">Update Payment Method</a>
  <p style="font-size:12px;color:#888;margin-top:32px">IndieThis · <a href="${appUrl}" style="color:#D4A843">indiethis.com</a></p>
</body>
</html>`,
                tags: ["stream-lease-payment-failed"],
              }).catch((err) => console.error("[stream-lease] payment failed email error:", err));
            }
          }
        }
      }

      // ── Payment Recovery Sequence: Day 0 ──────────────────────────────────
      // Kick off the escalation email sequence for any subscription payment failure.
      if (failedCustomerId) {
        const recoveryUser = await db.user.findFirst({
          where:  { stripeCustomerId: failedCustomerId },
          select: { id: true },
        });
        if (recoveryUser) {
          void startPaymentRecoverySequence(recoveryUser.id).catch(
            (err) => console.error("[payment-recovery] Day0 error:", err)
          );
        }
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

      // Reset all AI credit usage counters on monthly renewal.
      // billing_reason === "subscription_cycle" fires only on recurring renewals,
      // not on initial creation (subscription_create) or mid-cycle upgrades
      // (subscription_update / proration). Initial creation already resets credits
      // inside the checkout.session.completed handler above.
      if (paidInvoice.billing_reason === "subscription_cycle") {
        await db.subscription.updateMany({
          where: { userId: sub.userId },
          data: {
            aiVideoCreditsUsed:    0,
            aiArtCreditsUsed:      0,
            aiMasterCreditsUsed:   0,
            lyricVideoCreditsUsed: 0,
            aarReportCreditsUsed:  0,
            pressKitCreditsUsed:   0,
            smsBroadcastsUsed:     0,
          },
        });
      }

      // Clear any stream lease grace period — payment succeeded
      await db.subscription.updateMany({
        where: { userId: sub.userId, streamLeaseGraceUntil: { not: null } },
        data:  { streamLeaseGraceUntil: null },
      });

      // Notify user of subscription renewal
      const renewedSub = await db.subscription.findFirst({
        where: { userId: sub.userId },
        select: { tier: true },
      });
      if (renewedSub?.tier) {
        const tierLabel = renewedSub.tier.charAt(0) + renewedSub.tier.slice(1).toLowerCase();
        void createNotification({
          userId: sub.userId,
          type: "SUBSCRIPTION_RENEWED",
          title: "Subscription renewed",
          message: `Your ${tierLabel} plan renewed successfully — $${(amountPaid / 100).toFixed(2)}`,
          link: "/dashboard/settings",
        }).catch(() => {});
      }

      // amount_paid is in cents
      void processAffiliateCommission(sub.userId, amountPaid);

      // ── Stream Lease revenue splits ────────────────────────────────────────
      // Fetch full invoice with expanded line items to find stream lease entries.
      // Uses the invoice ID as an idempotency key — skips any lease already recorded.
      if (stripe) {
        try {
          const [fullInvoice, leasePricing] = await Promise.all([
            stripe.invoices.retrieve(paidInvoice.id as string, { expand: ["lines"] }),
            getStreamLeasePricing(),
          ]);

          const leaseLines = (fullInvoice.lines?.data ?? []).filter(
            (line) => !!(line.metadata as Record<string, string>)?.streamLeaseId
          );

          await Promise.all(
            leaseLines.map(async (line) => {
              const meta = line.metadata as Record<string, string>;
              const { streamLeaseId, producerId: lineProducerId, artistId: lineArtistId } = meta;
              if (!streamLeaseId || !lineProducerId || !lineArtistId) return;

              const totalAmount    = line.amount / 100;
              const producerAmount = Math.round(totalAmount * leasePricing.producerShare * 100) / 100;
              const platformAmount = Math.round(totalAmount * leasePricing.platformShare * 100) / 100;

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

      // Add monthly line item per lease not already present — price from PlatformPricing
      const leasesToAdd = activeLeases.filter((l) => !existingLeaseIds.has(l.id));
      const createdPricing = await getStreamLeasePricing();
      await Promise.all(
        leasesToAdd.map((lease) =>
          stripe!.invoiceItems.create({
            customer:    draftCustomerId,
            invoice:     draftInvoice.id as string,
            amount:      createdPricing.monthlyPriceCents,
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

  // ── DJ Payout: Stripe Connect transfer events ──────────────────────────
  // transfer.paid / transfer.failed are not in the Stripe SDK event union
  // (Connect-only events), so they are handled outside the switch.
  // NOTE: Add "transfer.paid" and "transfer.failed" to your Stripe dashboard
  //       webhook subscribed events for this endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEvent = event as any;

  if (rawEvent.type === "transfer.paid") {
    const transferId: string | undefined = rawEvent.data?.object?.id;
    if (transferId) {
      // DJ withdrawal
      const djWithdrawal = await db.dJWithdrawal.findFirst({
        where: { stripeTransferId: transferId },
        select: { id: true },
      });
      if (djWithdrawal) {
        await db.dJWithdrawal.update({
          where: { id: djWithdrawal.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
      // Artist withdrawal
      const artistWithdrawal = await db.artistWithdrawal.findFirst({
        where: { stripeTransferId: transferId },
        select: { id: true },
      });
      if (artistWithdrawal) {
        await db.artistWithdrawal.update({
          where: { id: artistWithdrawal.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
    }
  }

  if (rawEvent.type === "transfer.failed") {
    const transferId: string | undefined = rawEvent.data?.object?.id;
    if (transferId) {
      // DJ withdrawal
      const failedDJ = await db.dJWithdrawal.findFirst({
        where: { stripeTransferId: transferId },
        select: { id: true, amount: true, djProfileId: true },
      });
      if (failedDJ) {
        await db.$transaction([
          db.dJWithdrawal.update({
            where: { id: failedDJ.id },
            data: { status: "FAILED" },
          }),
          db.dJProfile.update({
            where: { id: failedDJ.djProfileId },
            data: { balance: { increment: failedDJ.amount } },
          }),
        ]);
      }
      // Artist withdrawal
      const failedArtist = await db.artistWithdrawal.findFirst({
        where: { stripeTransferId: transferId },
        select: { id: true, amount: true, userId: true },
      });
      if (failedArtist) {
        await db.$transaction([
          db.artistWithdrawal.update({
            where: { id: failedArtist.id },
            data: { status: "FAILED" },
          }),
          db.user.update({
            where: { id: failedArtist.userId },
            data: { artistBalance: { increment: failedArtist.amount } },
          }),
        ]);
      }
    }
  }

  return NextResponse.json({ received: true });
}
