import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await db.revenueReportAlert.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    metric:    string;
    condition: string;
    threshold: number;
    active?:   boolean;
  };

  if (!body.metric || !body.condition || body.threshold == null) {
    return NextResponse.json({ error: "metric, condition, threshold required" }, { status: 400 });
  }

  const alert = await db.revenueReportAlert.create({
    data: {
      metric:    body.metric,
      condition: body.condition,
      threshold: body.threshold,
      active:    body.active ?? true,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
