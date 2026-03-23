/**
 * Split Sheets — Payment Distribution
 *
 * Call distributeSplitPayment() whenever a track earns money.
 * It looks up the ACTIVE split sheet, calculates each contributor's share,
 * fires Stripe transfers for connected accounts, and accumulates a
 * pendingBalance for contributors who haven't connected Stripe yet.
 */

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createNotification } from "@/lib/notifications";

export type SplitSourceType =
  | "MERCH_SALE"
  | "TIP"
  | "STREAM_LEASE"
  | "LICENSE_SALE"
  | "MUSIC_SALE";

/**
 * Distribute a payment across an ACTIVE split sheet for the given track.
 * @param trackId     — the track that earned money
 * @param grossAmount — the amount AFTER platform cut (what gets split)
 * @param sourceType  — where the money came from
 * @param sourceId    — the source transaction ID (for dedup + logging)
 */
export async function distributeSplitPayment({
  trackId,
  grossAmount,
  sourceType,
  sourceId,
}: {
  trackId: string;
  grossAmount: number;
  sourceType: SplitSourceType;
  sourceId: string;
}): Promise<void> {
  if (grossAmount <= 0) return;

  // Load ACTIVE split sheet for this track
  const sheet = await db.splitSheet.findUnique({
    where: { trackId },
    include: {
      splits: true,
      track: { select: { title: true } },
    },
  });

  if (!sheet || sheet.status !== "ACTIVE") return;

  // Dedup: skip if this source transaction was already distributed
  const alreadyPaid = await db.splitPayment.findFirst({
    where: { sourceId, sourceType },
  });
  if (alreadyPaid) return;

  for (const split of sheet.splits) {
    const share = parseFloat(((split.percentage / 100) * grossAmount).toFixed(2));
    if (share <= 0) continue;

    let stripeTransferId: string | null = null;

    // Attempt Stripe transfer if contributor has Connect account
    if (split.stripeConnectId && stripe) {
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(share * 100), // cents
          currency: "usd",
          destination: split.stripeConnectId,
          description: `Split payment: ${sheet.track.title} — ${sourceType}`,
          metadata: { splitId: split.id, sourceId, sourceType },
        });
        stripeTransferId = transfer.id;

        await db.split.update({
          where: { id: split.id },
          data: { totalPaid: { increment: share } },
        });
      } catch (err) {
        console.error(`[split-payments] Stripe transfer failed for split ${split.id}:`, err);
        // Fall through to pending balance
      }
    }

    // No Stripe Connect (or transfer failed) → accumulate pending balance
    if (!stripeTransferId) {
      await db.split.update({
        where: { id: split.id },
        data: { pendingBalance: { increment: share } },
      });
    }

    // Log SplitPayment record
    await db.splitPayment.create({
      data: {
        splitId: split.id,
        amount: share,
        sourceType,
        sourceId,
        stripeTransferId,
      },
    });

    // Notify the contributor
    if (split.userId) {
      await createNotification({
        userId: split.userId,
        type: "SPLIT_PAYMENT_RECEIVED",
        title: `You received $${share.toFixed(2)} from "${sheet.track.title}"`,
        message: stripeTransferId
          ? `$${share.toFixed(2)} transferred to your connected account.`
          : `$${share.toFixed(2)} added to your pending balance. Connect Stripe to receive payouts.`,
        link: "/dashboard/splits",
      }).catch(console.error);
    }
  }
}
