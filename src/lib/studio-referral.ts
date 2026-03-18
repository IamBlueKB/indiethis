/**
 * studio-referral.ts
 *
 * Shared helpers for the studio referral credit system.
 *
 * Flow:
 *  1. Artist registers → markContactsAsReferred(email, userId)
 *     Finds all studio CRM contacts whose email matches, with source BOOKING or
 *     MANUAL (indicating the studio brought them in), and marks them
 *     referredToIndieThis = true.
 *
 *  2. Artist makes a purchase (subscription or pay-per-use) →
 *     creditStudioForArtistPurchase(userId, purchaseType)
 *     Awards $5 to every studio that has a marked contact for this artist,
 *     skipping any studio already credited for that artist (dedup via history).
 *
 *  3. Studio's Stripe subscription invoice is upcoming →
 *     applyStudioCreditsToStripeInvoice(stripeCustomerId)
 *     Calls Stripe to create a negative balance transaction so the credit is
 *     automatically applied when the invoice is finalised.
 */

import { db }         from "@/lib/db";
import { Prisma }     from "@prisma/client";
import { randomBytes } from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CreditEventType = "EARNED" | "APPLIED";

export interface CreditEvent {
  id:           string;          // random hex ID for the event
  type:         CreditEventType;
  artistId?:    string;          // for EARNED: the artist's userId
  artistEmail?: string;          // for EARNED: the artist's email
  amount:       number;          // positive = earned, negative = applied (dollars)
  reason:       string;
  purchaseType?: "SUBSCRIPTION" | "PAY_PER_USE";
  invoiceId?:   string;          // for APPLIED events
  date:         string;          // ISO timestamp
}

const REFERRAL_CREDIT_AMOUNT = 5; // dollars per qualified referral purchase

// ─── Step 1: mark contacts as referred ────────────────────────────────────────

/**
 * Called after a new ARTIST signs up.
 * Finds all studio contacts whose email matches and whose source is BOOKING or
 * MANUAL, then sets referredToIndieThis = true (idempotent).
 */
export async function markContactsAsReferred(
  email:  string,
  userId: string,
): Promise<void> {
  void userId; // retained for future per-studio dedup or logging
  try {
    await db.contact.updateMany({
      where: {
        email:              email.toLowerCase().trim(),
        source:             { in: ["BOOKING", "MANUAL"] },
        referredToIndieThis: false,
      },
      data: { referredToIndieThis: true },
    });
  } catch (err) {
    console.error("[studio-referral] markContactsAsReferred failed:", err);
  }
}

// ─── Step 2: credit studios on artist purchase ────────────────────────────────

/**
 * Called from the Stripe webhook after a successful artist subscription or
 * pay-per-use checkout.  Credits $5 to every studio that:
 *  - has a CRM contact matching the artist's email
 *  - with source BOOKING or MANUAL
 *  - and referredToIndieThis = true
 *  - has NOT already been credited for this specific artist (deduplicated via
 *    referralCreditHistory)
 */
