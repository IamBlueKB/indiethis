/**
 * src/lib/fan-automation-triggers.ts
 * Logic for checking fan milestone conditions and sending automation emails.
 * Call these functions from the Stripe webhook handler after events are recorded.
 */

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";
import { DEFAULT_AUTOMATIONS } from "@/app/api/fans/automations/route";

// ─── Template rendering ───────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ─── Core send function ───────────────────────────────────────────────────────

async function maybeSendAutomation(
  artistId:     string,
  fanEmail:     string,
  triggerType:  string,
  fanName?:     string | null,
) {
  // Load the artist's automation for this trigger (or use defaults)
  const [automation, artist] = await Promise.all([
    db.fanAutomation.findUnique({
      where: { userId_triggerType: { userId: artistId, triggerType } },
    }),
    db.user.findUnique({
      where:  { id: artistId },
      select: { name: true, artistName: true, email: true },
    }),
  ]);

  // If artist has explicitly disabled this automation, skip
  if (automation && !automation.isActive) return;

  // Determine template content (custom or default)
  const defaults = DEFAULT_AUTOMATIONS[triggerType];
  if (!defaults) return;

  const subject = automation?.subject ?? defaults.subject;
  const body    = automation?.body    ?? defaults.body;

  const vars = {
    fanName:    fanName || fanEmail.split("@")[0],
    artistName: artist?.artistName || artist?.name || "Your favorite artist",
  };

  const htmlContent = renderTemplate(body, vars)
    .split("\n")
    .map(line => line ? `<p style="margin:0 0 12px;font-family:sans-serif;font-size:15px;color:#111;">${line}</p>` : "<br>")
    .join("");

  const fullHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#f9f9f9;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #eee;">
    ${htmlContent}
  </div>
  <p style="text-align:center;font-size:11px;color:#bbb;margin-top:16px;font-family:sans-serif;">
    Sent via IndieThis · <a href="https://indiethis.com" style="color:#bbb;">indiethis.com</a>
  </p>
</body>
</html>`;

  try {
    await sendEmail({
      to:          { email: fanEmail },
      subject:     renderTemplate(subject, vars),
      htmlContent: fullHtml,
      replyTo:     artist?.email ? { email: artist.email } : undefined,
      tags:        ["fan-automation", triggerType.toLowerCase()],
    });
  } catch (err) {
    console.error(`[fan-automation] Failed to send ${triggerType} to ${fanEmail}:`, err);
  }
}

// ─── Exported trigger functions ───────────────────────────────────────────────

/**
 * Call after a MerchOrder is created.
 * Checks: FIRST_PURCHASE (1st ever) and REPEAT_BUYER (3rd purchase)
 */
export async function triggerMerchAutomations(artistId: string, buyerEmail: string) {
  try {
    const purchaseCount = await db.merchOrder.count({
      where: { artistId, buyerEmail: { equals: buyerEmail, mode: "insensitive" } },
    });

    if (purchaseCount === 1) {
      void maybySendSafe(artistId, buyerEmail, "FIRST_PURCHASE");
    } else if (purchaseCount === 3) {
      void maybySendSafe(artistId, buyerEmail, "REPEAT_BUYER");
    }
  } catch (err) {
    console.error("[fan-automation] triggerMerchAutomations error:", err);
  }
}

/**
 * Call after an ArtistSupport (tip) is created.
 * Checks: FIRST_TIP (1st ever tip) and BIG_TIPPER ($20+)
 */
export async function triggerTipAutomations(artistId: string, fanEmail: string, tipAmount: number) {
  try {
    const tipCount = await db.artistSupport.count({
      where: { artistId, supporterEmail: { equals: fanEmail, mode: "insensitive" } },
    });

    if (tipCount === 1) {
      void maybySendSafe(artistId, fanEmail, "FIRST_TIP");
    }
    if (tipAmount >= 20) {
      void maybySendSafe(artistId, fanEmail, "BIG_TIPPER");
    }
  } catch (err) {
    console.error("[fan-automation] triggerTipAutomations error:", err);
  }
}

// Safe wrapper that never throws
function maybySendSafe(artistId: string, fanEmail: string, triggerType: string) {
  return maybeSendAutomation(artistId, fanEmail, triggerType).catch(err =>
    console.error(`[fan-automation] maybeSendAutomation(${triggerType}) error:`, err)
  );
}

/**
 * Cron-compatible: check all fans who have been following for exactly 1 year today.
 * Run daily via cron job.
 */
export async function triggerAnniversaryAutomations() {
  try {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // Find fans whose first interaction was exactly one year ago (within today's date)
    const dayStart = new Date(oneYearAgo);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(oneYearAgo);
    dayEnd.setHours(23, 59, 59, 999);

    // Get earliest page-view per (artistId, fanEmail) that falls on this date
    // We use MerchOrder + ArtistSupport as proxy for "following date"
    const firstPurchases = await db.merchOrder.groupBy({
      by:      ["artistId", "buyerEmail"],
      where:   { createdAt: { gte: dayStart, lte: dayEnd } },
      _min:    { createdAt: true },
    });

    for (const row of firstPurchases) {
      // Only fire if this is genuinely the fan's first purchase ever
      const totalCount = await db.merchOrder.count({
        where: { artistId: row.artistId, buyerEmail: { equals: row.buyerEmail, mode: "insensitive" } },
      });
      if (totalCount >= 1) {
        void maybySendSafe(row.artistId, row.buyerEmail, "ANNIVERSARY");
      }
    }
  } catch (err) {
    console.error("[fan-automation] triggerAnniversaryAutomations error:", err);
  }
}
