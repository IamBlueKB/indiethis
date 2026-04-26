import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";

/**
 * Returns the session if the caller is a PLATFORM_ADMIN, else null.
 * Use in every /api/admin/reference-library/* route.
 */
export async function assertReferenceAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}
