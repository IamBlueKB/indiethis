import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";
import { sendAdminPasswordResetEmail } from "@/lib/brevo/email";

/** Generates a random alphanumeric password of the given length */
function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  // Use Math.random — fine for a temporary password that the user must change
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admins can reset passwords." }, { status: 403 });
  }

  const { id } = await params;

  const target = await db.adminAccount.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Super Admin accounts can only have their password reset by themselves
  if (target.role === "SUPER_ADMIN" && target.id !== session.id) {
    return NextResponse.json(
      { error: "Super Admin passwords can only be reset by themselves." },
      { status: 403 }
    );
  }

  const tempPassword  = generateTempPassword();
  const passwordHash  = await bcrypt.hash(tempPassword, 12);

  await db.adminAccount.update({
    where: { id },
    data: { passwordHash },
  });

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/admin/login`;

  // Fire-and-forget — don't fail the request if email fails
  sendAdminPasswordResetEmail({
    name:              target.name,
    email:             target.email,
    temporaryPassword: tempPassword,
    resetBy:           session.name,
    loginUrl,
  }).catch((err: unknown) => {
    console.warn("[admin/team/reset-password] Email failed:", err);
  });

  return NextResponse.json({ ok: true });
}
