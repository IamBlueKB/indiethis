/**
 * seed-pricing.ts
 * Seeds the PlatformPricing table with all initial platform prices.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-pricing.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PRICING_SEED = [
  // ─── Artist Subscription Plans ────────────────────────────────────────────
  { key: "PLAN_LAUNCH",       label: "Launch Plan",           value: 19,    display: "$19/mo",   category: "subscriptions",   sortOrder: 1 },
  { key: "PLAN_PUSH",         label: "Push Plan",             value: 49,    display: "$49/mo",   category: "subscriptions",   sortOrder: 2 },
  { key: "PLAN_REIGN",        label: "Reign Plan",            value: 149,   display: "$149/mo",  category: "subscriptions",   sortOrder: 3 },

  // ─── Studio Subscription Plans ────────────────────────────────────────────
  { key: "STUDIO_PRO",        label: "Studio Pro",            value: 49,    display: "$49/mo",   category: "subscriptions",   sortOrder: 4 },
  { key: "STUDIO_ELITE",      label: "Studio Elite",          value: 99,    display: "$99/mo",   category: "subscriptions",   sortOrder: 5 },

  // ─── AI Tools Pay-Per-Use ─────────────────────────────────────────────────
  { key: "AI_COVER_ART",      label: "AI Cover Art",          value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 10 },
  { key: "AI_MASTERING",      label: "AI Mastering",          value: 9.99,  display: "$9.99",    category: "ai_tools",        sortOrder: 11 },
  { key: "AI_LYRIC_VIDEO",    label: "Lyric Video",           value: 24.99, display: "$24.99",   category: "ai_tools",        sortOrder: 12 },
  { key: "AI_AAR_REPORT",     label: "AI A&R Report",         value: 14.99, display: "$14.99",   category: "ai_tools",        sortOrder: 13 },
  { key: "AI_PRESS_KIT",      label: "Press Kit",             value: 19.99, display: "$19.99",   category: "ai_tools",        sortOrder: 14 },
  { key: "AI_VIDEO_SHORT",    label: "AI Music Video (30s)",  value: 19,    display: "$19",      category: "ai_tools",        sortOrder: 15 },
  { key: "AI_VIDEO_MEDIUM",   label: "AI Music Video (1min)", value: 29,    display: "$29",      category: "ai_tools",        sortOrder: 16 },
  { key: "AI_VIDEO_LONG",     label: "AI Music Video (3min)", value: 49,    display: "$49",      category: "ai_tools",        sortOrder: 17 },

  // ─── Platform Revenue Cuts ────────────────────────────────────────────────
  { key: "CUT_MUSIC_SALES",   label: "Music Sales Cut",       value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 20 },
  { key: "CUT_MERCH_PUSH",    label: "Merch Cut (Push)",      value: 15,    display: "15%",      category: "platform_cuts",   sortOrder: 21 },
  { key: "CUT_MERCH_REIGN",   label: "Merch Cut (Reign)",     value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 22 },
];

async function main() {
  console.log("🌱 Seeding platform pricing...\n");

  for (const item of PRICING_SEED) {
    await db.platformPricing.upsert({
      where: { key: item.key },
      update: { label: item.label, value: item.value, display: item.display, category: item.category, sortOrder: item.sortOrder },
      create: item,
    });
    console.log(`  ✓ ${item.key.padEnd(22)} ${item.display}`);
  }

  console.log(`\n✅ Platform pricing seeded — ${PRICING_SEED.length} items`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
