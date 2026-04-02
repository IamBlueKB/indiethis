/**
 * Reset the password for admin@indiethis.com and ensure PLATFORM_ADMIN role.
 * Usage: node scripts/reset-admin-password.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const EMAIL    = "admin@indiethis.com";
const PASSWORD = "IndieThis2024!";   // ← change this to whatever you want

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const user = await db.user.upsert({
    where:  { email: EMAIL },
    update: {
      passwordHash: hash,
      role:         "PLATFORM_ADMIN",
    },
    create: {
      email:        EMAIL,
      name:         "IndieThis Admin",
      passwordHash: hash,
      role:         "PLATFORM_ADMIN",
    },
    select: { id: true, email: true, role: true },
  });

  console.log("✅ Done:", user);
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
