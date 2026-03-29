import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { SubscriptionTier } from "@prisma/client";

// Zero AI credit limits for comp/free-trial users.
// All platform features remain accessible; AI generation is PPU only.
const COMP_CREDITS = {
  aiVideoCreditsLimit:    0,
  aiArtCreditsLimit:      0,
  aiMasterCreditsLimit:   0,
  lyricVideoCreditsLimit: 0,
  aarReportCreditsLimit:  0,
  pressKitCreditsLimit:   0,
} as const;

type CreditLimits = {
  aiVideoCreditsLimit: number; aiArtCreditsLimit: number; aiMasterCreditsLimit: number;
  lyricVideoCreditsLimit: number; aarReportCreditsLimit: number; pressKitCreditsLimit: number;
};

// Standard limits per paid tier — restored when comp is revoked.
const TIER_CREDITS: Record<string, CreditLimits> = {
  LAUNCH:       { aiVideoCreditsLimit: 0, aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  PUSH:         { aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 3,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 1 },
  REIGN:        { aiVideoCreditsLimit: 5, aiArtCreditsLimit: 15, aiMasterCreditsLimit: 10, lyricVideoCreditsLimit: 3, aarReportCreditsLimit: 5, pressKitCreditsLimit: 3 },
  STUDIO_PRO:   { aiVideoCreditsLimit: 0, aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  STUDIO_ELITE: { aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 5,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 1 },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { enabled, expiresAt } = (await req.json()) as {
    enabled: boolean;
    expiresAt?: string | null;
  };

  // Update isComped flag on the user
  const user = await db.user.update({
    where: { id },
    data: {
      isComped: enabled,
      compExpiresAt: enabled && expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, isComped: true, compExpiresAt: true },
  });

  // Sync subscription credit limits to match comp state
  const sub = await db.subscription.findUnique({
    where:  { userId: id },
    select: { tier: true },
  });

  if (sub) {
    const credits = enabled
      ? COMP_CREDITS                                                    // comp on  → zero AI credits
      : (TIER_CREDITS[sub.tier as SubscriptionTier] ?? TIER_CREDITS.LAUNCH); // comp off → restore tier defaults

    await db.subscription.update({
      where: { userId: id },
      data:  credits,
    });
  }

  return NextResponse.json(user);
}
