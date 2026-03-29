/**
 * ai-jobs.ts — Unified AI job queue service
 *
 * createAIJob():
 *   1. Checks if the triggering user has subscription credits for the tool.
 *   2. If yes  → deducts 1 credit, creates AIJob (priceCharged: 0).
 *   3. If no   → attempts a direct Stripe charge via their saved payment method.
 *              → If no saved method, returns { success: false, requiresPayment: true }
 *                so the caller can redirect to the PPU Stripe Checkout flow.
 *   4. Returns { success: true, jobId } or { success: false, error, requiresPayment?, amount? }
 *
 * No provider integrations live here — only queue entry + billing.
 */

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { AIJobType, AIJobTrigger, AIJobStatus } from "@prisma/client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Pay-per-use prices (cents) — sourced from DB via src/lib/pricing.ts ──────
// These are static fallbacks used at job-creation time.
// Actual checkout amounts always re-fetch from getPricing() in route handlers.

export const PPU_PRICES: Partial<Record<AIJobType, number>> = {
  VIDEO:       Math.round(PRICING_DEFAULTS.AI_VIDEO_SHORT.value  * 100), // $19 (30s default)
  COVER_ART:   Math.round(PRICING_DEFAULTS.AI_COVER_ART.value    * 100), // $4.99
  MASTERING:   Math.round(PRICING_DEFAULTS.AI_MASTERING.value    * 100), // $7.99
  LYRIC_VIDEO: Math.round(PRICING_DEFAULTS.AI_LYRIC_VIDEO.value  * 100), // $14.99
  AR_REPORT:   Math.round(PRICING_DEFAULTS.AI_AAR_REPORT.value   * 100), // $14.99
  PRESS_KIT:   Math.round(PRICING_DEFAULTS.AI_PRESS_KIT.value    * 100), // $9.99
  BIO_GENERATOR:   0,   // free
  CONTRACT_SCANNER: Math.round(PRICING_DEFAULTS.AI_CONTRACT_SCANNER.value * 100), // $4.99
};

export const PPU_LABELS: Partial<Record<AIJobType, string>> = {
  VIDEO:            "AI Music Video – IndieThis",
  COVER_ART:        "AI Cover Art – IndieThis",
  MASTERING:        "AI Mastering – IndieThis",
  LYRIC_VIDEO:      "Lyric Video – IndieThis",
  AR_REPORT:        "A&R Report – IndieThis",
  PRESS_KIT:        "Press Kit – IndieThis",
  BIO_GENERATOR:    "Bio Generator – IndieThis",
  CONTRACT_SCANNER: "Contract Scanner – IndieThis",
};

// ─── Provider names (informational — caller sets the actual provider string) ──

export const DEFAULT_PROVIDERS: Partial<Record<AIJobType, string>> = {
  VIDEO:            "kling",      // Kling 1.6 Pro via fal.ai (Runway fallback)
  COVER_ART:        "replicate",
  MASTERING:        "dolby",
  LYRIC_VIDEO:      "remotion",
  AR_REPORT:        "claude",
  PRESS_KIT:        "claude",
  BIO_GENERATOR:    "claude",
  CONTRACT_SCANNER: "claude",
};

// ─── Credit field mapping ──────────────────────────────────────────────────────

type CreditFields = {
  used: "aiVideoCreditsUsed" | "aiArtCreditsUsed" | "aiMasterCreditsUsed" |
        "lyricVideoCreditsUsed" | "aarReportCreditsUsed" | "pressKitCreditsUsed";
  limit: "aiVideoCreditsLimit" | "aiArtCreditsLimit" | "aiMasterCreditsLimit" |
         "lyricVideoCreditsLimit" | "aarReportCreditsLimit" | "pressKitCreditsLimit";
};

