import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = 20;
  const skip    = (page - 1) * perPage;

  const [logs, total] = await Promise.all([
    db.revenueReportLog.findMany({
      orderBy: { createdAt: "desc" },
      take:    perPage,
      skip,
      select: {
        id:        true,
        period:    true,
        frequency: true,
        sentTo:    true,
        createdAt: true,
      },
    }),
    db.revenueReportLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, perPage, totalPages: Math.ceil(total / perPage) });
}
