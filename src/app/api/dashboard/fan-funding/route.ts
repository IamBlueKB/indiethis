import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch user's platformCredits + supporterCount
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformCredits: true, supporterCount: true },
  });

  // Fetch recent fan funding records (last 50)
  const records = await prisma.fanFunding.findMany({
    where:   { artistId: userId },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:             true,
      fanName:        true,
      fanEmail:       true,
      amount:         true,
      creditsAwarded: true,
      message:        true,
      createdAt:      true,
    },
  });

  const totalLifetime = records.reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({
    platformCredits: user?.platformCredits ?? 0,
    supporterCount:  user?.supporterCount  ?? 0,
    totalLifetime,                          // cents
    recent: records.map((r) => ({
      id:             r.id,
      fanName:        r.fanName,
      fanEmail:       r.fanEmail,
      amount:         r.amount,
      creditsAwarded: r.creditsAwarded,
      message:        r.message,
      createdAt:      r.createdAt.toISOString(),
    })),
  });
}
