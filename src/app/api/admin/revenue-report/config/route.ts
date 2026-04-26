import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { toStringArray }   from "@/lib/revenue-report/json-fields";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.revenueReportConfig.findFirst();
  if (!config) return NextResponse.json({ error: "No config found" }, { status: 404 });

  return NextResponse.json({
    ...config,
    recipients:      toStringArray(config.recipients),
    enabledSections: toStringArray(config.enabledSections),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    frequency?:       string;
    dayOfWeek?:       number;
    dayOfMonth?:      number;
    timeUtc?:         string;
    recipients?:      string[];
    enabledSections?: string[];
  };

  const config = await db.revenueReportConfig.findFirst();
  if (!config) return NextResponse.json({ error: "No config found" }, { status: 404 });

  const updated = await db.revenueReportConfig.update({
    where: { id: config.id },
    data: {
      ...(body.frequency       !== undefined && { frequency:       body.frequency }),
      ...(body.dayOfWeek       !== undefined && { dayOfWeek:       body.dayOfWeek }),
      ...(body.dayOfMonth      !== undefined && { dayOfMonth:      body.dayOfMonth }),
      ...(body.timeUtc         !== undefined && { timeUtc:         body.timeUtc }),
      ...(body.recipients      !== undefined && { recipients:      JSON.stringify(body.recipients) }),
      ...(body.enabledSections !== undefined && { enabledSections: JSON.stringify(body.enabledSections) }),
    },
  });

  return NextResponse.json({
    ...updated,
    recipients:      toStringArray(updated.recipients),
    enabledSections: toStringArray(updated.enabledSections),
  });
}
