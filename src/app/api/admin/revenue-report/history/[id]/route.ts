import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const log = await db.revenueReportLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(log);
}
