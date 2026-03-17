import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

function getImpersonateSecret() {
  const raw = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || "fallback-admin-secret";
  return new TextEncoder().encode(raw);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, isSuspended: true },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Issue a short-lived impersonation exchange token (30 min)
  const token = await new SignJWT({ userId: user.id, userName: user.name, userRole: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getImpersonateSecret());

  return NextResponse.json({ token });
}
