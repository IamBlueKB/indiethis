/**
 * reset-admin.ts — run with: npx ts-node scripts/reset-admin.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email    = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("❌  ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local");
    process.exit(1);
  }

  console.log(`Resetting admin account for: ${email}`);
  await db.adminAccount.deleteMany({});
  console.log("  Deleted existing admin accounts.");

  const passwordHash = await bcrypt.hash(password, 12);
  await db.adminAccount.create({
    data: {
      name:               "Super Admin",
      email,
      passwordHash,
      role:               "SUPER_ADMIN",
      createdBy:          null,
      mustChangePassword: false,
    },
  });

  console.log(`✅  Super-admin created: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
