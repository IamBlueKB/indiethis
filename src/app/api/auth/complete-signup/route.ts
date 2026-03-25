/**
 * GET /api/auth/complete-signup?session_id={STRIPE_CHECKOUT_SESSION_ID}
 *
 * Called by /signup/complete after Stripe redirects the user back.
 * Verifies the Stripe payment, creates the User account from PendingSignup,
 * and returns an autoSigninToken the client uses to sign in without a password.
 *
 * Idempotent: if the user was already created (by the webhook firing first),
 * it generates a fresh autoSigninToken and returns that.
 *
 * Returns:
 *   { status: "ready",   token: string, email: string }  — account ready, sign in
 *   { status: "pending" }                                 — webhook hasn't fired yet, retry
 *   { status: "error",   error: string }                  — unrecoverable
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addMinutes } from "date-fns";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { createUserFromPending } from "@/lib/create-user-from-pending";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ status: "error", error: "Missing session_id." }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ status: "error", error: "Stripe not configured." }, { status: 503 });
  }

  try {
    // ── 1. Verify payment with Stripe ──────────────────────────────────────
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { status: "error", error: "Payment not completed." },
        { status: 402 }
      );
    }

    const stripeSubscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);

    const tier = session.metadata?.tier ?? "LAUNCH";

    // ── 2. Check if user already created (webhook may have fired first) ────
    const customerEmail = session.customer_details?.email ?? session.customer_email;
    if (customerEmail) {
      const existing = await db.user.findUnique({
        where:  { email: customerEmail.toLowerCase().trim() },
        select: { id: true, email: true, name: true, autoSigninToken: true, autoSigninTokenExpiresAt: true },
      });

      if (existing) {
        // Refresh the autoSigninToken so the client can sign in
        const token    = randomUUID();
        const expiresAt = addMinutes(new Date(), 10);
        await db.user.update({
          where: { id: existing.id },
          data:  { autoSigninToken: token, autoSigninTokenExpiresAt: expiresAt },
        });
        return NextResponse.json({
          status: "ready",
          token,
          email: existing.email,
        });
      }
    }

    // ── 3. Look up PendingSignup ───────────────────────────────────────────
    const pending = await db.pendingSignup.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (!pending) {
      // Webhook hasn't updated PendingSignup yet — tell client to retry
      return NextResponse.json({ status: "pending" });
    }

    // ── 4. Create account ─────────────────────────────────────────────────
    const { user } = await createUserFromPending(pending, stripeSubscriptionId, tier);

    return NextResponse.json({
      status: "ready",
      token:  user.autoSigninToken,
      email:  user.email,
    });
  } catch (err) {
    console.error("[complete-signup]", err);
    return NextResponse.json(
      { status: "error", error: "Something went wrong. Please contact support." },
      { status: 500 }
    );
  }
}
