import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendAmbassadorPayoutEmail } from "@/lib/brevo/email";

/**
 * POST /api/ambassador/[code]/payout
 * Self-service payout request for ambassadors (authenticated by code).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const promoCode = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { ambassador: true },
  });

  if (!promoCode?.ambassador || !promoCode.ambassador.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ambassador = promoCode.ambassador;

  if (ambassador.creditBalance < 25) {
    return NextResponse.json(
      { error: `Minimum payout is $25. Current balance: $${ambassador.creditBalance.toFixed(2)}` },
      { status: 400 }
    );
  }

  if (!ambassador.stripeConnectId) {
    return NextResponse.json({ error: "No Stripe Connect account linked. Set up payouts first." }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Payment processing unavailable." }, { status: 500 });
  }

  const { amount = ambassador.creditBalance } = await req.json().catch(() => ({}));
  const payoutAmount = Math.min(parseFloat(amount), ambassador.creditBalance);

  const transfer = await stripe.transfers.create({
    amount: Math.round(payoutAmount * 100),
    currency: "usd",
    destination: ambassador.stripeConnectId,
    description: `Ambassador self-service payout: ${ambassador.name}`,
  });

  await Promise.all([
    db.ambassadorPayout.create({
      data: {
        ambassadorId: ambassador.id,
        amount: payoutAmount,
        method: "STRIPE_CONNECT",
        stripePayoutId: transfer.id,
      },
    }),
    db.ambassador.update({
      where: { id: ambassador.id },
      data: {
        creditBalance: { decrement: payoutAmount },
        totalPaidOut: { increment: payoutAmount },
      },
    }),
  ]);

  sendAmbassadorPayoutEmail(
    { name: ambassador.name, email: ambassador.email },
    payoutAmount,
    "STRIPE_CONNECT"
  ).catch(console.error);

  return NextResponse.json({ success: true, amount: payoutAmount }, { status: 200 });
}
