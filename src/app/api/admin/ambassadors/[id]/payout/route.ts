import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendAmbassadorPayoutEmail } from "@/lib/brevo/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { amount, method, notes } = body;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!method || !["CREDIT", "STRIPE_CONNECT", "MANUAL"].includes(method)) {
    return NextResponse.json({ error: "method must be CREDIT, STRIPE_CONNECT, or MANUAL" }, { status: 400 });
  }

  const ambassador = await db.ambassador.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, stripeCustomerId: true } } },
  });
  if (!ambassador) return NextResponse.json({ error: "Ambassador not found" }, { status: 404 });

  if (amount > ambassador.creditBalance) {
    return NextResponse.json(
      { error: `Amount (${amount}) exceeds available balance (${ambassador.creditBalance.toFixed(2)})` },
      { status: 400 }
    );
  }

  let stripePayoutId: string | null = null;

  // ── Process payout ──────────────────────────────────────────────────────────
  if (method === "STRIPE_CONNECT") {
    if (!ambassador.stripeConnectId) {
      return NextResponse.json({ error: "Ambassador has no Stripe Connect account" }, { status: 400 });
    }
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      destination: ambassador.stripeConnectId,
      description: `Ambassador payout: ${ambassador.name} (${id})`,
    });
    stripePayoutId = transfer.id;
  } else if (method === "CREDIT" && ambassador.user?.stripeCustomerId && stripe) {
    const balanceTxn = await stripe.customers.createBalanceTransaction(
      ambassador.user.stripeCustomerId,
      {
        amount: -Math.round(amount * 100), // negative = credit
        currency: "usd",
        description: `Ambassador credit payout: ${ambassador.name}`,
      }
    );
    stripePayoutId = balanceTxn.id;
  }

  // ── Create payout record + update ambassador balance ────────────────────────
  const [payout, updatedAmbassador] = await Promise.all([
    db.ambassadorPayout.create({
      data: {
        ambassadorId: id,
        amount,
        method,
        stripePayoutId,
        ...(notes ? {} : {}), // notes field not in model currently
      },
    }),
    db.ambassador.update({
      where: { id },
      data: {
        creditBalance: { decrement: amount },
        totalPaidOut: { increment: amount },
      },
    }),
  ]);

  // ── Send payout notification ─────────────────────────────────────────────────
  const emailTarget = ambassador.user ?? ambassador;
  sendAmbassadorPayoutEmail(
    { name: emailTarget.name ?? ambassador.name, email: emailTarget.email ?? ambassador.email },
    amount,
    method
  ).catch(console.error);

  return NextResponse.json({ payout, ambassador: updatedAmbassador }, { status: 201 });
}
