/**
 * stream-lease-pricing.ts
 *
 * Fetches stream lease pricing from PlatformPricing table so $1/mo and 70/30
 * splits are configurable by admins without code changes.
 * Falls back to hardcoded defaults if rows are missing (safe for cold starts).
 */

import { db } from "@/lib/db";

export interface StreamLeasePricing {
  monthlyPriceDollars: number;  // e.g. 1.00
  monthlyPriceCents:   number;  // e.g. 100  — use for Stripe amount field
  producerShare:       number;  // e.g. 0.70
  platformShare:       number;  // e.g. 0.30
}

const DEFAULTS: StreamLeasePricing = {
  monthlyPriceDollars: 1.00,
  monthlyPriceCents:   100,
  producerShare:       0.70,
  platformShare:       0.30,
};

const KEYS = [
  "STREAM_LEASE_MONTHLY",
  "STREAM_LEASE_PRODUCER_SHARE",
  "STREAM_LEASE_PLATFORM_SHARE",
] as const;

export async function getStreamLeasePricing(): Promise<StreamLeasePricing> {
  try {
    const entries = await db.platformPricing.findMany({
      where: { key: { in: [...KEYS] } },
      select: { key: true, value: true },
    });

    const byKey = Object.fromEntries(entries.map((e) => [e.key, e.value]));

    const monthly  = (byKey["STREAM_LEASE_MONTHLY"]        as number | undefined) ?? DEFAULTS.monthlyPriceDollars;
    const producer = (byKey["STREAM_LEASE_PRODUCER_SHARE"] as number | undefined) ?? DEFAULTS.producerShare;
    const platform = (byKey["STREAM_LEASE_PLATFORM_SHARE"] as number | undefined) ?? DEFAULTS.platformShare;

    return {
      monthlyPriceDollars: monthly,
      monthlyPriceCents:   Math.round(monthly * 100),
      producerShare:       producer,
      platformShare:       platform,
    };
  } catch {
    // Fallback — never crash billing code due to a pricing DB miss
    return DEFAULTS;
  }
}
