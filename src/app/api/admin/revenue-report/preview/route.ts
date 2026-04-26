import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { toStringArray }   from "@/lib/revenue-report/json-fields";
import { NextResponse }    from "next/server";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.revenueReportConfig.findFirst();
  if (!config) return NextResponse.json({ error: "No config found" }, { status: 404 });

  const { compileReport } = await import("@/lib/agents/revenue-report");
  const report = await compileReport(config.frequency, {
    dayOfWeek:  config.dayOfWeek,
    dayOfMonth: config.dayOfMonth,
  });

  const enabledSections = toStringArray(config.enabledSections);

  return NextResponse.json({ report, enabledSections });
}
