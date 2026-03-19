/**
 * require-admin-access.ts
 *
 * Server-only utility for admin page route protection.
 * Call at the top of any admin page to enforce role-based access control.
 *
 * Usage (server component):
 *   const { session, viewOnly } = await requireAdminAccess("users");
 */

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccess, isViewOnly } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";
import type { AdminPayload } from "@/lib/admin-auth";

export async function requireAdminAccess(
  page: string
): Promise<{ session: AdminPayload; viewOnly: boolean }> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const role = session.role as AdminRole;

  if (!canAccess(role, page)) {
    redirect(`/admin?denied=${encodeURIComponent(page)}`);
  }

  return { session, viewOnly: isViewOnly(role, page) };
}
