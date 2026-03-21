import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { AmbassadorTier, RewardType } from "@prisma/client";

// ── GET — ambassador detail ───────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const ambassador = await db.ambassador.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
      payouts: { orderBy: { createdAt: "desc" } },
      promoCodes: {
        orderBy: { createdAt: "desc" },
        include: {
          redemptions: {
            orderBy: { redeemedAt: "desc" },
            include: {
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!ambassador) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Aggregate stats
  let totalRedemptions = 0;
  let totalConversions = 0;
  let totalUpgrades = 0;
  for (const code of ambassador.promoCodes) {
    totalRedemptions += code.redemptions.length;
    totalConversions += code.redemptions.filter((r) => r.status === "CONVERTED").length;
    totalUpgrades += code.redemptions.filter((r) => r.upgradedAt !== null).length;
  }

  return NextResponse.json({
    ambassador,
    stats: {
      totalRedemptions,
      totalConversions,
      totalUpgrades,
      creditBalance: ambassador.creditBalance,
      totalEarned: ambassador.totalEarned,
      totalPaidOut: ambassador.totalPaidOut,
    },
  });
}

// ── PATCH — update ambassador ─────────────────────────────────────────────────

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
    stripeConnectId,
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
      ...(stripeConnectId !== undefined ? { stripeConnectId: stripeConnectId?.trim() || null } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { promoCodes: true } },
    },
  });

  return NextResponse.json(updated);
}
