/**
 * restore-clearear.mjs
 * Full restore of Clear Ear Studios after database wipe.
 * Run: node scripts/restore-clearear.mjs
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🔧 Restoring Clear Ear Studios...\n");

  // ─── 1. Platform Pricing ──────────────────────────────────────────────────
  console.log("1. Seeding platform pricing...");
  const PRICING = [
    { key: "PLAN_LAUNCH",                   label: "Launch Plan",                   value: 19,    display: "$19/mo",   category: "subscriptions",   sortOrder: 1 },
    { key: "PLAN_PUSH",                     label: "Push Plan",                     value: 49,    display: "$49/mo",   category: "subscriptions",   sortOrder: 2 },
    { key: "PLAN_REIGN",                    label: "Reign Plan",                    value: 149,   display: "$149/mo",  category: "subscriptions",   sortOrder: 3 },
    { key: "STUDIO_PRO",                    label: "Studio Pro",                    value: 49,    display: "$49/mo",   category: "subscriptions",   sortOrder: 4 },
    { key: "STUDIO_ELITE",                  label: "Studio Elite",                  value: 99,    display: "$99/mo",   category: "subscriptions",   sortOrder: 5 },
    { key: "AI_COVER_ART",                  label: "AI Cover Art",                  value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 10 },
    { key: "AI_MASTERING",                  label: "AI Mastering",                  value: 9.99,  display: "$9.99",    category: "ai_tools",        sortOrder: 11 },
    { key: "AI_LYRIC_VIDEO",                label: "Lyric Video",                   value: 24.99, display: "$24.99",   category: "ai_tools",        sortOrder: 12 },
    { key: "AI_AAR_REPORT",                 label: "AI A&R Report",                 value: 14.99, display: "$14.99",   category: "ai_tools",        sortOrder: 13 },
    { key: "AI_PRESS_KIT",                  label: "Press Kit",                     value: 19.99, display: "$19.99",   category: "ai_tools",        sortOrder: 14 },
    { key: "AI_VIDEO_SHORT",                label: "AI Music Video (30s)",           value: 19,    display: "$19",      category: "ai_tools",        sortOrder: 15 },
    { key: "AI_VIDEO_MEDIUM",               label: "AI Music Video (1min)",          value: 29,    display: "$29",      category: "ai_tools",        sortOrder: 16 },
    { key: "AI_VIDEO_LONG",                 label: "AI Music Video (3min)",          value: 49,    display: "$49",      category: "ai_tools",        sortOrder: 17 },
    { key: "AI_VOCAL_REMOVER",              label: "Vocal Remover / Stem Separator", value: 1.99,  display: "$1.99",    category: "ai_tools",        sortOrder: 18 },
    { key: "CUT_MUSIC_SALES",               label: "Music Sales Cut",               value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 20 },
    { key: "CUT_MERCH_PUSH",                label: "Merch Cut (Push)",              value: 15,    display: "15%",      category: "platform_cuts",   sortOrder: 21 },
    { key: "CUT_MERCH_REIGN",               label: "Merch Cut (Reign)",             value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 22 },
    { key: "STREAM_LEASE_MONTHLY",          label: "Stream Lease Monthly Fee",      value: 1.00,  display: "$1/mo",    category: "stream_leases",   sortOrder: 30 },
    { key: "STREAM_LEASE_PRODUCER_SHARE",   label: "Stream Lease Producer Share",   value: 0.70,  display: "70%",      category: "stream_leases",   sortOrder: 31 },
    { key: "STREAM_LEASE_PLATFORM_SHARE",   label: "Stream Lease Platform Share",   value: 0.30,  display: "30%",      category: "stream_leases",   sortOrder: 32 },
  ];
  for (const item of PRICING) {
    await db.platformPricing.upsert({
      where: { key: item.key },
      update: { label: item.label, value: item.value, display: item.display, category: item.category, sortOrder: item.sortOrder },
      create: item,
    });
  }
  console.log(`   ✓ ${PRICING.length} pricing rows restored\n`);

  // ─── 2. User Account ──────────────────────────────────────────────────────
  console.log("2. Creating studio owner account...");
  const passwordHash = await bcrypt.hash("ClearEar2026!", 10);
  const user = await db.user.upsert({
    where: { email: "clearearstudios@gmail.com" },
    update: {},
    create: {
      email:        "clearearstudios@gmail.com",
      passwordHash,
      name:         "Clear Ear Studios",
      role:         "STUDIO_ADMIN",
    },
  });
  console.log(`   ✓ User: clearearstudios@gmail.com  (id: ${user.id})\n`);

  // ─── 3. Studio ────────────────────────────────────────────────────────────
  console.log("3. Creating studio...");
  const studio = await db.studio.upsert({
    where: { slug: "clearearstudios" },
    update: {},
    create: {
      ownerId:  user.id,
      name:     "Clear Ear Studios",
      slug:     "clearearstudios",
      studioTier: "ELITE",
      template:   "CUSTOM",
      isPublished: true,
      onboardingCompleted: true,
      email:    "clearearstudios@gmail.com",
      tagline:  "Premium Recording, Mixing & Mastering",
      bio:      "Clear Ear Studios is where serious sound gets made. Music production, recording, mixing, mastering, podcasts, voiceovers — whatever the project, we bring premium equipment, acoustically engineered rooms, and a team that delivers every time.",
      logoUrl:       "/images/studio/logo.png",
      heroImage:     "/images/studio/hero.jpg",
      galleryImages: [
        "/images/studio/gallery-1.jpg",
        "/images/studio/gallery-5.jpg",
        "/images/studio/gallery-3.jpg",
        "/images/studio/gallery-4.jpg",
        "/images/studio/gallery-7.jpg",
      ],
      streetAddress: "7411 S Stony Island Ave",
      city:          "Chicago",
      state:         "IL",
      zipCode:       "60649",
      instagram:     "clearearstudios",
      tiktok:        "clearearstudios",
      studioHours: {
        monday:    { open: true, openTime: "10:00", closeTime: "21:00" },
        tuesday:   { open: true, openTime: "10:00", closeTime: "21:00" },
        wednesday: { open: true, openTime: "10:00", closeTime: "21:00" },
        thursday:  { open: true, openTime: "10:00", closeTime: "21:00" },
        friday:    { open: true, openTime: "10:00", closeTime: "21:00" },
        saturday:  { open: true, openTime: "11:00", closeTime: "20:00" },
        sunday:    { open: true, openTime: "11:00", closeTime: "20:00" },
      },
      hoursNote:      "24-hour sessions available by appointment",
      paymentMethods: ["cashapp", "zelle", "paypal", "venmo"],
      featuredArtists: [],
      averageSessionRate: 150,
    },
  });
  console.log(`   ✓ Studio: Clear Ear Studios  (id: ${studio.id})\n`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  console.log("✅ Restore complete!\n");
  console.log("  Login URL:  http://localhost:3456/studio");
  console.log("  Email:      clearearstudios@gmail.com");
  console.log("  Password:   ClearEar2026!");
  console.log("  Studio URL: http://localhost:3456/clearearstudios");
  console.log("─".repeat(50));
}

main()
  .catch((e) => { console.error("❌ Restore failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
