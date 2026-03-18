import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

// GET /api/admin/affiliates?status=PENDING|APPROVED|REJECTED|SUSPENDED|all
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";

  const affiliates = await db.affiliate.findMany({
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
      totalEarned: true,
      pendingPayout: true,
      applicationData: true,
      appliedAt: true,
      approvedAt: true,
      userId: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ affiliates });
}
