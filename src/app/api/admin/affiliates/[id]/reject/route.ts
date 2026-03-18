import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

// POST /api/admin/affiliates/[id]/reject
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const affiliate = await db.affiliate.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }

  await db.affiliate.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ ok: true });
}
