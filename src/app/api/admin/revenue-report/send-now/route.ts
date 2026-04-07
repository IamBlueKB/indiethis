import { getAdminSession }  from "@/lib/admin-auth";
import { NextResponse }      from "next/server";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runRevenueReportAgent } = await import("@/lib/agents/revenue-report");
  const result = await runRevenueReportAgent();

  return NextResponse.json({ ok: true, ...result });
}
