/**
 * src/lib/pricing.ts
 * DB-backed platform pricing utility.
 * Prices are stored in PlatformPricing table and cached for 5 minutes.
 * To update a price: change it in /admin/settings/pricing — no redeploy needed.
 *
 * Usage (server components / route handlers):
 *   const p = await getPricing();
 *   p.AI_COVER_ART.display   // "$4.99"
 *   p.AI_COVER_ART.value     // 4.99
 *   p.PLAN_LAUNCH.value      // 19
 */

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceItem {
  key:      string;
  label:    string;
  value:    number;  // numeric (dollars or percent)
  display:  string;  // formatted e.g. "$4.99" or "15%"
  category: string;
}

export type PricingMap = Record<string, PriceItem>;

// ─── Cached fetch ─────────────────────────────────────────────────────────────

export const getPricing = unstable_cache(
  async (): Promise<PricingMap> => {
    const rows = await db.platformPricing.findMany({ orderBy: { sortOrder: "asc" } });
    return Object.fromEntries(rows.map((r) => [r.key, r]));
  },
  ["platform-pricing"],
  { revalidate: 300 } // 5 minutes
);

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Returns the display string for a key, with fallback */
export async function priceDisplay(key: string, fallback = ""): Promise<string> {
  const p = await getPricing();
  return p[key]?.display ?? fallback;
}

/** Returns the numeric value for a key, with fallback */
export async function priceValue(key: string, fallback = 0): Promise<number> {
  const p = await getPricing();
  return p[key]?.value ?? fallback;
}

/** Returns cents (for Stripe) for a key */
export async function priceCents(key: string, fallback = 0): Promise<number> {
  const p = await getPricing();
  return Math.round((p[key]?.value ?? fallback) * 100);
}

// ─── Static fallback defaults ─────────────────────────────────────────────────
// Used for type-safety and IDE autocomplete; actual values always come from DB.

export const PRICING_DEFAULTS = {
  PLAN_LAUNCH:      { value: 19,    display: "$19/mo"  },
  PLAN_PUSH:        { value: 49,    display: "$49/mo"  },
  PLAN_REIGN:       { value: 99,    display: "$99/mo"  },
  STUDIO_PRO:       { value: 49,    display: "$49/mo"  },
  STUDIO_ELITE:     { value: 99,    display: "$99/mo"  },
  AI_COVER_ART:               { value: 4.99,  display: "$4.99"   },
  AI_COVER_ART_STANDARD:      { value: 4.99,  display: "$4.99"   },
  AI_COVER_ART_PREMIUM:       { value: 7.99,  display: "$7.99"   },
  AI_COVER_ART_PRO:           { value: 12.99, display: "$12.99"  },
  AI_COVER_ART_STANDARD_GUEST:{ value: 6.99,  display: "$6.99"   },
  AI_COVER_ART_PREMIUM_GUEST: { value: 9.99,  display: "$9.99"   },
  AI_COVER_ART_PRO_GUEST:     { value: 14.99, display: "$14.99"  },
  AI_MASTERING:     { value: 7.99,  display: "$7.99"   },
  AI_LYRIC_VIDEO:            { value: 14.99, display: "$14.99"  },
  LYRIC_VIDEO_QUICK_GUEST:   { value: 17.99, display: "$17.99"  },
  LYRIC_VIDEO_QUICK_SUB:     { value: 14.99, display: "$14.99"  },
  LYRIC_VIDEO_DIRECTOR_GUEST:{ value: 29.99, display: "$29.99"  },
  LYRIC_VIDEO_DIRECTOR_SUB:  { value: 24.99, display: "$24.99"  },
  AI_AAR_REPORT:    { value: 14.99, display: "$14.99"  },
  AI_PRESS_KIT:     { value: 9.99,  display: "$9.99"   },
  AI_VIDEO_SHORT:   { value: 19,    display: "$19"     },
  AI_VIDEO_MEDIUM:  { value: 29,    display: "$29"     },
  AI_VIDEO_LONG:    { value: 49,    display: "$49"     },
  LYRIC_VIDEO_AI_BG:     { value: 5.00,  display: "$5.00"   },
  AI_VOCAL_REMOVER:      { value: 1.99,  display: "$1.99"   },
  AI_CONTRACT_SCANNER:   { value: 4.99,  display: "$4.99"   },
  AI_BIO_GENERATOR:      { value: 0,     display: "Free"    },
  AI_SPLIT_SHEET:        { value: 0,     display: "Free"    },
  TRACK_SHIELD_SINGLE:   { value: 2.99,  display: "$2.99"   },
  TRACK_SHIELD_5:        { value: 9.99,  display: "$9.99"   },
  TRACK_SHIELD_10:       { value: 14.99, display: "$14.99"  },
  TRACK_SHIELD_CATALOG:  { value: 29.99, display: "$29.99"  },
  CUT_MUSIC_SALES:       { value: 10,    display: "10%"     },
  CUT_MERCH_PUSH:        { value: 15,    display: "15%"     },
  CUT_MERCH_REIGN:       { value: 10,    display: "10%"     },
  // SMS broadcast limits per tier (monthly)
  SMS_LIMIT_LAUNCH:       { value: 100,  display: "100/mo"  },
  SMS_LIMIT_PUSH:         { value: 500,  display: "500/mo"  },
  SMS_LIMIT_REIGN:        { value: 2000, display: "2000/mo" },
  SMS_LIMIT_STUDIO_PRO:   { value: 500,  display: "500/mo"  },
  SMS_LIMIT_STUDIO_ELITE: { value: 2000, display: "2000/mo" },
  // DJ crate limits per tier
  DJ_CRATE_LIMIT_LAUNCH:  { value: 5,    display: "5 crates"  },
  DJ_CRATE_LIMIT_PUSH:    { value: 15,   display: "15 crates" },
  DJ_CRATE_LIMIT_REIGN:   { value: 0,    display: "Unlimited" },
  // Release bundle (cover art + canvas + lyric video) — saves $2.99 vs individual
  AI_RELEASE_BUNDLE:      { value: 18.99, display: "$18.99"   },
  // Trend Forecaster & Producer-Artist Match PPU reports
  TREND_REPORT:           { value: 4.99,  display: "$4.99"    },
  PRODUCER_ARTIST_MATCH:  { value: 9.99,  display: "$9.99"    },
  CANVAS_GENERATE:        { value: 1.99,  display: "$1.99"    },
  BOOKING_REPORT:         { value: 14.99, display: "$14.99"   },
} as const;

export type PricingKey = keyof typeof PRICING_DEFAULTS;

/** Returns the monthly SMS broadcast limit for a subscription tier, from a live PricingMap */
export function getSmsLimit(tier: string, pricing: PricingMap): number {
  const key = `SMS_LIMIT_${tier}`;
  return (
    pricing[key]?.value ??
    (PRICING_DEFAULTS as Record<string, { value: number }>)[key]?.value ??
    100
  );
}

/** Returns the DJ crate limit for a subscription tier (0 = unlimited), from a live PricingMap */
export function getCrateLimit(tier: string, pricing: PricingMap): number {
  const key = `DJ_CRATE_LIMIT_${tier}`;
  return (
    pricing[key]?.value ??
    (PRICING_DEFAULTS as Record<string, { value: number }>)[key]?.value ??
    5
  );
}
