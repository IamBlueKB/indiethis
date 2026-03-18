/**
 * referral-billing.ts — Apply referral reward tiers to Stripe invoices.
 *
 * Called from api/stripe/webhook on the invoice.upcoming event so rewards
 * are applied before each invoice is finalised.
 *
 * Reward tier → billing action:
 *   CREDIT_1       — +1 pressKit credit in DB (only credit normally at $0 for all tiers)
 *   FREE_MONTH     — negative Stripe balance transaction = full month free
 *   DISCOUNT_20    — "referral-20pct" Stripe coupon attached to subscription (permanent)
 *   LIFETIME_PUSH  — TODO: migrate subscription to $0 PUSH price
 *   LIFETIME_REIGN — TODO: migrate subscription to $0 REIGN price
 *   NONE           — remove any referral coupon that may be on the subscription
 */

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Stable coupon ID — created automatically on first DISCOUNT_20 award.
const REFERRAL_COUPON_ID = "referral-20pct";

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Inspect the user's current referralRewardTier and apply the corresponding
 * billing action. Called from the invoice.upcoming Stripe webhook.
 */
export async function applyReferralRewardsToInvoice(
  stripeCustomerId: string,
): Promise<void> {
  if (!stripe) return; // STRIPE_SECRET_KEY not configured

  try {
    const user = await db.user.findFirst({
      where:  { stripeCustomerId },
      select: {
        id:                 true,
        referralRewardTier: true,
        subscription: {
          select: { stripeSubscriptionId: true },
        },
      },
    });

    if (!user) return;

    const tier  = user.referralRewardTier;
    const subId = user.subscription?.stripeSubscriptionId ?? null;

    console.log(`[referral-billing] applying tier ${tier} for customer ${stripeCustomerId}`);

    switch (tier) {
      // ── 1 active referral → 1 free press kit credit ──────────────────────
      case "CREDIT_1": {
        // pressKitCreditsLimit is 0 for all tiers by default — this gives a
        // meaningful monthly perk. Note: subscription.updated resets limits
        // from TIER_CREDITS; for a permanent bonus, also apply there.
        await db.subscription.updateMany({
          where: { userId: user.id },
          data:  { pressKitCreditsLimit: { increment: 1 } },
        });
        console.log(`[referral-billing] CREDIT_1 — granted +1 pressKit credit to user ${user.id}`);
        break;
      }

      // ── 3 active referrals → 100% off this month ─────────────────────────
      case "FREE_MONTH": {
        if (!subId) break;

        // Fetch the upcoming invoice to know the amount to waive.
        const upcoming = await stripe.invoices.createPreview({
          customer: stripeCustomerId,
        });

        if (upcoming.amount_due > 0) {
          // Negative balance transaction — Stripe auto-applies it to the
          // next finalised invoice, same pattern as studio referral credits.
          await stripe.customers.createBalanceTransaction(stripeCustomerId, {
            amount:      -upcoming.amount_due,
            currency:    upcoming.currency,
            description: "IndieThis Referral Reward — Free Month (3 active referrals)",
          });
          console.log(
            `[referral-billing] FREE_MONTH — credited ${upcoming.amount_due / 100} ${upcoming.currency.toUpperCase()} to customer ${stripeCustomerId}`,
          );
        }
        break;
      }

      // ── 5 active referrals → 20% off permanently ─────────────────────────
      case "DISCOUNT_20": {
        if (!subId) break;

        await ensureReferralCoupon();

        // Apply coupon to subscription via discounts array (replaces any existing referral discount).
        await stripe.subscriptions.update(subId, {
          discounts: [{ coupon: REFERRAL_COUPON_ID }],
        });
        console.log(`[referral-billing] DISCOUNT_20 — applied ${REFERRAL_COUPON_ID} to subscription ${subId}`);
        break;
      }

      // ── 10 active referrals → PUSH plan free ─────────────────────────────
      case "LIFETIME_PUSH": {
        // TODO: migrate subscription to a $0 PUSH price created in the Stripe
        // dashboard and configured via env var STRIPE_PRICE_ID_PUSH_LIFETIME.
        //
        //   if (subId && process.env.STRIPE_PRICE_ID_PUSH_LIFETIME) {
        //     const sub = await stripe.subscriptions.retrieve(subId);
        //     await stripe.subscriptions.update(subId, {
        //       items: [{ id: sub.items.data[0].id, price: process.env.STRIPE_PRICE_ID_PUSH_LIFETIME }],
        //       proration_behavior: "none",
        //     });
        //   }
        console.log(
          `[referral-billing] LIFETIME_PUSH for user ${user.id} — ` +
          "TODO: configure STRIPE_PRICE_ID_PUSH_LIFETIME and uncomment migration.",
        );
        break;
      }

      // ── 25 active referrals → REIGN plan free ────────────────────────────
      case "LIFETIME_REIGN": {
        // TODO: migrate subscription to a $0 REIGN price created in the Stripe
        // dashboard and configured via env var STRIPE_PRICE_ID_REIGN_LIFETIME.
        //
        //   if (subId && process.env.STRIPE_PRICE_ID_REIGN_LIFETIME) {
        //     const sub = await stripe.subscriptions.retrieve(subId);
        //     await stripe.subscriptions.update(subId, {
        //       items: [{ id: sub.items.data[0].id, price: process.env.STRIPE_PRICE_ID_REIGN_LIFETIME }],
        //       proration_behavior: "none",
        //     });
        //   }
        console.log(
          `[referral-billing] LIFETIME_REIGN for user ${user.id} — ` +
          "TODO: configure STRIPE_PRICE_ID_REIGN_LIFETIME and uncomment migration.",
        );
        break;
      }

      // ── No qualifying referrals → remove any lingering referral discount ──
      case "NONE":
      default: {
        if (subId) await removeReferralDiscount(subId);
        break;
      }
    }
  } catch (err) {
    console.error("[referral-billing] applyReferralRewardsToInvoice failed:", err);
  }
}

