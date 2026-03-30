import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MIN_WITHDRAWAL = 2500; // $25.00 in cents

// GET /api/dashboard/dj/withdrawals — list last 20 withdrawals for current DJ
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const withdrawals = await db.dJWithdrawal.findMany({
    where: { djProfileId: djProfile.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      stripePayoutId: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ withdrawals });
}

// POST /api/dashboard/dj/withdrawals — request a withdrawal
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load DJ profile with user (for stripeConnectId)
  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: {
        select: { stripeConnectId: true },
      },
    },
  });

  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  // Require verification before withdrawing
  if (!djProfile.isVerified) {
    return NextResponse.json(
      { error: "Verification required to withdraw earnings" },
      { status: 403 }
    );
  }

  // Validate Stripe Connect account
  if (!djProfile.user.stripeConnectId)
    return NextResponse.json(
      { error: "Connect your Stripe account before withdrawing." },
      { status: 400 }
    );

  // Validate minimum balance
  if (djProfile.balance < MIN_WITHDRAWAL)
    return NextResponse.json(
      { error: `Minimum withdrawal is $25.00. Your current balance is $${(djProfile.balance / 100).toFixed(2)}.` },
      { status: 400 }
    );

  const amount = djProfile.balance;

  // Create withdrawal record and deduct balance atomically
  const [withdrawal] = await db.$transaction([
    db.dJWithdrawal.create({
      data: {
        djProfileId: djProfile.id,
        amount,
        status: "PENDING",
      },
    }),
    db.dJProfile.update({
      where: { id: djProfile.id },
      data: { balance: { decrement: amount } },
    }),
  ]);

  // TODO: Trigger actual Stripe Connect payout once Stripe account is connected
  // await stripe.transfers.create({ amount, currency: "usd", destination: djProfile.user.stripeConnectId });

  return NextResponse.json({ withdrawal }, { status: 201 });
}
