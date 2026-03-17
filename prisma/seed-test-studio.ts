/**
 * Seed a test studio account for development/preview purposes.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-test-studio.ts
 * Or add to package.json scripts: "seed:test": "ts-node prisma/seed-test-studio.ts"
 *
 * Creates:
 *   Email:    test@indiethis.dev
 *   Password: TestStudio123!
 *   Studio:   Southside Sound Co.
 *   Slug:     southside-sound
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = "test@indiethis.dev";
  const password = "TestStudio123!";
  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert user
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Test Admin",
      role: "STUDIO_ADMIN",
    },
  });

  // Upsert studio
  await db.studio.upsert({
    where: { slug: "southside-sound" },
    update: {},
    create: {
      ownerId: user.id,
      name: "Southside Sound Co.",
      slug: "southside-sound",
      tagline: "Where Atlanta's underground goes to record",
      bio: "Southside Sound Co. is a full-service recording studio in Atlanta. We specialize in hip-hop, R&B, trap, and soul — with a live room, isolation booth, and two mix suites. Pro Tools, Neve console, and a roster of in-house engineers ready to go.",
      phone: "(404) 555-0172",
      email: "booking@southsidesound.dev",
      streetAddress: "812 Memorial Dr SE",
      city: "Atlanta",
      state: "GA",
      zipCode: "30316",
      instagram: "southsidesoundco",
      tiktok: "southsidesoundco",
      studioTier: "ELITE",
      onboardingCompleted: false,
      isPublished: false,
      servicesJson: JSON.stringify([
        { name: "Recording", description: "Full session recording with in-house engineer. Hourly and day rates available." },
        { name: "Mixing", description: "Stem mixing with up to 3 revisions included. Delivered in 5–7 business days." },
        { name: "Mastering", description: "Mastering for streaming, vinyl, and broadcast. Fast turnaround." },
        { name: "Podcast Production", description: "Record, edit, and produce your podcast with studio acoustics and professional gear." },
      ]),
    },
  });

  console.log("\n✓ Test studio seeded");
  console.log("  Email:    " + email);
  console.log("  Password: " + password);
  console.log("  Studio:   Southside Sound Co.");
  console.log("  Slug:     southside-sound");
  console.log("  Tier:     ELITE");
  console.log("\n  Login at: http://localhost:3456/login\n");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