export async function creditStudioForArtistPurchase(
  userId:       string,
  purchaseType: "SUBSCRIPTION" | "PAY_PER_USE",
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user?.email) return;

    // All studio contacts matching this artist
    const contacts = await db.contact.findMany({
      where: {
        email:              user.email.toLowerCase().trim(),
        referredToIndieThis: true,
        source:             { in: ["BOOKING", "MANUAL"] },
      },
      select: { studioId: true },
    });
    if (contacts.length === 0) return;

    const studioIds = [...new Set(contacts.map(c => c.studioId))];

    for (const studioId of studioIds) {
      const studio = await db.studio.findUnique({
        where:  { id: studioId },
        select: { id: true, referralCredits: true, referralCreditHistory: true },
      });
      if (!studio) continue;

      const history = parseHistory(studio.referralCreditHistory);

      // Skip if this studio was already credited for this artist
      const alreadyCredited = history.some(
        e => e.type === "EARNED" && e.artistId === userId,
      );
      if (alreadyCredited) continue;

      const event: CreditEvent = {
        id:           randomBytes(6).toString("hex"),
        type:         "EARNED",
        artistId:     userId,
        artistEmail:  user.email,
        amount:       REFERRAL_CREDIT_AMOUNT,
        reason:
          `${user.name ?? user.email} ${
            purchaseType === "SUBSCRIPTION"
              ? "subscribed to IndieThis"
              : "made a pay-per-use purchase"
          }`,
        purchaseType,
        date:         new Date().toISOString(),
      };

      await db.studio.update({
        where: { id: studioId },
        data: {
          referralCredits:      { increment: REFERRAL_CREDIT_AMOUNT },
          referralCreditHistory: [...history, event] as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } catch (err) {
    console.error("[studio-referral] creditStudioForArtistPurchase failed:", err);
  }
}

// ─── Step 3: apply credits to Stripe invoice ──────────────────────────────────

/**
 * Called from the Stripe webhook on invoice.upcoming.
 *
 * Applies referral credits to the upcoming invoice, capped at the invoice
 * amount so the studio never receives cash — only subscription credits.
 * Any excess remains in referralCredits and rolls over to the next month.
 *
 * Example: $15 credits, $10 invoice → $10 applied, $5 carried forward.
 */
export async function applyStudioCreditsToStripeInvoice(
  stripeCustomerId: string,
): Promise<void> {
  try {
    const { stripe } = await import("@/lib/stripe");
    if (!stripe) return;

    // Resolve the studio owner by Stripe customer ID
    const owner = await db.user.findFirst({
      where:  { stripeCustomerId },
      select: {
        id:           true,
        ownedStudios: {
          select: { id: true, referralCredits: true, referralCreditHistory: true },
          take:   1,
        },
      },
    });
    if (!owner) return;

    const studio = owner.ownedStudios[0];
    if (!studio || studio.referralCredits <= 0) return;

    // ── Fetch the upcoming invoice to know the exact amount due ─────────────
    let invoiceAmountDueCents: number;
    try {
      const upcoming = await stripe.invoices.createPreview({
        customer: stripeCustomerId,
      });
      invoiceAmountDueCents = upcoming.amount_due; // already in cents
    } catch {
      // No upcoming invoice exists for this customer — nothing to apply.
      return;
    }

    if (invoiceAmountDueCents <= 0) return;

    // ── Cap applied amount at the invoice total ──────────────────────────────
    const availableCents  = Math.round(studio.referralCredits * 100);
    const applyCents      = Math.min(availableCents, invoiceAmountDueCents);
    const applyDollars    = applyCents / 100;
    const remainingCents  = availableCents - applyCents;
    const remainingDollars = remainingCents / 100;

    // ── Create Stripe negative balance transaction ───────────────────────────
    // Stripe auto-applies this to the next finalised invoice up to amount_due.
    const txn = await stripe.customers.createBalanceTransaction(
      stripeCustomerId,
      {
        amount:      -applyCents,
        currency:    "usd",
        description: `IndieThis referral credit — $${applyDollars.toFixed(2)}`,
      },
    );

    // ── Build log entry ──────────────────────────────────────────────────────
    const carryNote  = remainingDollars > 0
      ? ` — $${remainingDollars.toFixed(2)} carried forward`
      : "";

    const history = parseHistory(studio.referralCreditHistory);
    const event: CreditEvent = {
      id:        randomBytes(6).toString("hex"),
      type:      "APPLIED",
      amount:    -applyDollars,
      reason:    `Applied $${applyDollars.toFixed(2)} as Stripe invoice credit${carryNote}`,
      invoiceId: txn.id,
      date:      new Date().toISOString(),
    };

    // ── Persist: deduct only the applied amount, keep excess for next month ──
    await db.studio.update({
      where: { id: studio.id },
      data: {
        referralCredits:       remainingDollars,
        referralCreditHistory: [...history, event] as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[studio-referral] applied $${applyDollars.toFixed(2)} to invoice for ` +
      `customer ${stripeCustomerId}` +
      (remainingDollars > 0
        ? ` — $${remainingDollars.toFixed(2)} carried forward to next month`
        : ""),
    );
  } catch (err) {
    console.error("[studio-referral] applyStudioCreditsToStripeInvoice failed:", err);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Safely parse the referralCreditHistory JSON field into a typed array. */
export function parseHistory(raw: unknown): CreditEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw as CreditEvent[];
}
