import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/dashboard/merch/balance */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, orders, withdrawals] = await Promise.all([
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { artistBalance: true, artistTotalEarnings: true, stripeConnectId: true },
    }),
    db.merchOrder.aggregate({
      where: { artistId: session.user.id },
      _sum:  { artistEarnings: true },
      _count: { id: true },
    }),
    db.artistWithdrawal.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { id: true, amount: true, status: true, createdAt: true, completedAt: true },
    }),
  ]);

  return NextResponse.json({
    artistBalance:       user?.artistBalance       ?? 0,
    artistTotalEarnings: user?.artistTotalEarnings  ?? 0,
    hasStripeConnect:    !!user?.stripeConnectId,
    totalOrders:         orders._count.id,
    totalOrderEarnings:  orders._sum.artistEarnings ?? 0,
    withdrawals,
  });
}
