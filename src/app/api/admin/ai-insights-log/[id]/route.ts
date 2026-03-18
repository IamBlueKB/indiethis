import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/ai-insights-log/[id]
// Update actionTaken or accuracy on an AIInsightsLog entry.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { actionTaken?: string; accuracy?: boolean };

  const data: { actionTaken?: string; accuracy?: boolean } = {};
  if (typeof body.actionTaken === "string") data.actionTaken = body.actionTaken;
  if (typeof body.accuracy === "boolean") data.accuracy = body.accuracy;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const log = await db.aIInsightsLog.update({
    where: { id },
    data,
  });

  return NextResponse.json({ log });
}
