import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const MIN_PAYOUT_USD = 25;

type PayoutLogEntry = {
  amount:           number;
  date:             string;
  stripeTransferId: string;
  status:           "paid";
};

/**
 * POST /api/affiliate/payout
 *
 * Request a commission payout. Requirements:
 *   - Affiliate must be APPROVED with a linked Stripe Connect account
 *   - Stripe Connect account must have transfers capability enabled
 *   - pendingPayout must be >= $25 (MIN_PAYOUT_USD)
 *
 * On success:
 *   - Creates a Stripe transfer from the platform account → affiliate's Express account
 *   - Resets pendingPayout to 0
 *   - Appends to payoutHistory (JSON array)
 */
export async function POST(_req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve affiliate by userId or email
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  let affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      pendingPayout: true,
      stripeConnectAccountId: true,
      payoutHistory: true,
    },
  });

  if (!affiliate && user?.email) {
    affiliate = await db.affiliate.findFirst({
      where: { applicantEmail: user.email.toLowerCase(), status: "APPROVED" },
      select: {
        id: true,
        status: true,
        pendingPayout: true,
        stripeConnectAccountId: true,
        payoutHistory: true,
      },
    });
  }

  if (!affiliate) {
    return NextResponse.json({ error: "No approved affiliate account found." }, { status: 403 });
  }
  if (affiliate.status !== "APPROVED") {
    return NextResponse.json({ error: "Affiliate account is not approved." }, { status: 403 });
  }

  // Enforce minimum payout threshold
  if (affiliate.pendingPayout < MIN_PAYOUT_USD) {
    return NextResponse.json(
      { error: `Minimum payout is $${MIN_PAYOUT_USD}. Current balance: $${affiliate.pendingPayout.toFixed(2)}.` },
      { status: 400 }
    );
  }

  // Require a connected Stripe account
  if (!affiliate.stripeConnectAccountId) {
    return NextResponse.json(
      { error: "Connect your Stripe account before requesting a payout." },
      { status: 400 }
    );
  }

  // Verify the Stripe Connect account has transfers enabled
  const account = await stripe.accounts.retrieve(affiliate.stripeConnectAccountId);
  if (!account.capabilities?.transfers || account.capabilities.transfers !== "active") {
    return NextResponse.json(
      { error: "Your Stripe account is still being verified. Payouts will be available once onboarding is complete." },
      { status: 400 }
    );
  }

  // Amount in cents — round down to nearest cent
  const payoutAmountCents = Math.floor(affiliate.pendingPayout * 100);
  const payoutAmountDollars = payoutAmountCents / 100;

  // Create the Stripe transfer from the platform account to the affiliate's Express account
  const transfer = await stripe.transfers.create({
    amount:      payoutAmountCents,
    currency:    "usd",
    destination: affiliate.stripeConnectAccountId,
    metadata: {
      affiliateId:  affiliate.id,
      payoutAmount: payoutAmountDollars.toString(),
    },
  });

  // Build the new payout log entry
  const logEntry: PayoutLogEntry = {
    amount:           payoutAmountDollars,
    date:             new Date().toISOString(),
    stripeTransferId: transfer.id,
    status:           "paid",
  };

  // Append to existing history (safe even if payoutHistory is null)
  const existingHistory = Array.isArray(affiliate.payoutHistory)
    ? (affiliate.payoutHistory as PayoutLogEntry[])
    : [];
  const updatedHistory = [...existingHistory, logEntry];

  // Reset pendingPayout to 0, persist the log
  await db.affiliate.update({
    where: { id: affiliate.id },
    data: {
      pendingPayout: 0,
      payoutHistory: updatedHistory,
    },
  });

  return NextResponse.json({
    ok:              true,
    amountPaid:      payoutAmountDollars,
    stripeTransferId: transfer.id,
    newPendingPayout: 0,
  });
}
