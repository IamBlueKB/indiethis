import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    totalCodes,
    totalRedemptions,
    totalConversions,
    retainedCount,
    allCodes,
    topAmbassadors,
    winBackCandidates,
  ] = await Promise.all([
    db.promoCode.count(),
    db.promoRedemption.count(),
    db.promoRedemption.count({ where: { status: "CONVERTED" } }),
    // "Retained" = CONVERTED redemptions where user still has an active subscription after 90d
    db.promoRedemption.count({
      where: {
        status: "CONVERTED",
        convertedAt: { lte: ninetyDaysAgo },
        user: { subscription: { status: "ACTIVE" } },
      },
    }),

    // Top 10 codes by redemption count with conversion counts
    db.promoCode.findMany({
      orderBy: { currentRedemptions: "desc" },
      take: 10,
      include: {
        _count: { select: { redemptions: true } },
        redemptions: { select: { status: true } },
        ambassador: { select: { name: true } },
      },
    }),

    // Top 5 ambassadors by total earned
    db.ambassador.findMany({
      orderBy: { totalEarned: "desc" },
      take: 5,
      include: {
        _count: { select: { promoCodes: true } },
        promoCodes: {
          include: {
            _count: { select: { redemptions: true } },
            redemptions: { select: { status: true } },
          },
        },
      },
    }),

    // Win-back: expired/grace redemptions for users with no active subscription
    db.promoRedemption.findMany({
      where: {
        OR: [{ status: "EXPIRED" }, { graceUntil: { not: null } }],
        user: {
          OR: [
            { subscription: null },
            { subscription: { status: { not: "ACTIVE" } } },
          ],
        },
      },
      orderBy: { redeemedAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, email: true } },
        promoCode: { select: { code: true, type: true } },
      },
    }),
  ]);

  // Build top codes response
  const topCodes = allCodes.map((code) => {
    const conversions = code.redemptions.filter((r) => r.status === "CONVERTED").length;
    const conversionRate = code.currentRedemptions > 0
      ? ((conversions / code.currentRedemptions) * 100).toFixed(1)
      : "0.0";
    return {
      id: code.id,
      code: code.code,
      type: code.type,
      redemptions: code.currentRedemptions,
      conversions,
      conversionRate: `${conversionRate}%`,
      ambassadorName: code.ambassador?.name ?? null,
    };
  });

  // Build top ambassadors response
  const topAmb = topAmbassadors.map((amb) => {
    let referrals = 0;
    let conversions = 0;
    for (const pc of amb.promoCodes) {
      referrals += pc._count.redemptions;
      conversions += pc.redemptions.filter((r) => r.status === "CONVERTED").length;
    }
    return {
      id: amb.id,
      name: amb.name,
      tier: amb.tier,
      referrals,
      conversions,
      totalEarned: amb.totalEarned,
      creditBalance: amb.creditBalance,
    };
  });

  // CPA: total ambassador earnings / total conversions
  const ambassadorEarningsTotal = await db.ambassador.aggregate({ _sum: { totalEarned: true } });
  const totalEarningsPaid = ambassadorEarningsTotal._sum.totalEarned ?? 0;
  const cpa = totalConversions > 0
    ? (totalEarningsPaid / totalConversions).toFixed(2)
    : "0.00";

  return NextResponse.json({
    funnel: {
      codesCreated: totalCodes,
      totalRedemptions,
      totalConversions,
      retained: retainedCount,
    },
    topCodes,
    topAmbassadors: topAmb,
    cpa,
    winBackCandidates: winBackCandidates.map((r) => ({
      id: r.id,
      userName: r.user?.name ?? "—",
      userEmail: r.user?.email ?? "—",
      code: r.promoCode?.code ?? "—",
      codeType: r.promoCode?.type ?? "—",
      status: r.status,
      redeemedAt: r.redeemedAt,
      graceUntil: r.graceUntil,
    })),
  });
}
