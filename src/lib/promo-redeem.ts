/**
 * promo-redeem.ts
 *
 * Shared promo code redemption logic.
 * Called from both /api/promo/redeem (authenticated users) and
 * /api/auth/register (auto-redeem on signup).
 */

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendPromoWelcomeEmail } from "@/lib/brevo/email";
import type { SubscriptionTier } from "@prisma/client";

// AI_BUNDLE metadata keys → Subscription field names
const CREDIT_FIELD_MAP: Record<string, "aiVideoCreditsLimit" | "aiArtCreditsLimit" | "aiMasterCreditsLimit" | "lyricVideoCreditsLimit" | "aarReportCreditsLimit" | "pressKitCreditsLimit"> = {
  video:  "aiVideoCreditsLimit",
  art:    "aiArtCreditsLimit",
  master: "aiMasterCreditsLimit",
  lyric:  "lyricVideoCreditsLimit",
  aar:    "aarReportCreditsLimit",
  press:  "pressKitCreditsLimit",
};

// Default Subscription credit limits per tier
const TIER_DEFAULTS: Record<SubscriptionTier, {
  aiVideoCreditsLimit: number;
  aiArtCreditsLimit: number;
  aiMasterCreditsLimit: number;
  lyricVideoCreditsLimit: number;
  aarReportCreditsLimit: number;
  pressKitCreditsLimit: number;
}> = {
  LAUNCH: { aiVideoCreditsLimit: 0,  aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  PUSH:   { aiVideoCreditsLimit: 2,  aiArtCreditsLimit: 10, aiMasterCreditsLimit: 3,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 0 },
  REIGN:  { aiVideoCreditsLimit: 5,  aiArtCreditsLimit: 15, aiMasterCreditsLimit: 10, lyricVideoCreditsLimit: 3, aarReportCreditsLimit: 5, pressKitCreditsLimit: 0 },
};

export interface RedeemResult {
  success: boolean;
  error?: string;
  redemptionId?: string;
  benefitDescription?: string;
}

/**
 * Validate a promo code (no side effects — read only).
 */
export async function validatePromoCode(code: string, userId?: string): Promise<{
  valid: boolean;
  error?: string;
  promoCode?: {
    id: string;
    code: string;
    type: string;
    tier?: string | null;
    value?: number | null;
    durationDays?: number | null;
    durationMonths?: number | null;
    benefitDescription: string;
  };
}> {
  const promoCode = await db.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } });

  if (!promoCode) return { valid: false, error: "Invalid promo code." };
  if (!promoCode.isActive) return { valid: false, error: "This promo code is no longer active." };
  if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
    return { valid: false, error: "This promo code has expired." };
  }
  if (promoCode.currentRedemptions >= promoCode.maxRedemptions) {
    return { valid: false, error: "This promo code has reached its maximum redemptions." };
  }

  // Check if this user already redeemed
  if (userId) {
    const existing = await db.promoRedemption.findFirst({
      where: { promoCodeId: promoCode.id, userId },
    });
    if (existing) return { valid: false, error: "You have already redeemed this code." };
  }

  return {
    valid: true,
    promoCode: {
      id: promoCode.id,
      code: promoCode.code,
      type: promoCode.type,
      tier: promoCode.tier,
      value: promoCode.value,
      durationDays: promoCode.durationDays,
      durationMonths: promoCode.durationMonths,
      benefitDescription: buildBenefitDescription(promoCode),
    },
  };
}

/**
 * Redeem a promo code for a user. Applies the benefit and creates the redemption record.
 */
