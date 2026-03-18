import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

/**
 * POST /api/affiliate/connect
 *
 * Initiates Stripe Connect Express onboarding for an approved affiliate.
 *
 * Flow:
 *   1. Verify the logged-in user has an APPROVED Affiliate record.
 *   2. Create a Stripe Express account if one doesn't exist yet.
 *   3. Persist stripeConnectAccountId on the Affiliate row.
 *   4. Create an accountLink and return the onboarding URL.
 *
 * The client redirects the user to the returned URL.
 * Stripe redirects back to /affiliate/dashboard?connected=1 on success,
 * or to /api/affiliate/connect/refresh on expiry.
 */
export async function POST(_req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the affiliate — match by userId first, then fall back to email
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      applicantName: true,
      applicantEmail: true,
      stripeConnectAccountId: true,
    },
  });

  // Try matching by email if no userId link yet
  if (!affiliate && user.email) {
    affiliate = await db.affiliate.findFirst({
      where: { applicantEmail: user.email.toLowerCase(), status: "APPROVED" },
      select: {
        id: true,
        status: true,
        applicantName: true,
        applicantEmail: true,
        stripeConnectAccountId: true,
      },
    });
    // Link the userId while we're here
    if (affiliate) {
      await db.affiliate.update({
        where: { id: affiliate.id },
        data: { userId: session.user.id },
      });
    }
  }

  if (!affiliate) {
    return NextResponse.json({ error: "No approved affiliate account found." }, { status: 403 });
  }
  if (affiliate.status !== "APPROVED") {
    return NextResponse.json({ error: "Affiliate account is not approved." }, { status: 403 });
  }

  let connectAccountId = affiliate.stripeConnectAccountId;

  // Create a Stripe Express account if not already linked
  if (!connectAccountId) {
    const account = await stripe.accounts.create({
      type:    "express",
      email:   user.email ?? affiliate.applicantEmail,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { affiliateId: affiliate.id, userId: session.user.id },
    });
    connectAccountId = account.id;

    await db.affiliate.update({
      where: { id: affiliate.id },
      data:  { stripeConnectAccountId: connectAccountId },
    });
  }

  // Create a fresh account link (they expire after a few minutes)
  const accountLink = await stripe.accountLinks.create({
    account:     connectAccountId,
    refresh_url: `${APP_URL()}/api/affiliate/connect/refresh`,
    return_url:  `${APP_URL()}/affiliate/dashboard?connected=1`,
    type:        "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
