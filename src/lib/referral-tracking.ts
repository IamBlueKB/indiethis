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
import { sendEmail } from "@/lib/brevo/email";
import { revertLifetimeBilling } from "@/lib/referral-billing";
import type { ReferralRewardTier } from "@prisma/client";

// ─── Tier thresholds (highest first so the first match wins) ──────────────────

const TIER_THRESHOLDS: Array<{ min: number; tier: ReferralRewardTier }> = [
  { min: 25, tier: "LIFETIME_REIGN" },
  { min: 10, tier: "LIFETIME_PUSH"  },
  { min: 5,  tier: "DISCOUNT_20"    },
  { min: 3,  tier: "FREE_MONTH"     },
  { min: 1,  tier: "CREDIT_1"       },
];

// Tier rank map — higher number = higher tier. Used to detect downgrades.
const TIER_RANK: Record<ReferralRewardTier, number> = {
  NONE:          0,
  CREDIT_1:      1,
  FREE_MONTH:    2,
  DISCOUNT_20:   3,
  LIFETIME_PUSH: 4,
  LIFETIME_REIGN: 5,
};

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
 * reward tier, and write it back to the User row. If the new tier is
 * lower than the old tier (a downgrade), fire in-app + email notifications
 * and, if they were on a LIFETIME tier, revert their Stripe subscription
 * to the standard paid price.
 */
async function updateReferrerTier(referredUserId: string): Promise<void> {
  const referral = await db.referral.findUnique({
    where:  { referredUserId },
    select: { referrerUserId: true },
  });

  if (!referral) return; // user was not referred — nothing to update

  // Fetch email and current tier BEFORE the update so we can compare.
  const referrer = await db.user.findUnique({
    where:  { id: referral.referrerUserId },
    select: {
      id:                 true,
      email:              true,
      name:               true,
      referralRewardTier: true,
      subscription: {
        select: { stripeSubscriptionId: true },
      },
    },
  });

  if (!referrer) return;

  const oldTier = referrer.referralRewardTier;
  const newTier = await calculateReferralReward(referral.referrerUserId);

  await db.user.update({
    where: { id: referral.referrerUserId },
    data:  { referralRewardTier: newTier },
  });

  console.log(
    `[referral] referrer ${referral.referrerUserId} tier updated → ${newTier}`,
  );

  // ── Tier downgrade handling ────────────────────────────────────────────────
  if (TIER_RANK[newTier] < TIER_RANK[oldTier]) {
    // Count active referrals for use in notifications.
    const activeCount = await db.referral.count({
      where: { referrerUserId: referral.referrerUserId, isActive: true },
    });

    const wasLifetime =
      oldTier === "LIFETIME_PUSH" || oldTier === "LIFETIME_REIGN";

    const subId = referrer.subscription?.stripeSubscriptionId ?? null;

    // Revert Stripe subscription if dropping off a lifetime tier.
    if (wasLifetime && subId) {
      await revertLifetimeBilling(referral.referrerUserId, subId);
    }

    // In-app notification.
    db.notification.create({
      data: {
        userId:  referral.referrerUserId,
        type:    "REFERRAL_TIER_DROP",
        title:   "Referral reward updated",
        message: `One of your referrals cancelled. Your reward has been updated to ${newTier}.`,
      },
    }).catch((err: unknown) =>
      console.warn("[referral] failed to create tier-drop notification:", err),
    );

    // Email notification (fire-and-forget).
    sendTierDropEmail({
      email:        referrer.email,
      name:         referrer.name ?? undefined,
      oldTier,
      newTier,
      activeCount,
      wasLifetime,
    }).catch((err: unknown) =>
      console.warn("[referral] failed to send tier-drop email:", err),
    );
  }
}

// ─── Email helper ─────────────────────────────────────────────────────────────

interface TierDropEmailParams {
  email:       string;
  name?:       string;
  oldTier:     ReferralRewardTier;
  newTier:     ReferralRewardTier;
  activeCount: number;
  wasLifetime: boolean;
}

const TIER_LABEL: Record<ReferralRewardTier, string> = {
  NONE:           "No reward",
  CREDIT_1:       "1 free press kit credit/month",
  FREE_MONTH:     "1 free month every billing cycle",
  DISCOUNT_20:    "20% off permanently",
  LIFETIME_PUSH:  "Lifetime free Push plan",
  LIFETIME_REIGN: "Lifetime free Reign plan",
};

async function sendTierDropEmail(params: TierDropEmailParams): Promise<void> {
  const { email, name, oldTier, newTier, activeCount, wasLifetime } = params;

  const greeting   = name ? `Hi ${name},` : "Hi there,";
  const oldLabel   = TIER_LABEL[oldTier];
  const newLabel   = TIER_LABEL[newTier];
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  const lifetimeWarning = wasLifetime
    ? `<p style="color:#b91c1c;font-weight:600;">Because you have dropped below the threshold for a lifetime free plan, your subscription will return to the standard paid rate at your next billing cycle.</p>`
    : "";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px;">
  <p style="font-size:18px;font-weight:700;margin-bottom:4px;">IndieThis</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;" />

  <p>${greeting}</p>

  <p>One of your referred users has cancelled their IndieThis subscription. As a result, your referral reward tier has been updated.</p>

  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb;">Previous reward</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;">${oldLabel}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb;">New reward</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;">${newLabel}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb;">Active referrals</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;">${activeCount}</td>
    </tr>
  </table>

  ${lifetimeWarning}

  <p>Keep sharing your referral link to grow your active count and unlock higher rewards again.</p>

  <p>
    <a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 20px;background:#D4A843;color:#0A0A0A;border-radius:6px;text-decoration:none;font-weight:600;">
      View your referrals
    </a>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:32px;" />
  <p style="font-size:12px;color:#6b7280;">You are receiving this email because you have an active IndieThis referral account.</p>
</body>
</html>
  `.trim();

  const textContent = [
    greeting,
    "",
    "One of your referred users has cancelled their IndieThis subscription. Your referral reward tier has been updated.",
    "",
    `Previous reward: ${oldLabel}`,
    `New reward: ${newLabel}`,
    `Active referrals: ${activeCount}`,
    "",
    wasLifetime
      ? "IMPORTANT: Because you have dropped below the threshold for a lifetime free plan, your subscription will return to the standard paid rate at your next billing cycle."
      : "",
    "",
    "Keep sharing your referral link to grow your active count and unlock higher rewards again.",
    "",
    `View your referrals: ${appUrl}/dashboard`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  await sendEmail({
    to:          { email, name },
    subject:     "Your IndieThis referral reward has changed",
    htmlContent,
    textContent,
    tags:        ["referral", "tier-drop"],
  });
}