export async function redeemPromoCode(userId: string, code: string): Promise<RedeemResult> {
  // Validate first
  const validation = await validatePromoCode(code, userId);
  if (!validation.valid || !validation.promoCode) {
    return { success: false, error: validation.error };
  }

  const pc = validation.promoCode;

  // Fetch user (need stripeCustomerId for Stripe operations)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      subscription: true,
    },
  });
  if (!user) return { success: false, error: "User not found." };

  // Fetch the full promo code record for metadata
  const promoCode = await db.promoCode.findUnique({
    where: { id: pc.id },
    include: { ambassador: { select: { id: true } } },
  });
  if (!promoCode) return { success: false, error: "Promo code not found." };

  try {
    let redemptionExpiresAt: Date | null = null;

    // ── Apply benefit ─────────────────────────────────────────────────────────
    switch (promoCode.type) {
      case "FREE_TRIAL": {
        const tier = promoCode.tier as SubscriptionTier;
        const days = promoCode.durationDays ?? 14;
        redemptionExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        await db.user.update({
          where: { id: userId },
          data: { isComped: true, compExpiresAt: redemptionExpiresAt },
        });

        // Upsert Subscription with trial tier
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            tier,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: redemptionExpiresAt,
            ...TIER_DEFAULTS[tier],
          },
          update: {
            tier,
            status: "ACTIVE",
            currentPeriodEnd: redemptionExpiresAt,
            ...TIER_DEFAULTS[tier],
          },
        });
        break;
      }

      case "COMP": {
        const tier = promoCode.tier as SubscriptionTier;

        await db.user.update({
          where: { id: userId },
          data: { isComped: true, compExpiresAt: null },
        });

        const farFuture = new Date("2099-01-01");
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            tier,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: farFuture,
            ...TIER_DEFAULTS[tier],
          },
          update: {
            tier,
            status: "ACTIVE",
            currentPeriodEnd: farFuture,
            ...TIER_DEFAULTS[tier],
          },
        });
        break;
      }

      case "DISCOUNT": {
        if (stripe && user.stripeCustomerId) {
          const pct = Math.round(promoCode.value ?? 0);
          const couponId = `promo-${promoCode.code.toLowerCase()}-${pct}pct`;
          try {
            await stripe.coupons.create({
              id: couponId,
              percent_off: pct,
              duration: "repeating",
              duration_in_months: promoCode.durationMonths ?? 1,
            });
          } catch {
            // Coupon may already exist — that's fine
          }
          await stripe.customers.update(user.stripeCustomerId, { coupon: couponId });
        }
        break;
      }

      case "CREDIT": {
        if (stripe && user.stripeCustomerId) {
          const cents = Math.round((promoCode.value ?? 0) * 100);
          await stripe.customers.createBalanceTransaction(user.stripeCustomerId, {
            amount: -cents, // negative = credit
            currency: "usd",
            description: `Promo credit: ${promoCode.code}`,
          });
        }
        break;
      }

      case "AI_BUNDLE": {
        const bundleMap = (promoCode.metadata ?? {}) as Record<string, number>;
        const creditUpdates: Record<string, number> = {};

        for (const [key, qty] of Object.entries(bundleMap)) {
          const field = CREDIT_FIELD_MAP[key];
          if (field && typeof qty === "number") {
            creditUpdates[field] = (user.subscription?.[field] ?? 0) + qty;
          }
        }

        if (Object.keys(creditUpdates).length > 0) {
          if (user.subscription) {
            await db.subscription.update({
              where: { userId },
              data: creditUpdates,
            });
          } else {
            // Create a minimal subscription to hold the credits
            await db.subscription.create({
              data: {
                userId,
                tier: "LAUNCH",
                status: "ACTIVE",
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                ...TIER_DEFAULTS["LAUNCH"],
                ...creditUpdates,
              },
            });
          }
        }
        break;
      }
    }

    // ── Create redemption record ──────────────────────────────────────────────
    const redemption = await db.promoRedemption.create({
      data: {
        promoCodeId: promoCode.id,
        userId,
        expiresAt: redemptionExpiresAt,
        status: "ACTIVE",
      },
    });

    // ── Increment redemption counter ──────────────────────────────────────────
    await db.promoCode.update({
      where: { id: promoCode.id },
      data: { currentRedemptions: { increment: 1 } },
    });

    // ── Ambassador reward stub (Phase 6) ──────────────────────────────────────
    if (promoCode.ambassadorId) {
      // Phase 6: process ambassador reward based on rewardType
      // For now, log the association for future processing
      console.log(`[Ambassador] Code ${promoCode.code} redeemed by user ${userId}. Ambassador: ${promoCode.ambassadorId}`);
    }

    // ── Send welcome email ────────────────────────────────────────────────────
    try {
      await sendPromoWelcomeEmail({
        email: user.email,
        name: user.name,
        benefitDescription: buildBenefitDescription(promoCode),
        code: promoCode.code,
      });
    } catch {
      // Non-fatal — redemption already succeeded
    }

    return {
      success: true,
      redemptionId: redemption.id,
      benefitDescription: buildBenefitDescription(promoCode),
    };
  } catch (err) {
    console.error("[redeemPromoCode] error:", err);
    return { success: false, error: "Failed to apply promo code. Please try again." };
  }
}

// ── Benefit description builder ───────────────────────────────────────────────

export function buildBenefitDescription(promoCode: {
  type: string;
  tier?: SubscriptionTier | null;
  value?: number | null;
  durationDays?: number | null;
  durationMonths?: number | null;
  metadata?: unknown;
}): string {
  const tierLabel = promoCode.tier
    ? promoCode.tier.charAt(0) + promoCode.tier.slice(1).toLowerCase()
    : "";

  switch (promoCode.type) {
    case "FREE_TRIAL":
      return `${promoCode.durationDays ?? 14} days free on the ${tierLabel} plan — no credit card required`;
    case "DISCOUNT":
      return `${Math.round(promoCode.value ?? 0)}% off for ${promoCode.durationMonths ?? 1} month${(promoCode.durationMonths ?? 1) > 1 ? "s" : ""}`;
    case "COMP":
      return `Complimentary ${tierLabel} plan access`;
    case "CREDIT":
      return `$${(promoCode.value ?? 0).toFixed(2)} credit applied to your account`;
    case "AI_BUNDLE": {
      const bundle = (promoCode.metadata ?? {}) as Record<string, number>;
      const parts = Object.entries(bundle)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      return `AI credits bundle: ${parts}`;
    }
    default:
      return "Special access unlocked";
  }
}
