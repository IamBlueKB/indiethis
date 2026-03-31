import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

/**
 * POST /api/dashboard/stripe-connect
 *
 * Initiates Stripe Connect Express onboarding for DJs and producers.
 * Works for any logged-in user — stores stripeConnectId on the User model.
 *
 * Flow:
 *   1. Verify the user is logged in.
 *   2. Create a Stripe Express account if one doesn't exist yet.
 *   3. Persist stripeConnectId on the User row.
 *   4. Create an accountLink and return the onboarding URL.
 *
 * Stripe redirects back to /dashboard/earnings?connected=1 on success,
 * or to /api/dashboard/stripe-connect/refresh on expiry.
 */
export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, stripeConnectId: true },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let connectId = user.stripeConnectId;

  // Create a Stripe Express account if not already linked
  if (!connectId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { userId: session.user.id },
    });
    connectId = account.id;

    await db.user.update({
      where: { id: session.user.id },
      data: { stripeConnectId: connectId },
    });
  }

  // Create a fresh account link (they expire after a few minutes)
  const accountLink = await stripe.accountLinks.create({
    account:     connectId,
    refresh_url: `${APP_URL()}/api/dashboard/stripe-connect/refresh`,
    return_url:  `${APP_URL()}/dashboard/earnings?connected=1`,
    type:        "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
