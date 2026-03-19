import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";

const ALLOWED_ROLES = ["OPS_ADMIN", "SUPPORT_ADMIN"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admins can change roles." }, { status: 403 });
  }

  const { id } = await params;
  const { role } = (await req.json()) as { role?: string };

  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return NextResponse.json({ error: "Role must be OPS_ADMIN or SUPPORT_ADMIN." }, { status: 400 });
  }

  const target = await db.adminAccount.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Super Admin accounts cannot be role-changed
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super Admin role cannot be changed." }, { status: 403 });
  }

  const updated = await db.adminAccount.update({
    where: { id },
    data: { role: role as AllowedRole },
    select: { id: true, role: true },
  });

  return NextResponse.json({ account: updated });
}
