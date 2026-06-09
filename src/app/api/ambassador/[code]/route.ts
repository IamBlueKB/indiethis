import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAmbassadorBySessionAndCode } from "@/lib/auth/ownership";

/**
 * GET /api/ambassador/[code]
 * Returns ambassador stats. Phase 1.2 PII scrub: requires the caller's
 * session to match the ambassador's linked userId (or PLATFORM_ADMIN).
 * Previously the promo code alone unlocked the entire stats payload —
 * balance, payouts, list of every redemption — which is sensitive
 * financial data that should not be public.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const guard = await requireAmbassadorBySessionAndCode(code);
  if (!guard.ok) return guard.response;

  // Re-fetch with the deeper include shape required by the response.
  // (The guard already verified ownership via the parent PromoCode.)
  const promoCode = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      ambassador: {
        include: {
          payouts: { orderBy: { createdAt: "desc" }, take: 20 },
          promoCodes: {
            include: {
              redemptions: {
                orderBy: { redeemedAt: "desc" },
                include: { user: { select: { email: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!promoCode?.ambassador) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ambassador = promoCode.ambassador;

  // Aggregate stats
  let totalRedemptions = 0;
  let totalConversions = 0;
  const allRedemptions: Array<{
    email: string;
    redeemedAt: Date;
    status: string;
    code: string;
  }> = [];

  for (const pc of ambassador.promoCodes) {
    totalRedemptions += pc.redemptions.length;
    totalConversions += pc.redemptions.filter((r) => r.status === "CONVERTED").length;
    for (const r of pc.redemptions) {
      allRedemptions.push({
        email: r.user?.email ?? "",
        redeemedAt: r.redeemedAt,
        status: r.status,
        code: pc.code,
      });
    }
  }

  allRedemptions.sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());

  return NextResponse.json({
    ambassador: {
      id: ambassador.id,
      name: ambassador.name,
      tier: ambassador.tier,
      rewardType: ambassador.rewardType,
      rewardValue: ambassador.rewardValue,
      creditBalance: ambassador.creditBalance,
      totalEarned: ambassador.totalEarned,
      totalPaidOut: ambassador.totalPaidOut,
      stripeConnectId: !!ambassador.stripeConnectId, // boolean only — don't expose the ID
      promoCodes: ambassador.promoCodes.map((pc) => ({
        code: pc.code,
        type: pc.type,
      })),
    },
    stats: { totalRedemptions, totalConversions },
    redemptions: allRedemptions.slice(0, 50).map((r) => ({
      // Mask email: j***@example.com
      email: r.email.replace(/^(.)(.*)(@.*)$/, (_, first, _mid, domain) => `${first}***${domain}`),
      redeemedAt: r.redeemedAt,
      status: r.status,
      code: r.code,
    })),
    payouts: ambassador.payouts.map((p) => ({
      amount: p.amount,
      method: p.method,
      createdAt: p.createdAt,
    })),
    primaryCode: code.toUpperCase(),
  });
}
