/**
 * affiliate-commissions.ts
 *
 * Handles the full lifecycle of affiliate commission tracking:
 *   - activateAffiliateReferral  — called when the referred user subscribes
 *   - processAffiliateCommission — called on every successful invoice payment (monthly)
 *   - deactivateAffiliateReferral — called when the referred user cancels
 *
 * Commission flow per AffiliateReferral:
 *   • monthsRemaining starts at 12 and decrements by 1 per paid invoice.
 *   • When monthsRemaining reaches 0 the record is set inactive — no further commissions.
 *   • commissionRate is a snapshot captured at referral time (rate changes don't affect existing referrals).
 *   • Earned amounts accumulate on Affiliate.pendingPayout until a payout is processed.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------

/**
 * Mark the AffiliateReferral as active when the referred user's subscription begins.
 * Safe to call multiple times — idempotent if already active.
 */
export async function activateAffiliateReferral(referredUserId: string): Promise<void> {
  await db.affiliateReferral.updateMany({
    where: {
      referredUserId,
      isActive: false,
      affiliate: { status: "APPROVED" },
    },
    data: { isActive: true },
  });
}

// ---------------------------------------------------------------------------
// Commission processing — called on every successful invoice.paid
// ---------------------------------------------------------------------------

/**
 * Process one month's commission for the affiliate who referred this user.
 *
 * @param referredUserId  The IndieThis user ID of the subscriber
 * @param amountPaidCents Invoice amount_paid in Stripe cents (e.g. 999 = $9.99)
 */
export async function processAffiliateCommission(
  referredUserId: string,
  amountPaidCents: number
): Promise<void> {
  if (amountPaidCents <= 0) return;

  // Fetch the referral and its affiliate in one query
  const referral = await db.affiliateReferral.findUnique({
    where: { referredUserId },
    select: {
      id:              true,
      affiliateId:     true,
      commissionRate:  true,
      monthsRemaining: true,
      isActive:        true,
      affiliate: {
        select: { status: true },
      },
    },
  });

  // Guards: no referral found, not active, affiliate not approved, or no months left
  if (
    !referral ||
    !referral.isActive ||
    referral.affiliate.status !== "APPROVED" ||
    referral.monthsRemaining <= 0
  ) {
    return;
  }

  // Calculate commission — commissionRate is stored as a decimal (e.g. 0.20 = 20%)
  const amountPaidDollars = amountPaidCents / 100;
  const commission        = parseFloat((amountPaidDollars * referral.commissionRate).toFixed(2));
  const newMonthsRemaining = referral.monthsRemaining - 1;
  const exhausted          = newMonthsRemaining <= 0;

  // Run all updates atomically
  await db.$transaction([
    // Debit the commission month from the referral; deactivate if exhausted
    db.affiliateReferral.update({
      where: { id: referral.id },
      data: {
        monthsRemaining: newMonthsRemaining,
        totalCommissionPaid: { increment: commission },
        isActive: exhausted ? false : true,
      },
    }),
    // Credit the affiliate's payout balance
    db.affiliate.update({
      where: { id: referral.affiliateId },
      data: {
        pendingPayout: { increment: commission },
        totalEarned:   { increment: commission },
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Deactivate
// ---------------------------------------------------------------------------

/**
 * Mark the AffiliateReferral inactive when the referred user cancels their subscription.
 * Commissions stop immediately; remaining months are preserved for potential reactivation.
 */
export async function deactivateAffiliateReferral(referredUserId: string): Promise<void> {
  await db.affiliateReferral.updateMany({
    where: {
      referredUserId,
      isActive: true,
    },
    data: { isActive: false },
  });
}
