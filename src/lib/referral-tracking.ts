/**
 * referral-tracking.ts — helpers for activating/deactivating Referral records.
 *
 * Called from:
 *   - api/stripe/webhook  → activateReferral on subscription checkout complete
 *   - api/stripe/webhook  → deactivateReferral on subscription.deleted
 */

import { db } from "@/lib/db";

/**
 * Activate the Referral record when a referred user starts a paid subscription.
 * Sets isActive = true and records activatedAt.
 * No-op if no referral exists or it is already active.
 */
export async function activateReferral(referredUserId: string): Promise<void> {
  try {
    await db.referral.updateMany({
      where: { referredUserId, isActive: false },
      data:  { isActive: true, activatedAt: new Date() },
    });
  } catch (err) {
    console.warn(`[referral] activateReferral failed for user ${referredUserId}:`, err);
  }
}

/**
 * Deactivate the Referral record when a referred user cancels their subscription.
 * Sets isActive = false and records deactivatedAt.
 * No-op if no referral exists or it is already inactive.
 */
export async function deactivateReferral(referredUserId: string): Promise<void> {
  try {
    await db.referral.updateMany({
      where: { referredUserId, isActive: true },
      data:  { isActive: false, deactivatedAt: new Date() },
    });
  } catch (err) {
    console.warn(`[referral] deactivateReferral failed for user ${referredUserId}:`, err);
  }
}
