import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supports = await db.artistSupport.findMany({
    where:   { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
    select:  {
      id:             true,
      supporterEmail: true,
      amount:         true,
      message:        true,
      createdAt:      true,
    },
  });

  // Aggregate by email — total spend per supporter, sorted descending
  const byEmail = new Map<string, { email: string; total: number; count: number; latest: string; messages: string[] }>();
  for (const s of supports) {
    const key = s.supporterEmail.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      existing.total  += s.amount;
      existing.count  += 1;
      if (s.message) existing.messages.push(s.message);
    } else {
      byEmail.set(key, {
        email:    s.supporterEmail,
        total:    s.amount,
        count:    1,
        latest:   s.createdAt.toISOString(),
        messages: s.message ? [s.message] : [],
      });
    }
  }

  const supporters = Array.from(byEmail.values())
    .sort((a, b) => b.total - a.total);

  const totalTips     = supports.reduce((sum, s) => sum + s.amount, 0);
  const totalTipCount = supports.length;

  return NextResponse.json({ supporters, totalTips, totalTipCount });
}
