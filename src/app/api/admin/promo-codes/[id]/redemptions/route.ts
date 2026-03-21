import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));

  const code = await db.promoCode.findUnique({ where: { id } });
  if (!code) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [total, redemptions] = await Promise.all([
    db.promoRedemption.count({ where: { promoCodeId: id } }),
    db.promoRedemption.findMany({
      where: { promoCodeId: id },
      orderBy: { redeemedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true, subscription: { select: { tier: true, status: true } } } },
      },
    }),
  ]);

  return NextResponse.json({ redemptions, total, pages: Math.ceil(total / limit), page });
}
