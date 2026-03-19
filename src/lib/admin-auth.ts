import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_token";
const EXPIRY = "8h";

function getSecret() {
  const raw = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || "fallback-admin-secret";
  return new TextEncoder().encode(raw);
}

export interface AdminPayload {
  admin: true;
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function createAdminToken(payload: Omit<AdminPayload, "admin">): Promise<string> {
  return new SignJWT({ admin: true, ...payload } satisfies AdminPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.admin !== true) return null;
    return payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export { COOKIE_NAME };
