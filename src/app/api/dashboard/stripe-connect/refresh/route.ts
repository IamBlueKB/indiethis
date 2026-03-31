import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

/**
 * GET /api/dashboard/stripe-connect/refresh
 *
 * Stripe redirects here when an accountLink URL has expired.
 * Regenerates a fresh link and redirects the user back to Stripe onboarding.
 */
export async function GET() {
  if (!stripe) {
    return NextResponse.redirect(`${APP_URL()}/dashboard/settings?error=stripe_not_configured`);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${APP_URL()}/login`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeConnectId: true },
  });

  if (!user?.stripeConnectId) {
    return NextResponse.redirect(`${APP_URL()}/dashboard/settings?error=no_connect_account`);
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account:     user.stripeConnectId,
      refresh_url: `${APP_URL()}/api/dashboard/stripe-connect/refresh`,
      return_url:  `${APP_URL()}/dashboard/earnings?connected=1`,
      type:        "account_onboarding",
    });
    return NextResponse.redirect(accountLink.url);
  } catch {
    return NextResponse.redirect(`${APP_URL()}/dashboard/settings?error=connect_refresh_failed`);
  }
}
