import { getAdminSession } from "@/lib/admin-auth";

/**
 * Returns the admin session if the caller is logged in via the admin
 * cookie auth flow (used by /admin/login), else null.
 *
 * Use in every /api/admin/reference-library/* route. Note: the admin panel
 * uses cookie-based JWT auth (getAdminSession) — NOT NextAuth — so this
 * helper must check the admin cookie, not the NextAuth session.
 */
export async function assertReferenceAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  // Any admin role can access the reference library
  return session;
}
