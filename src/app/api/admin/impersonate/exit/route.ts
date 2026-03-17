import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const IMPERSONATE_COOKIE = "impersonation_meta";
const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  cookieStore.set(IMPERSONATE_COOKIE, "", { maxAge: 0, path: "/" });
  return NextResponse.json({ ok: true });
}
