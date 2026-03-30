import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const djsWithEarnings = await db.dJAttribution.groupBy({
    by: ["djProfileId"],
    where: { createdAt: { gte: startOfLastMonth, lt: endOfLastMonth }, amount: { gt: 0 } },
    _sum: { amount: true },
  });

  let notified = 0;

  for (const entry of djsWithEarnings) {
    const djProfile = await db.dJProfile.findUnique({
      where: { id: entry.djProfileId },
      select: { userId: true },
    });
    if (!djProfile) continue;
    const total = entry._sum.amount ?? 0;
    void createNotification({
      userId: djProfile.userId,
      type: "DJ_ATTRIBUTION_EARNED",
      title: "DJ Discovery earnings this month",
      message: `You earned $${(total / 100).toFixed(2)} from DJ Discovery referrals last month.`,
      link: "/dashboard/dj/earnings",
    }).catch(() => {});
    notified++;
  }

  return NextResponse.json({ notified });
}
