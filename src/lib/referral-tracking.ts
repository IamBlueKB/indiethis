/**
 * referral-tracking.ts — Referral lifecycle + reward tier calculation.
 *
 * Called from:
 *   - api/stripe/webhook  → activateReferral on subscription checkout complete
 *   - api/stripe/webhook  → deactivateReferral on subscription.deleted
 *
 * Reward tier thresholds (drops back down if referrals cancel):
 *   1  active → CREDIT_1
 *   3  active → FREE_MONTH
 *   5  active → DISCOUNT_20
 *   10 active → LIFETIME_PUSH
 *   25 active → LIFETIME_REIGN
 */

import { db } from "@/lib/db";
import type { ReferralRewardTier } from "@prisma/client";

// ─── Tier thresholds (highest first so the first match wins) ──────────────────

const TIER_THRESHOLDS: Array<{ min: number; tier: ReferralRewardTier }> = [
  { min: 25, tier: "LIFETIME_REIGN" },
  { min: 10, tier: "LIFETIME_PUSH"  },
  { min: 5,  tier: "DISCOUNT_20"    },
  { min: 3,  tier: "FREE_MONTH"     },
  { min: 1,  tier: "CREDIT_1"       },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Count the referrer's currently active referrals and return the
 * corresponding ReferralRewardTier. Tier drops automatically when
 * referred users cancel (count decreases).
 */
export async function calculateReferralReward(
  referrerUserId: string,
): Promise<ReferralRewardTier> {
  const activeCount = await db.referral.count({
    where: { referrerUserId, isActive: true },
  });

  for (const { min, tier } of TIER_THRESHOLDS) {
    if (activeCount >= min) return tier;
  }
  return "NONE";
}

/**
 * Activate the Referral record when a referred user starts a paid
 * subscription. Sets isActive = true, records activatedAt, then
 * recalculates and persists the referrer's reward tier.
 * No-op if no referral exists or it is already active.
 */
export async function activateReferral(referredUserId: string): Promise<void> {
  try {
    await db.referral.updateMany({
      where: { referredUserId, isActive: false },
      data:  { isActive: true, activatedAt: new Date() },
    });

    await updateReferrerTier(referredUserId);
  } catch (err) {
    console.warn(`[referral] activateReferral failed for user ${referredUserId}:`, err);
  }
}

/**
 * Deactivate the Referral record when a referred user cancels their
 * subscription. Sets isActive = false, records deactivatedAt, then
 * recalculates and persists the referrer's reward tier (may drop).
 * No-op if no referral exists or it is already inactive.
 */
export async function deactivateReferral(referredUserId: string): Promise<void> {
  try {
    await db.referral.updateMany({
      where: { referredUserId, isActive: true },
      data:  { isActive: false, deactivatedAt: new Date() },
    });

    await updateReferrerTier(referredUserId);
  } catch (err) {
    console.warn(`[referral] deactivateReferral failed for user ${referredUserId}:`, err);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Look up the referrer for a given referred user, recalculate their
 * reward tier, and write it back to the User row.
 */
async function updateReferrerTier(referredUserId: string): Promise<void> {
  const referral = await db.referral.findUnique({
    where:  { referredUserId },
    select: { referrerUserId: true },
  });

  if (!referral) return; // user was not referred — nothing to update

  const tier = await calculateReferralReward(referral.referrerUserId);

  await db.user.update({
    where: { id: referral.referrerUserId },
    data:  { referralRewardTier: tier },
  });

  console.log(
    `[referral] referrer ${referral.referrerUserId} tier updated → ${tier}`,
  );
}
