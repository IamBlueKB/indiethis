import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/affiliate/me
 *
 * Returns the current user's affiliate record with payout state.
 * Used by the affiliate dashboard (step 20).
 *
 * Also resolves whether the connected Stripe account has transfers enabled,
 * so the UI can show the correct CTA (Connect / Pending verification / Request Payout).
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  // Resolve affiliate
  let affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      applicantName: true,
      applicantEmail: true,
      customSlug: true,
      discountCode: true,
      commissionRate: true,
      commissionDurationMonths: true,
      totalEarned: true,
      pendingPayout: true,
      stripeConnectAccountId: true,
      payoutHistory: true,
      approvedAt: true,
      referrals: {
        select: {
          id: true,
          isActive: true,
          monthsRemaining: true,
          totalCommissionPaid: true,
          createdAt: true,
          referredUser: {
            select: {
              name: true,
              createdAt: true,
              subscription: {
                select: { tier: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!affiliate && user?.email) {
    affiliate = await db.affiliate.findFirst({
      where: { applicantEmail: user.email.toLowerCase() },
      select: {
        id: true,
        status: true,
        applicantName: true,
        applicantEmail: true,
        customSlug: true,
        discountCode: true,
        commissionRate: true,
        commissionDurationMonths: true,
        totalEarned: true,
        pendingPayout: true,
        stripeConnectAccountId: true,
        payoutHistory: true,
        approvedAt: true,
        referrals: {
          select: {
            id: true,
            isActive: true,
            monthsRemaining: true,
            totalCommissionPaid: true,
            createdAt: true,
            referredUser: {
              select: {
                name: true,
                createdAt: true,
                subscription: {
                  select: { tier: true, status: true },
                },
              },
            },
          },
        },
      },
    });
    // Auto-link userId
    if (affiliate && !affiliate.id) {
      await db.affiliate.update({
        where: { id: affiliate.id },
        data: { userId: session.user.id },
      });
    }
  }

  if (!affiliate) {
    return NextResponse.json({ affiliate: null });
  }

  // Check Stripe Connect account status
  let stripeConnectStatus: "not_connected" | "pending" | "active" = "not_connected";
  if (affiliate.stripeConnectAccountId && stripe) {
    try {
      const account = await stripe.accounts.retrieve(affiliate.stripeConnectAccountId);
      stripeConnectStatus =
        account.capabilities?.transfers === "active" ? "active" :
        account.details_submitted                    ? "pending" :
        "not_connected";
    } catch {
      stripeConnectStatus = "not_connected";
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  return NextResponse.json({
    affiliate: {
      ...affiliate,
      affiliateLink:      affiliate.customSlug ? `${appUrl}/ref/${affiliate.customSlug}` : null,
      stripeConnectStatus,
      canRequestPayout:   affiliate.pendingPayout >= 25 && stripeConnectStatus === "active",
      activeReferrals:    affiliate.referrals.filter((r) => r.isActive).length,
      totalReferrals:     affiliate.referrals.length,
    },
  });
}
