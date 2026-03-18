import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

// GET /api/admin/affiliates?status=PENDING|APPROVED|REJECTED|SUSPENDED|all
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";

  const [affiliates, allApproved] = await Promise.all([
    db.affiliate.findMany({
      where: statusFilter !== "all" ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" } : undefined,
      orderBy: { appliedAt: "desc" },
      select: {
        id: true,
        applicantName: true,
        applicantEmail: true,
        status: true,
        customSlug: true,
        discountCode: true,
        commissionRate: true,
        commissionDurationMonths: true,
        totalEarned: true,
        pendingPayout: true,
        applicationData: true,
        payoutHistory: true,
        appliedAt: true,
        approvedAt: true,
        userId: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        referrals: {
          select: { isActive: true },
        },
      },
    }),
    // For monthly payout total we need all approved affiliates' payoutHistory
    db.affiliate.findMany({
      where: { status: "APPROVED" },
      select: { payoutHistory: true },
    }),
  ]);

  // Compute total commission paid out this month across all approved affiliates
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  type PayoutEntry = { amount: number; date: string; stripeTransferId: string; status: "paid" };

  let monthlyPayoutTotal = 0;
  for (const a of allApproved) {
    const history = Array.isArray(a.payoutHistory) ? (a.payoutHistory as PayoutEntry[]) : [];
    for (const entry of history) {
      if (entry.date >= monthStart) {
        monthlyPayoutTotal += entry.amount;
      }
    }
  }

  return NextResponse.json({ affiliates, monthlyPayoutTotal });
}
