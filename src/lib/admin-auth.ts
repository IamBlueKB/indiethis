import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_token";
const EXPIRY = "8h";

function getSecret() {
  const raw = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || "fallback-admin-secret";
  return new TextEncoder().encode(raw);
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function getAdminSession(): Promise<{ admin: true } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const valid = await verifyAdminToken(token);
  return valid ? { admin: true } : null;
}

export { COOKIE_NAME };
