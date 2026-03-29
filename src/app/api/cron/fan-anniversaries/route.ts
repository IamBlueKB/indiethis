/**
 * GET /api/cron/fan-anniversaries
 * Fires anniversary automation emails for fans who first engaged exactly 1 year ago.
 * Run daily via Vercel Cron at midnight.
 */

import { NextResponse } from "next/server";
import { triggerAnniversaryAutomations } from "@/lib/fan-automation-triggers";

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await triggerAnniversaryAutomations();
  return NextResponse.json({ ok: true });
}
