import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendAmbassadorPayoutEmail } from "@/lib/brevo/email";
import { requireAmbassadorBySessionAndCode } from "@/lib/auth/ownership";

/**
 * POST /api/ambassador/[code]/payout
 * Self-service payout request.
 *
 * Auth: ambassador code MUST resolve to an ambassador whose linked userId
 * matches the current session, OR caller is PLATFORM_ADMIN. Code alone is
 * NOT sufficient — Phase 1.2 IDOR fix (the code is 32 bits of entropy and
 * was previously the only gate on a Stripe transfer).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const guard = await requireAmbassadorBySessionAndCode(code);
  if (!guard.ok) return guard.response;
  const ambassador = guard.ambassador;

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
