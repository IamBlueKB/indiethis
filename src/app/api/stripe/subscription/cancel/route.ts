import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cancelReason } = (await req.json()) as { cancelReason?: string };

  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, stripeSubscriptionId: true },
  });

  if (!subscription) {
    return NextResponse.json({ error: "No subscription found." }, { status: 404 });
  }

  if (subscription.status === "CANCELLED") {
    return NextResponse.json({ error: "Subscription already cancelled." }, { status: 400 });
  }

  const now = new Date();

  // If there's a Stripe subscription, cancel it at period end
  if (subscription.stripeSubscriptionId && stripe) {
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch {
      // Stripe error — still record the reason locally
    }
  }

  // Record reason and mark as CANCELLED
  await db.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelReason: cancelReason?.trim() || null,
      canceledAt: now,
      status: "CANCELLED",
    },
  });

  return NextResponse.json({ ok: true });
}
