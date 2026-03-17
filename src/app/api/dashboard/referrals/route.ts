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
      referralCode: true,
      _count: { select: { referrals: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-generate a referral code if none exists
  let code = user.referralCode;
  if (!code) {
    // Ensure uniqueness — retry on collision (extremely rare)
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

  return NextResponse.json({
    referralCode: code ?? null,
    referralCount: user._count.referrals,
  });
}
