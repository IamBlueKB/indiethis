import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? currentPeriod();

  const goals = await db.revenueReportGoal.findMany({
    where:   { period },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    metric:      string;
    targetValue: number; // always in cents for money, count for users
    period?:     string;
  };

  if (!body.metric || body.targetValue == null) {
    return NextResponse.json({ error: "metric and targetValue required" }, { status: 400 });
  }

  const goal = await db.revenueReportGoal.create({
    data: {
      metric:      body.metric,
      targetValue: body.targetValue,
      period:      body.period ?? currentPeriod(),
    },
  });

  return NextResponse.json(goal, { status: 201 });
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
