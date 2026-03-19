/**
 * seed-super-admin.ts
 *
 * Bootstraps the first AdminAccount from env vars on first login.
 * Runs at most once — after any AdminAccount exists, env vars are
 * no longer used for authentication.
 */

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

let seeded = false; // in-process guard to avoid redundant DB checks

export async function seedSuperAdminIfNeeded(): Promise<void> {
  if (seeded) return;

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) return;

  // Check if any admin accounts exist yet
  const count = await db.adminAccount.count();
  if (count > 0) {
    seeded = true;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.adminAccount.create({
    data: {
      name: "Super Admin",
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      createdBy: null,
    },
  });

  console.log(`[admin] Bootstrapped super-admin account for ${email}`);
  seeded = true;
}
