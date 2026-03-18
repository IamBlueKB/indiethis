import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous chars
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      referralCode:       true,
      referralRewardTier: true,
      referralsGiven: {
        select: {
          isActive:    true,
          activatedAt: true,
          createdAt:   true,
          referred: {
            select: {
              name:      true,
              createdAt: true,
              subscription: {
                select: { tier: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-generate a referral code if none exists
  let code = user.referralCode;
  if (!code) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = generateReferralCode();
      const existing = await db.user.findUnique({ where: { referralCode: candidate } });
      if (!existing) {
        code = candidate;
        await db.user.update({ where: { id: session.user.id }, data: { referralCode: code } });
        break;
      }
    }
  }

  const totalCount  = user.referralsGiven.length;
  const activeCount = user.referralsGiven.filter((r) => r.isActive).length;

  const referredUsers = user.referralsGiven.map((r) => ({
    firstName: (r.referred.name ?? "Unknown").split(" ")[0],
    tier:      r.referred.subscription?.tier ?? null,
    isActive:  r.isActive,
    createdAt: r.referred.createdAt.toISOString(),
  }));

  return NextResponse.json({
    referralCode: code ?? null,
    totalCount,
    activeCount,
    currentTier:  user.referralRewardTier,
    referredUsers,
  });
}
