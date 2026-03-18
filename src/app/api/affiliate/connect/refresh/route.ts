import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

/**
 * GET /api/affiliate/connect/refresh
 *
 * Stripe redirects here when an accountLink URL has expired.
 * We regenerate a fresh link and redirect the user back to Stripe.
 */
export async function GET(_req: NextRequest) {
  if (!stripe) {
    return NextResponse.redirect(`${APP_URL()}/affiliate/dashboard?error=stripe_not_configured`);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${APP_URL()}/login`);
  }

  const affiliate = await db.affiliate.findFirst({
    where: {
      userId: session.user.id,
      status: "APPROVED",
    },
    select: { stripeConnectAccountId: true },
  });

  if (!affiliate?.stripeConnectAccountId) {
    return NextResponse.redirect(`${APP_URL()}/affiliate/dashboard?error=no_connect_account`);
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account:     affiliate.stripeConnectAccountId,
      refresh_url: `${APP_URL()}/api/affiliate/connect/refresh`,
      return_url:  `${APP_URL()}/affiliate/dashboard?connected=1`,
      type:        "account_onboarding",
    });
    return NextResponse.redirect(accountLink.url);
  } catch {
    return NextResponse.redirect(`${APP_URL()}/affiliate/dashboard?error=connect_refresh_failed`);
  }
}
