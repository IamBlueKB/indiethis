/**
 * seed-promo.ts
 *
 * Seeds promo codes, ambassadors, and sample redemptions.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-promo.ts
 *
 * Or add to package.json scripts:
 *   "seed:promo": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed-promo.ts"
 */

import { PrismaClient, RedemptionStatus } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding promo codes and ambassadors…\n");

  // ── 1. Promo Codes ────────────────────────────────────────────────────────

  const codes = await Promise.all([
    db.promoCode.upsert({
      where: { code: "FREETRIAL14" },
      create: {
        code: "FREETRIAL14",
        type: "FREE_TRIAL",
        tier: "LAUNCH",
        durationDays: 14,
        maxRedemptions: 100,
        notes: "Seed: 14-day free trial on Launch tier",
      },
      update: {},
    }),
    db.promoCode.upsert({
      where: { code: "SAVE20" },
      create: {
        code: "SAVE20",
        type: "DISCOUNT",
        value: 20,
        durationMonths: 3,
        maxRedemptions: 50,
        notes: "Seed: 20% off for 3 months",
      },
      update: {},
    }),
    db.promoCode.upsert({
      where: { code: "VIPCOMP" },
      create: {
        code: "VIPCOMP",
        type: "COMP",
        tier: "REIGN",
        maxRedemptions: 5,
        notes: "Seed: Complimentary Reign access for VIPs",
      },
      update: {},
    }),
    db.promoCode.upsert({
      where: { code: "CREDIT25" },
      create: {
        code: "CREDIT25",
        type: "CREDIT",
        value: 25,
        maxRedemptions: 20,
        notes: "Seed: $25 account credit",
      },
      update: {},
    }),
    db.promoCode.upsert({
      where: { code: "AIBUNDLE1" },
      create: {
        code: "AIBUNDLE1",
        type: "AI_BUNDLE",
        metadata: { art: 10, master: 5, video: 2, lyric: 1, aar: 2, press: 1 },
        maxRedemptions: 30,
        notes: "Seed: AI credits bundle",
      },
      update: {},
    }),
  ]);

  console.log(`✓ Created/verified ${codes.length} promo codes`);

  // ── 2. Ambassadors ────────────────────────────────────────────────────────

  const sarahAmbassador = await db.ambassador.upsert({
    where: { userId: undefined as unknown as string },
    // Since ambassador doesn't have a unique email constraint, use findFirst + create
    create: {} as never,
    update: {} as never,
  }).catch(() => null);

  // Use findFirst + create pattern for ambassadors (no unique on email in current schema)
  let sarah = await db.ambassador.findFirst({ where: { email: "sarah@example.com" } });
  if (!sarah) {
    sarah = await db.ambassador.create({
      data: {
        name: "Sarah Kim",
        email: "sarah@example.com",
        tier: "PREFERRED",
        rewardType: "FLAT_PER_CONVERSION",
        rewardValue: 10,
        creditBalance: 30,
        totalEarned: 30,
        notes: "Seed: demo ambassador — social media influencer",
      },
    });
    console.log(`✓ Created ambassador: ${sarah.name}`);

    // Auto-create promo code for Sarah
    const sarahCode = await db.promoCode.upsert({
      where: { code: "SARA25" },
      create: {
        code: "SARA25",
        type: "FREE_TRIAL",
        tier: "LAUNCH",
        durationDays: 14,
        maxRedemptions: 1000,
        ambassadorId: sarah.id,
        notes: "Auto-created for Sarah Kim",
      },
      update: {},
    });
    console.log(`  → Linked promo code: ${sarahCode.code}`);
  } else {
    console.log(`↩ Ambassador already exists: ${sarah.name}`);
  }

  let marcus = await db.ambassador.findFirst({ where: { email: "marcus@example.com" } });
  if (!marcus) {
    marcus = await db.ambassador.create({
      data: {
        name: "Marcus Webb",
        email: "marcus@example.com",
        tier: "ELITE",
        rewardType: "PERCENTAGE_FIRST",
        rewardValue: 15,
        creditBalance: 45,
        totalEarned: 45,
        notes: "Seed: demo ambassador — podcast host",
      },
    });
    console.log(`✓ Created ambassador: ${marcus.name}`);

    // Auto-create promo code for Marcus
    const marcusCode = await db.promoCode.upsert({
      where: { code: "MARC25" },
      create: {
        code: "MARC25",
        type: "FREE_TRIAL",
        tier: "PUSH",
        durationDays: 30,
        maxRedemptions: 1000,
        ambassadorId: marcus.id,
        notes: "Auto-created for Marcus Webb",
      },
      update: {},
    });
    console.log(`  → Linked promo code: ${marcusCode.code}`);
  } else {
    console.log(`↩ Ambassador already exists: ${marcus.name}`);
  }

  void sarahAmbassador; // silence unused var

  // ── 3. Redemptions (requires real users) ──────────────────────────────────

  const userCount = await db.user.count({ where: { role: "ARTIST" } });
  if (userCount === 0) {
    console.log("\n⚠ No ARTIST users found — skipping PromoRedemption seeding.");
    console.log("  Run the main seed first, then re-run seed-promo.ts.\n");
    return;
  }

  const users = await db.user.findMany({
    where: { role: "ARTIST" },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true },
  });

  const saraCodeRecord = await db.promoCode.findUnique({ where: { code: "SARA25" } });
  const freeTrialCode = await db.promoCode.findUnique({ where: { code: "FREETRIAL14" } });

  let redemptionCount = 0;

  const statuses: RedemptionStatus[] = [
    "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE",
    "CONVERTED", "CONVERTED", "CONVERTED",
    "EXPIRED", "EXPIRED",
    "REVOKED",
  ];

  for (let i = 0; i < Math.min(users.length, 10); i++) {
    const user = users[i];
    const codeToUse = i < 5 ? saraCodeRecord : freeTrialCode;
    if (!codeToUse) continue;

    const status = statuses[i] ?? "ACTIVE";
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    const existing = await db.promoRedemption.findFirst({
      where: { userId: user.id, promoCodeId: codeToUse.id },
    });
    if (existing) continue;

    try {
      await db.promoRedemption.create({
        data: {
          userId: user.id,
          promoCodeId: codeToUse.id,
          status,
          redeemedAt: daysAgo(30 - i * 2),
          expiresAt: status === "ACTIVE" ? daysAgo(-14 + i) : daysAgo(7 - i),
          convertedAt: status === "CONVERTED" ? daysAgo(20 - i * 2) : null,
          convertedTier: status === "CONVERTED" ? "PUSH" : null,
          upgradedAt: i === 2 && status === "CONVERTED" ? daysAgo(10) : null,
          upgradedToTier: i === 2 && status === "CONVERTED" ? "REIGN" : null,
        },
      });
      redemptionCount++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`✓ Created ${redemptionCount} sample redemptions`);

  console.log("\n✅ Promo seed complete!\n");
  console.log("Codes: FREETRIAL14, SAVE20, VIPCOMP, CREDIT25, AIBUNDLE1");
  console.log("Ambassador codes: SARA25 (Sarah Kim), MARC25 (Marcus Webb)\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
