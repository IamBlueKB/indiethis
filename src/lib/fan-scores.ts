/**
 * fan-scores.ts
 *
 * Utility for computing and caching fan spend rankings.
 *
 * A FanScore row represents the total money a specific email address has
 * spent with a specific artist across all purchase types:
 *   - Merch orders  (MerchOrder.totalPrice)
 *   - PWYW tips     (ArtistSupport.amount)
 *
 * Two modes of update:
 *  1. delta upsert  — called from the Stripe webhook on every new purchase
 *  2. full rebuild  — called from the refresh API endpoint; recomputes from
 *                     scratch by aggregating all historical records
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FanScoreDelta = {
  merch?: number; // dollars added from a merch purchase
  tip?:   number; // dollars added from a PWYW tip
};

// ─── Delta upsert ─────────────────────────────────────────────────────────────
/**
 * Incrementally update a fan's score when a new purchase arrives.
 * Creates the row if it doesn't exist yet.
 */
export async function upsertFanScore(
  artistId: string,
  email:    string,
  delta:    FanScoreDelta,
): Promise<void> {
  const merchAmt = delta.merch ?? 0;
  const tipAmt   = delta.tip   ?? 0;
  const total    = merchAmt + tipAmt;
  if (total <= 0) return;

  const now = new Date();

  await db.fanScore.upsert({
    where:  { artistId_email: { artistId, email } },
    create: {
      artistId,
      email,
      totalSpend:  total,
      merchSpend:  merchAmt,
      tipSpend:    tipAmt,
      orderCount:  merchAmt > 0 ? 1 : 0,
      tipCount:    tipAmt   > 0 ? 1 : 0,
      lastSpentAt: now,
    },
    update: {
      totalSpend:  { increment: total },
      merchSpend:  { increment: merchAmt },
      tipSpend:    { increment: tipAmt },
      orderCount:  { increment: merchAmt > 0 ? 1 : 0 },
      tipCount:    { increment: tipAmt   > 0 ? 1 : 0 },
      lastSpentAt: now,
    },
  });
}

// ─── Full rebuild ─────────────────────────────────────────────────────────────
/**
 * Recompute all FanScore rows for an artist from scratch.
 * Aggregates MerchOrder + ArtistSupport, then bulk-replaces all rows.
 *
 * Use this for initial backfill or to repair drift from missed webhooks.
 */
export async function recomputeAllFanScores(artistId: string): Promise<number> {
  // Fetch all merch orders and tips for this artist in parallel
  const [orders, tips] = await Promise.all([
    db.merchOrder.findMany({
      where:  { artistId },
      select: { buyerEmail: true, totalPrice: true, createdAt: true },
    }),
    db.artistSupport.findMany({
      where:  { artistId },
      select: { supporterEmail: true, amount: true, createdAt: true },
    }),
  ]);

  // Build a map keyed by normalised lowercase email
  type Accumulator = {
    totalSpend:  number;
    merchSpend:  number;
    tipSpend:    number;
    orderCount:  number;
    tipCount:    number;
    lastSpentAt: Date;
  };

  const map = new Map<string, Accumulator>();

  function ensureEntry(email: string): Accumulator {
    const key = email.toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, {
        totalSpend: 0, merchSpend: 0, tipSpend: 0,
        orderCount: 0, tipCount: 0,
        lastSpentAt: new Date(0),
      });
    }
    return map.get(key)!;
  }

  for (const o of orders) {
    if (!o.buyerEmail) continue;
    const e = ensureEntry(o.buyerEmail);
    e.totalSpend  += o.totalPrice;
    e.merchSpend  += o.totalPrice;
    e.orderCount  += 1;
    if (o.createdAt > e.lastSpentAt) e.lastSpentAt = o.createdAt;
  }

  for (const t of tips) {
    if (!t.supporterEmail) continue;
    const e = ensureEntry(t.supporterEmail);
    e.totalSpend += t.amount;
    e.tipSpend   += t.amount;
    e.tipCount   += 1;
    if (t.createdAt > e.lastSpentAt) e.lastSpentAt = t.createdAt;
  }

  if (map.size === 0) {
    // Nothing to store; delete any stale rows and return
    await db.fanScore.deleteMany({ where: { artistId } });
    return 0;
  }

  // Replace all rows in a transaction
  await db.$transaction([
    db.fanScore.deleteMany({ where: { artistId } }),
    db.fanScore.createMany({
      data: Array.from(map.entries()).map(([email, acc]) => ({
        artistId,
        email,
        ...acc,
      })),
      skipDuplicates: true,
    }),
  ]);

  return map.size;
}
