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
  { key: "PLAN_REIGN",        label: "Reign Plan",            value: 99,    display: "$99/mo",   category: "subscriptions",   sortOrder: 3 },

  // ─── Studio Subscription Plans ────────────────────────────────────────────
  { key: "STUDIO_PRO",        label: "Studio Pro",            value: 49,    display: "$49/mo",   category: "subscriptions",   sortOrder: 4 },
  { key: "STUDIO_ELITE",      label: "Studio Elite",          value: 99,    display: "$99/mo",   category: "subscriptions",   sortOrder: 5 },

  // ─── AI Tools Pay-Per-Use ─────────────────────────────────────────────────
  { key: "AI_COVER_ART",          label: "AI Cover Art",              value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 10 },
  { key: "AI_COVER_ART_STANDARD", label: "AI Cover Art (Standard)",  value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 10 },
  { key: "AI_COVER_ART_PREMIUM",  label: "AI Cover Art (Premium)",   value: 7.99,  display: "$7.99",    category: "ai_tools",        sortOrder: 11 },
  { key: "AI_MASTERING",          label: "AI Mastering",              value: 7.99,  display: "$7.99",    category: "ai_tools",        sortOrder: 12 },
  { key: "AI_LYRIC_VIDEO",        label: "Lyric Video",               value: 14.99, display: "$14.99",   category: "ai_tools",        sortOrder: 13 },
  { key: "AI_AAR_REPORT",         label: "AI A&R Report",             value: 14.99, display: "$14.99",   category: "ai_tools",        sortOrder: 14 },
  { key: "AI_PRESS_KIT",          label: "Press Kit",                 value: 9.99,  display: "$9.99",    category: "ai_tools",        sortOrder: 15 },
  { key: "AI_VIDEO_SHORT",        label: "AI Music Video (30s)",      value: 19,    display: "$19",      category: "ai_tools",        sortOrder: 16 },
  { key: "AI_VIDEO_MEDIUM",       label: "AI Music Video (1min)",     value: 29,    display: "$29",      category: "ai_tools",        sortOrder: 17 },
  { key: "AI_VIDEO_LONG",         label: "AI Music Video (3min)",     value: 49,    display: "$49",      category: "ai_tools",        sortOrder: 18 },
  { key: "AI_VOCAL_REMOVER",      label: "Vocal Remover",             value: 1.99,  display: "$1.99",    category: "ai_tools",        sortOrder: 19 },
  { key: "AI_CONTRACT_SCANNER",      label: "Contract Scanner",               value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 20 },
  { key: "AI_BIO_GENERATOR",         label: "Bio Generator",                  value: 0,     display: "Free",     category: "ai_tools",        sortOrder: 21 },
  { key: "AI_SPLIT_SHEET",           label: "Split Sheet",                    value: 0,     display: "Free",     category: "ai_tools",        sortOrder: 22 },
  { key: "LYRIC_VIDEO_AI_BG",        label: "Lyric Video AI Background",      value: 5.00,  display: "$5.00",    category: "ai_tools",        sortOrder: 23 },
  { key: "TRACK_SHIELD_SINGLE",      label: "Track Shield (Single)",          value: 2.99,  display: "$2.99",    category: "ai_tools",        sortOrder: 24 },
  { key: "TRACK_SHIELD_5",           label: "Track Shield (5-Pack)",          value: 9.99,  display: "$9.99",    category: "ai_tools",        sortOrder: 25 },
  { key: "TRACK_SHIELD_10",          label: "Track Shield (10-Pack)",         value: 14.99, display: "$14.99",   category: "ai_tools",        sortOrder: 26 },
  { key: "TRACK_SHIELD_CATALOG",     label: "Track Shield (Full Catalog)",    value: 29.99, display: "$29.99",   category: "ai_tools",        sortOrder: 27 },
  { key: "CANVAS_GENERATE",          label: "Canvas Video (AI Generate)",     value: 1.99,  display: "$1.99",    category: "ai_tools",        sortOrder: 28 },
  { key: "AI_RELEASE_BUNDLE",        label: "Release Bundle (Cover+Canvas+Lyric)", value: 18.99, display: "$18.99",  category: "ai_tools",        sortOrder: 29 },
  { key: "TREND_REPORT",             label: "Trend Forecaster Report",        value: 4.99,  display: "$4.99",    category: "ai_tools",        sortOrder: 30 },
  { key: "PRODUCER_ARTIST_MATCH",    label: "Producer/Artist Match Report",   value: 9.99,  display: "$9.99",    category: "ai_tools",        sortOrder: 31 },

  // ─── Platform Revenue Cuts ────────────────────────────────────────────────
  { key: "CUT_MUSIC_SALES",   label: "Music Sales Cut",       value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 20 },
  { key: "CUT_MERCH_PUSH",    label: "Merch Cut (Push)",      value: 15,    display: "15%",      category: "platform_cuts",   sortOrder: 21 },
  { key: "CUT_MERCH_REIGN",   label: "Merch Cut (Reign)",     value: 10,    display: "10%",      category: "platform_cuts",   sortOrder: 22 },

  // ─── Stream Lease Pricing ─────────────────────────────────────────────────
  { key: "STREAM_LEASE_MONTHLY",        label: "Stream Lease Monthly Fee",    value: 1.00, display: "$1/mo", category: "stream_leases", sortOrder: 30 },
  { key: "STREAM_LEASE_PRODUCER_SHARE", label: "Stream Lease Producer Share", value: 0.70, display: "70%",   category: "stream_leases", sortOrder: 31 },
  { key: "STREAM_LEASE_PLATFORM_SHARE", label: "Stream Lease Platform Share", value: 0.30, display: "30%",   category: "stream_leases", sortOrder: 32 },

  // ─── DJ Crate Limits (per tier) ──────────────────────────────────────────
  { key: "DJ_CRATE_LIMIT_LAUNCH", label: "DJ Crate Limit (Launch)", value: 5,  display: "5 crates",   category: "dj_limits", sortOrder: 50 },
  { key: "DJ_CRATE_LIMIT_PUSH",   label: "DJ Crate Limit (Push)",   value: 15, display: "15 crates",  category: "dj_limits", sortOrder: 51 },
  { key: "DJ_CRATE_LIMIT_REIGN",  label: "DJ Crate Limit (Reign)",  value: 0,  display: "Unlimited",  category: "dj_limits", sortOrder: 52 },

  // ─── SMS Broadcast Limits (per tier, per month) ───────────────────────────
  { key: "SMS_LIMIT_LAUNCH",       label: "SMS Limit (Launch)",       value: 100,  display: "100/mo",  category: "sms_limits", sortOrder: 40 },
  { key: "SMS_LIMIT_PUSH",         label: "SMS Limit (Push)",         value: 500,  display: "500/mo",  category: "sms_limits", sortOrder: 41 },
  { key: "SMS_LIMIT_REIGN",        label: "SMS Limit (Reign)",        value: 2000, display: "2000/mo", category: "sms_limits", sortOrder: 42 },
  { key: "SMS_LIMIT_STUDIO_PRO",   label: "SMS Limit (Studio Pro)",   value: 500,  display: "500/mo",  category: "sms_limits", sortOrder: 43 },
  { key: "SMS_LIMIT_STUDIO_ELITE", label: "SMS Limit (Studio Elite)", value: 2000, display: "2000/mo", category: "sms_limits", sortOrder: 44 },
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
