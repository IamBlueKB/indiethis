import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admins can deactivate accounts." }, { status: 403 });
  }

  const { id } = await params;

  const target = await db.adminAccount.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Super Admin accounts can only be deactivated by themselves
  if (target.role === "SUPER_ADMIN" && target.id !== session.id) {
    return NextResponse.json(
      { error: "Super Admin accounts can only be deactivated by themselves." },
      { status: 403 }
    );
  }

  await db.adminAccount.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
