import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const MIN_WITHDRAWAL = 25; // $25.00 minimum

/** GET /api/dashboard/merch/withdrawal — withdrawal history */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withdrawals = await db.artistWithdrawal.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  { id: true, amount: true, stripeTransferId: true, status: true, createdAt: true, completedAt: true },
  });

  return NextResponse.json({ withdrawals });
}

/** POST /api/dashboard/merch/withdrawal — request a payout */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, stripeConnectId: true, artistBalance: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.stripeConnectId) {
    return NextResponse.json({ error: "Connect your Stripe account to withdraw earnings." }, { status: 400 });
  }

  if (user.artistBalance < MIN_WITHDRAWAL) {
    return NextResponse.json({
      error: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(2)}. Current balance: $${user.artistBalance.toFixed(2)}.`,
    }, { status: 400 });
  }

  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const amount      = user.artistBalance;
  const amountCents = Math.floor(amount * 100);

  // Create withdrawal record first
  const withdrawal = await db.artistWithdrawal.create({
    data: { userId: user.id, amount, status: "PENDING" },
  });

  // Atomically decrement balance
  await db.user.update({
    where: { id: user.id },
    data:  { artistBalance: { decrement: amount } },
  });

  try {
    const transfer = await stripe.transfers.create({
      amount:             amountCents,
      currency:           "usd",
      destination:        user.stripeConnectId,
      transfer_group:     `artist_withdrawal_${withdrawal.id}`,
      metadata:           { userId: user.id, withdrawalId: withdrawal.id },
    });

    await db.artistWithdrawal.update({
      where: { id: withdrawal.id },
      data:  { stripeTransferId: transfer.id },
    });

    return NextResponse.json({ ok: true, withdrawalId: withdrawal.id });
  } catch (err) {
    // Rollback balance + mark failed
    await db.user.update({
      where: { id: user.id },
      data:  { artistBalance: { increment: amount } },
    });
    await db.artistWithdrawal.update({
      where: { id: withdrawal.id },
      data:  { status: "FAILED" },
    });
    console.error("[merch/withdrawal]", err);
    return NextResponse.json({ error: "Transfer failed. Please try again." }, { status: 500 });
  }
}
