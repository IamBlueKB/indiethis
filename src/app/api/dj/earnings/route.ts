import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, balance: true, totalEarnings: true },
  });
  if (!djProfile)
    return NextResponse.json({ error: "No DJ profile" }, { status: 404 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonthAgg, attributions, withdrawals] = await Promise.all([
    db.dJAttribution.aggregate({
      where: {
        djProfileId: djProfile.id,
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    db.dJAttribution.findMany({
      where: { djProfileId: djProfile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, sourceType: true, amount: true, createdAt: true },
    }),
    db.dJWithdrawal.findMany({
      where: { djProfileId: djProfile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    balance: djProfile.balance,
    totalEarnings: djProfile.totalEarnings,
    thisMonth: thisMonthAgg._sum.amount ?? 0,
    attributions,
    withdrawals,
  });
}