// ─── Stripe coupon helpers ────────────────────────────────────────────────────

/**
 * Ensure the reusable "referral-20pct" Stripe coupon exists.
 * Creates it if not found (idempotent — uses a stable ID).
 */
async function ensureReferralCoupon(): Promise<void> {
  if (!stripe) return;
  try {
    await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
  } catch {
    // Coupon doesn't exist yet — create it.
    await stripe.coupons.create({
      id:           REFERRAL_COUPON_ID,
      name:         "IndieThis Referral Reward — 20% Off",
      percent_off:  20,
      duration:     "forever",
    });
    console.log(`[referral-billing] created Stripe coupon ${REFERRAL_COUPON_ID}`);
  }
}

/**
 * Remove the referral coupon from a subscription if it is currently applied.
 * Called when tier drops to NONE so the discount stops on the next cycle.
 */
async function removeReferralDiscount(subscriptionId: string): Promise<void> {
  if (!stripe) return;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    // In the current Stripe SDK, discounts is Array<string | Discount>.
    // Coupon info lives on d.source.coupon (not d.coupon directly).
    const hasReferralDiscount = sub.discounts?.some((d) => {
      if (typeof d === "string") return false; // bare ID — can't inspect coupon
      const src      = d.source;
      const couponId =
        src?.coupon && typeof src.coupon === "object"
          ? (src.coupon as { id: string }).id
          : (src?.coupon as string | null | undefined);
      return couponId === REFERRAL_COUPON_ID;
    }) ?? false;

    if (hasReferralDiscount) {
      // Clear subscription-level discounts (only the referral coupon is applied here).
      await stripe.subscriptions.update(subscriptionId, { discounts: [] });
      console.log(`[referral-billing] removed referral discount from subscription ${subscriptionId}`);
    }
  } catch (err) {
    console.warn(`[referral-billing] removeReferralDiscount failed for ${subscriptionId}:`, err);
  }
}
