/**
 * broadcast-sms.ts
 *
 * Artist SMS broadcast utilities.
 *
 * Segment keys:
 *   ALL              – all FanContacts with a phone number
 *   RELEASE_NOTIFY   – fans who signed up for release alerts (phone required)
 *   SHOW_NOTIFY      – fans who signed up for show alerts (phone required)
 *   TOP_SPENDERS     – FanScore totalSpend > 0, phone looked up via FanContact email match
 *   MERCH_BUYERS     – FanScore orderCount > 0, phone looked up via FanContact email match
 *   ZIP:[code]       – FanContacts where zip = code AND phone not null
 *
 * Phone normalisation: stored numbers can be bare 10-digit strings, so we
 * do best-effort → E.164 before sending.
 */

import { db } from "@/lib/db";
import { sendSMS } from "./sms";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Approximate Brevo transactional SMS cost (USD per segment per recipient) */
export const SMS_COST_PER_SEGMENT = 0.009;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a stored phone to E.164 (best-effort for US numbers).
 * Returns null if the number is unusable.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 7)   return `+${digits}`; // non-US best effort
  return null;
}

/** How many months' SMS have been sent so far this calendar month */
export async function getSmsUsedThisMonth(artistId: string): Promise<number> {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await db.broadcastLog.aggregate({
    where:  { artistId, sentAt: { gte: start } },
    _sum:   { recipientCount: true },
  });

  return agg._sum.recipientCount ?? 0;
}

// ─── Segment resolution ───────────────────────────────────────────────────────

/**
 * Resolve a segment key to a deduplicated list of E.164 phone numbers.
 * Capped at 500 per broadcast (hard safety limit).
 */
export async function resolveBroadcastRecipients(
  artistId: string,
  segment:  string,
): Promise<string[]> {
  const HARD_CAP = 500;

  // Parse segment string — "ZIP:90210" → type + optional zip
  const [segType, segValue] = segment.split(":");

  let rawPhones: (string | null)[] = [];

  if (segType === "ALL") {
    const contacts = await db.fanContact.findMany({
      where:   { artistId, phone: { not: null } },
      select:  { phone: true },
      take:    HARD_CAP,
    });
    rawPhones = contacts.map((c) => c.phone);

  } else if (segType === "RELEASE_NOTIFY" || segType === "SHOW_NOTIFY") {
    const contacts = await db.fanContact.findMany({
      where: {
        artistId,
        source: segType as "RELEASE_NOTIFY" | "SHOW_NOTIFY",
        phone:  { not: null },
      },
      select: { phone: true },
      take:   HARD_CAP,
    });
    rawPhones = contacts.map((c) => c.phone);

  } else if (segType === "TOP_SPENDERS" || segType === "MERCH_BUYERS") {
    // Get qualifying emails from FanScore, then look up phones via FanContact
    const where =
      segType === "TOP_SPENDERS"
        ? { artistId, totalSpend: { gt: 0 } }
        : { artistId, orderCount: { gt: 0 } };

    const scores = await db.fanScore.findMany({
      where,
      orderBy: { totalSpend: "desc" },
      select:  { email: true },
      take:    HARD_CAP,
    });

    const emails = scores.map((s) => s.email);
    if (emails.length === 0) return [];

    // Match emails case-insensitively across FanContact to find phones
    const contacts = await db.fanContact.findMany({
      where: {
        artistId,
        phone: { not: null },
        email: { in: emails },
      },
      select:   { phone: true, email: true },
      distinct: ["email"],
      take:     HARD_CAP,
    });
    rawPhones = contacts.map((c) => c.phone);

  } else if (segType === "ZIP" && segValue) {
    const contacts = await db.fanContact.findMany({
      where: {
        artistId,
        zip:   segValue.trim(),
        phone: { not: null },
      },
      select: { phone: true },
      take:   HARD_CAP,
    });
    rawPhones = contacts.map((c) => c.phone);
  }

  // Normalise and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawPhones) {
    const e164 = normalizePhone(raw);
    if (e164 && !seen.has(e164)) {
      seen.add(e164);
      result.push(e164);
    }
  }
  return result;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export interface BroadcastResult {
  recipientCount: number;
  successCount:   number;
  logId:          string;
}

/**
 * Send an SMS broadcast to all phones in the resolved segment.
 * Sends in concurrent batches of 10, records a BroadcastLog row.
 */
export async function sendBroadcast(
  artistId: string,
  message:  string,
  segment:  string,
  phones:   string[],
): Promise<BroadcastResult> {
  const senderName = process.env.BREVO_SMS_SENDER ?? "IndieThis";
  let successCount = 0;

  // Batch sends: 10 concurrent at a time
  const BATCH = 10;
  for (let i = 0; i < phones.length; i += BATCH) {
    const batch = phones.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((phone) =>
        sendSMS({
          to:      phone,
          content: message,
          tag:     `broadcast-${artistId.slice(0, 8)}`,
        }),
      ),
    );
    successCount += results.filter((r) => r.status === "fulfilled").length;
  }

  // Log the broadcast
  const log = await db.broadcastLog.create({
    data: {
      artistId,
      message,
      segment,
      recipientCount: phones.length,
      successCount,
    },
  });

  return { recipientCount: phones.length, successCount, logId: log.id };
}
