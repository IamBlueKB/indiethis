import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

/**
 * POST /api/admin/affiliates/[id]/suspend
 *
 * Sets affiliate status to SUSPENDED.
 * Can also be used to re-activate a suspended affiliate (pass ?reactivate=1).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const reactivate = searchParams.get("reactivate") === "1";

  const affiliate = await db.affiliate.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }

  const newStatus = reactivate ? "APPROVED" : "SUSPENDED";

  const updated = await db.affiliate.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