const CREDIT_MAP: Partial<Record<AIJobType, CreditFields>> = {
  VIDEO:       { used: "aiVideoCreditsUsed",    limit: "aiVideoCreditsLimit" },
  COVER_ART:   { used: "aiArtCreditsUsed",      limit: "aiArtCreditsLimit" },
  MASTERING:   { used: "aiMasterCreditsUsed",   limit: "aiMasterCreditsLimit" },
  LYRIC_VIDEO: { used: "lyricVideoCreditsUsed", limit: "lyricVideoCreditsLimit" },
  AR_REPORT:   { used: "aarReportCreditsUsed",  limit: "aarReportCreditsLimit" },
  PRESS_KIT:   { used: "pressKitCreditsUsed",   limit: "pressKitCreditsLimit" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateAIJobParams = {
  type: AIJobType;
  triggeredBy: AIJobTrigger;
  triggeredById: string;    // user ID of whoever clicked "Generate"
  artistId?: string;        // artist this job is for (null = quick/studio mode)
  studioId?: string;        // studio context if triggered by studio
  inputData: Record<string, unknown>;
  provider?: string;        // override default provider for this type
  /** Pass true if payment was already collected via Stripe Checkout redirect */
  priceAlreadyCharged?: boolean;
  /** Amount already charged (cents) — required if priceAlreadyCharged is true */
  chargedAmount?: number;
  /** Stripe payment ID from a completed checkout — stored on the job */
  stripePaymentId?: string;
};

export type CreateAIJobResult =
  | { success: true;  jobId: string }
  | { success: false; error: string; requiresPayment?: true; amount?: number };

// ─── Main function ────────────────────────────────────────────────────────────

export async function createAIJob(params: CreateAIJobParams): Promise<CreateAIJobResult> {
  const {
    type,
    triggeredBy,
    triggeredById,
    artistId,
    studioId,
    inputData,
    provider = DEFAULT_PROVIDERS[type] ?? "unknown",
    priceAlreadyCharged = false,
    chargedAmount,
    stripePaymentId,
  } = params;

  // ── 1. Load user + subscription ──────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { id: triggeredById },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      subscription: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found." };
  }

  // ── 2. Determine billing ──────────────────────────────────────────────────
  let priceCharged = 0;
  let resolvedStripePaymentId = stripePaymentId ?? null;
  const creditFields = CREDIT_MAP[type];

  const sub = user.subscription;
  const hasCredits =
    creditFields != null &&
    sub &&
    sub.status === "ACTIVE" &&
    sub[creditFields.used] < sub[creditFields.limit];

  if (hasCredits && creditFields) {
    // ── 2a. Use subscription credit ─────────────────────────────────────────
    await db.subscription.update({
      where: { userId: triggeredById },
      data: { [creditFields.used]: { increment: 1 } },
    });
    priceCharged = 0;

  } else if (priceAlreadyCharged) {
    // ── 2b. Payment already collected externally (PPU Stripe Checkout redirect)
    priceCharged = chargedAmount ?? PPU_PRICES[type] ?? 0;

  } else {
    // ── 2c. No credits — attempt direct Stripe charge via saved payment method
    const ppuAmount = PPU_PRICES[type] ?? 0;

    if (!stripe) {
      return {
        success: false,
        requiresPayment: true,
        amount: ppuAmount,
        error: "STRIPE_SECRET_KEY is not configured. Add it to .env.local.",
      };
    }

    // Get customer's default payment method
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // No Stripe customer yet — can't charge directly; caller must redirect
      return {
        success: false,
        requiresPayment: true,
        amount: ppuAmount,
        error: "No payment method on file. Redirect to pay-per-use checkout.",
      };
    }

    // Retrieve the customer to check for a default payment method
    const customer = await stripe.customers.retrieve(customerId) as import("stripe").Stripe.Customer;
    const defaultPaymentMethod =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : (customer.invoice_settings?.default_payment_method as import("stripe").Stripe.PaymentMethod | null)?.id ?? null;

    if (!defaultPaymentMethod) {
      // No saved card — return info for caller to redirect to Checkout
      return {
        success: false,
        requiresPayment: true,
        amount: ppuAmount,
        error: "No saved payment method. Redirect to pay-per-use checkout.",
      };
    }

    // Attempt the charge
    try {
      const intent = await stripe.paymentIntents.create({
        amount: ppuAmount,
        currency: "usd",
        customer: customerId,
        payment_method: defaultPaymentMethod,
        confirm: true,
        off_session: true,
        description: PPU_LABELS[type],
        metadata: { userId: triggeredById, tool: type },
      });

      if (intent.status !== "succeeded") {
        return {
          success: false,
          requiresPayment: true,
          amount: ppuAmount,
          error: `Payment ${intent.status}. Redirect to pay-per-use checkout.`,
        };
      }

      priceCharged = ppuAmount;
      resolvedStripePaymentId = intent.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed.";
      return {
        success: false,
        requiresPayment: true,
        amount: ppuAmount,
        error: `Stripe charge failed: ${message}`,
      };
    }
  }

  // ── 3. Create the AIJob record ────────────────────────────────────────────
  const job = await db.aIJob.create({
    data: {
      type,
      status: AIJobStatus.QUEUED,
      triggeredBy,
      triggeredById,
      artistId:     artistId ?? null,
      studioId:     studioId ?? null,
      inputData: inputData as import("@prisma/client").Prisma.InputJsonValue,
      provider,
      priceCharged: priceCharged / 100, // store as dollars
      costToUs:     null,               // filled in by worker after provider responds
      errorMessage: null,
      // Store stripe payment ID in outputData for traceability if needed
      outputData: resolvedStripePaymentId
        ? ({ stripePaymentId: resolvedStripePaymentId } as import("@prisma/client").Prisma.InputJsonValue)
        : undefined,
    },
  });

  return { success: true, jobId: job.id };
}

// ─── Helper: check credits without creating a job ─────────────────────────────

export async function getCreditsRemaining(
  userId: string,
  type: AIJobType,
): Promise<{ hasCredits: boolean; used: number; limit: number }> {
  const fields = CREDIT_MAP[type];
  if (!fields) return { hasCredits: false, used: 0, limit: 0 };

  const sub = await db.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      [fields.used]: true,
      [fields.limit]: true,
    } as Record<string, boolean>,
  });

  if (!sub || sub.status !== "ACTIVE") {
    return { hasCredits: false, used: 0, limit: 0 };
  }

  const used  = (sub as Record<string, number>)[fields.used]  ?? 0;
  const limit = (sub as Record<string, number>)[fields.limit] ?? 0;

  return { hasCredits: used < limit, used, limit };
}
