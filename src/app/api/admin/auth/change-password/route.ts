import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminSession, createAdminToken, COOKIE_NAME } from "@/lib/admin-auth";

/** Validates password strength: min 8 chars, at least one letter, at least one digit */
function validateStrength(password: string): string | null {
  if (password.length < 8)         return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password))  return "Password must contain at least one letter.";
  if (!/[0-9]/.test(password))     return "Password must contain at least one number.";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password, confirmPassword } = (await req.json()) as {
    password?:        string;
    confirmPassword?: string;
  };

  if (!password?.trim()) {
    return NextResponse.json({ error: "New password is required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const strengthError = validateStrength(password);
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.adminAccount.update({
    where: { id: session.id },
    data: { passwordHash, mustChangePassword: false },
  });

  // Re-issue the JWT with mustChangePassword: false
  const token = await createAdminToken({
    id:                 session.id,
    name:               session.name,
    email:              session.email,
    role:               session.role,
    mustChangePassword: false,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 8, // 8 hours
  });

  return res;
}
