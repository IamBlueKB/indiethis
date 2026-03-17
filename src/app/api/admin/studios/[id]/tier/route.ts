import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tier } = (await req.json()) as { tier: string | null };

  if (tier !== null && !["PRO", "ELITE"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const studio = await db.studio.update({
    where: { id },
    data: { tierOverride: tier },
    select: { id: true, tierOverride: true, studioTier: true },
  });

  return NextResponse.json(studio);
}
