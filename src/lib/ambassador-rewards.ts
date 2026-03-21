/**
 * ambassador-rewards.ts
 *
 * Processes ambassador reward events and handles auto-payout when balance >= $25.
 * Called from promo-redeem.ts (SIGNUP) and the Stripe webhook (CONVERSION/UPGRADE).
 */

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendAmbassadorRewardEmail, sendAmbassadorPayoutEmail } from "@/lib/brevo/email";

export type RewardEvent = "SIGNUP" | "CONVERSION" | "UPGRADE";

export interface RewardContext {
  subscriptionAmount?: number; // For PERCENTAGE_FIRST / PERCENTAGE_RECURRING
  tier?: string;               // For UPGRADE_BONUS
}

const AUTO_PAYOUT_THRESHOLD = 25; // USD

/**
 * Calculate and credit a reward to an ambassador based on an event.
 * Triggers auto-payout if balance hits the threshold and Stripe Connect is set up.
 */
export async function processAmbassadorReward(
  ambassadorId: string,
  event: RewardEvent,
  context: RewardContext = {}
): Promise<void> {
  const ambassador = await db.ambassador.findUnique({ where: { id: ambassadorId } });
  if (!ambassador || !ambassador.isActive) return;

  const { rewardType, rewardValue } = ambassador;
  let rewardAmount = 0;

  // ── Calculate reward amount ────────────────────────────────────────────────
  if (event === "SIGNUP" && rewardType === "FLAT_PER_SIGNUP") {
    rewardAmount = rewardValue;
  } else if (event === "CONVERSION") {
    if (rewardType === "FLAT_PER_CONVERSION") {
      rewardAmount = rewardValue;
    } else if (rewardType === "PERCENTAGE_FIRST" && context.subscriptionAmount) {
      rewardAmount = parseFloat(
        ((context.subscriptionAmount * rewardValue) / 100).toFixed(2)
      );
    } else if (rewardType === "PERCENTAGE_RECURRING" && context.subscriptionAmount) {
      rewardAmount = parseFloat(
        ((context.subscriptionAmount * rewardValue) / 100).toFixed(2)
      );
    }
  } else if (event === "UPGRADE" && rewardType === "UPGRADE_BONUS") {
    rewardAmount = rewardValue;
  }

  if (rewardAmount <= 0) return;

  // ── Credit the reward ──────────────────────────────────────────────────────
  const updated = await db.ambassador.update({
    where: { id: ambassadorId },
    data: {
      creditBalance: { increment: rewardAmount },
      totalEarned: { increment: rewardAmount },
    },
  });

  // ── Fire-and-forget reward notification ───────────────────────────────────
  sendAmbassadorRewardEmail(
    { name: ambassador.name, email: ambassador.email },
    rewardAmount,
    event
  ).catch(console.error);

  // ── Auto-payout if threshold reached ──────────────────────────────────────
  if (updated.creditBalance >= AUTO_PAYOUT_THRESHOLD && updated.stripeConnectId && stripe) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(updated.creditBalance * 100),
        currency: "usd",
        destination: updated.stripeConnectId,
        description: `Auto-payout for ambassador: ${ambassador.name}`,
      });

      await Promise.all([
        db.ambassadorPayout.create({
          data: {
            ambassadorId,
            amount: updated.creditBalance,
            method: "STRIPE_CONNECT",
            stripePayoutId: transfer.id,
          },
        }),
        db.ambassador.update({
          where: { id: ambassadorId },
          data: {
            totalPaidOut: { increment: updated.creditBalance },
            creditBalance: 0,
          },
        }),
      ]);

      sendAmbassadorPayoutEmail(
        { name: ambassador.name, email: ambassador.email },
        updated.creditBalance,
        "STRIPE_CONNECT"
      ).catch(console.error);
    } catch (err) {
      console.error("[ambassador-rewards] auto-payout failed:", err);
    }
  }
}
