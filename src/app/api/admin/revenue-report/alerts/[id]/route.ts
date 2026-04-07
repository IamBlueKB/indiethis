import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json() as {
    metric?:    string;
    condition?: string;
    threshold?: number;
    active?:    boolean;
  };

  const alert = await db.revenueReportAlert.update({
    where: { id },
    data: {
      ...(body.metric    !== undefined && { metric:    body.metric }),
      ...(body.condition !== undefined && { condition: body.condition }),
      ...(body.threshold !== undefined && { threshold: body.threshold }),
      ...(body.active    !== undefined && { active:    body.active }),
    },
  });

  return NextResponse.json(alert);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.revenueReportAlert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
