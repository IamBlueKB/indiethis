import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { encode } from "@auth/core/jwt";
import { cookies } from "next/headers";

const IMPERSONATE_COOKIE = "impersonation_meta";
const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

function getImpersonateSecret() {
  const raw = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || "fallback-admin-secret";
  return new TextEncoder().encode(raw);
}

export async function GET(req: NextRequest) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const t = req.nextUrl.searchParams.get("t");
  if (!t) return NextResponse.redirect(new URL("/admin/users", req.url));

  let payload: { userId: string; userName: string; userRole: string };
  try {
    const { payload: p } = await jwtVerify(t, getImpersonateSecret());
    payload = p as typeof payload;
  } catch {
    return NextResponse.redirect(new URL("/admin/users", req.url));
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, photo: true },
  });
  if (!user) return NextResponse.redirect(new URL("/admin/users", req.url));

  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const sessionToken = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.photo ?? null,
      role: user.role,
    },
    secret: authSecret,
    maxAge: 60 * 60, // 1 hour
    salt: SESSION_COOKIE,
  });

  const redirectUrl =
    user.role === "STUDIO_ADMIN"
      ? "/studio"
      : user.role === "ARTIST"
      ? "/dashboard"
      : "/admin";

  const cookieStore = await cookies();

  // Set the NextAuth session cookie
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  // Set impersonation metadata (read client-side for banner)
  cookieStore.set(IMPERSONATE_COOKIE, JSON.stringify({ userId: user.id, userName: user.name }), {
    httpOnly: false, // readable by client-side JS for the banner
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  return NextResponse.redirect(new URL(redirectUrl, req.url));
}
