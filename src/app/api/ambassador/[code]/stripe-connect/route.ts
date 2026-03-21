import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ambassador/[code]/stripe-connect
 * Redirects ambassador to Stripe Connect onboarding.
 *
 * GET /api/ambassador/[code]/stripe-connect?return=true
 * Called by Stripe after onboarding completes — saves the account ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const isReturn = searchParams.get("return") === "true";
  const accountId = searchParams.get("account");

  const promoCode = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { ambassador: true },
  });

  if (!promoCode?.ambassador || !promoCode.ambassador.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ambassador = promoCode.ambassador;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  // ── Return from Stripe onboarding ────────────────────────────────────────
  if (isReturn && accountId) {
    // Verify the account is enabled
    if (stripe) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        if (account.charges_enabled) {
          await db.ambassador.update({
            where: { id: ambassador.id },
            data: { stripeConnectId: accountId },
          });
        }
      } catch {
        // Ignore — redirect to dashboard regardless
      }
    }
    return NextResponse.redirect(`${appUrl}/ambassador/${code}?connected=1`);
  }

  // ── Start Stripe Connect onboarding ──────────────────────────────────────
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Create or reuse Connect account
  let connectAccountId = ambassador.stripeConnectId;
  if (!connectAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: ambassador.email,
      capabilities: { transfers: { requested: true } },
    });
    connectAccountId = account.id;
  }

  const accountLink = await stripe.accountLinks.create({
    account: connectAccountId,
    refresh_url: `${appUrl}/api/ambassador/${code}/stripe-connect`,
    return_url: `${appUrl}/api/ambassador/${code}/stripe-connect?return=true&account=${connectAccountId}`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url);
}
