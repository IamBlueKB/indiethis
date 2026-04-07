import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.revenueReportGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
