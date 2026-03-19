import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createAdminToken, COOKIE_NAME } from "@/lib/admin-auth";
import { seedSuperAdminIfNeeded } from "@/lib/seed-super-admin";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Bootstrap super-admin from env vars if no accounts exist yet
  await seedSuperAdminIfNeeded();

  const account = await db.adminAccount.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true, mustChangePassword: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (!account.isActive) {
    return NextResponse.json({ error: "Account deactivated." }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, account.passwordHash);
  if (!passwordMatch) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // Update last login timestamp (fire-and-forget)
  db.adminAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => {});

  const token = await createAdminToken({
    id:                account.id,
    name:              account.name,
    email:             account.email,
    role:              account.role,
    mustChangePassword: account.mustChangePassword,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
