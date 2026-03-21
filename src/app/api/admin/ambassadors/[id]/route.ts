import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { AmbassadorTier, RewardType } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    tier,
    rewardType,
    rewardValue,
    rewardDurationMonths,
    isActive,
    notes,
    creditBalance,
  } = body;

  const existing = await db.ambassador.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.ambassador.update({
    where: { id },
    data: {
      ...(tier !== undefined ? { tier: tier as AmbassadorTier } : {}),
      ...(rewardType !== undefined ? { rewardType: rewardType as RewardType } : {}),
      ...(rewardValue !== undefined ? { rewardValue: parseFloat(rewardValue) } : {}),
      ...(rewardDurationMonths !== undefined ? { rewardDurationMonths: rewardDurationMonths ? parseInt(rewardDurationMonths) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(creditBalance !== undefined ? { creditBalance: parseFloat(creditBalance) } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { promoCodes: true } },
    },
  });

  return NextResponse.json(updated);
}
