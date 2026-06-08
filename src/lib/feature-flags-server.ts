/**
 * Server-only feature-flag helpers.
 *
 * Kept separate from `feature-flags.ts` so the pure `canAccessMixConsole(user)`
 * helper stays import-safe everywhere (no auth/db transitive imports leaking
 * into client bundles or edge runtime).
 *
 * Use `userCanAccessMixConsole()` in any server component / route handler
 * that needs to gate Mix Console + Pro Studio Mixer access:
 *
 *     if (!(await userCanAccessMixConsole())) notFound();
 */
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { canAccessMixConsole, type MixConsoleUser } from "@/lib/feature-flags";

export async function getMixConsoleSessionUser(): Promise<MixConsoleUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, mixConsoleAccess: true },
  });
}

export async function userCanAccessMixConsole(): Promise<boolean> {
  return canAccessMixConsole(await getMixConsoleSessionUser());
}
