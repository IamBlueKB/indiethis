import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";
import { sendAdminWelcomeEmail } from "@/lib/brevo/email";

const ALLOWED_ROLES = ["OPS_ADMIN", "SUPPORT_ADMIN"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admins can create admin accounts." }, { status: 403 });
  }

  const { name, email, password, role } = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  // Validation
  if (!name?.trim())     return NextResponse.json({ error: "Name is required."              }, { status: 400 });
  if (!email?.trim())    return NextResponse.json({ error: "Email is required."             }, { status: 400 });
  if (!password?.trim()) return NextResponse.json({ error: "Temporary password is required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return NextResponse.json({ error: "Role must be OPS_ADMIN or SUPPORT_ADMIN." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Duplicate check
  const existing = await db.adminAccount.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An admin account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const account = await db.adminAccount.create({
    data: {
      name:         name.trim(),
      email:        normalizedEmail,
      passwordHash,
      role:         role as AllowedRole,
      createdBy:    session.id,
      isActive:     true,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Send welcome email (fire-and-forget — don't fail the request if email fails)
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/admin/login`;
  sendAdminWelcomeEmail({
    name:              account.name,
    email:             account.email,
    temporaryPassword: password,
    role:              account.role,
    loginUrl,
  }).catch((err: unknown) => {
    console.warn("[admin/team] Welcome email failed:", err);
  });

  return NextResponse.json({ account }, { status: 201 });
}
