/**
 * email-sender.ts
 *
 * Processes pending ScheduledEmail records where scheduledFor <= now()
 * and sends each one via Brevo transactional email.
 *
 * Called from the cron API route (Step 8). Designed to be safe to call
 * repeatedly — each job is updated to SENT/FAILED/CANCELLED before moving
 * to the next, so a mid-batch crash leaves remaining records PENDING for
 * the next cron run.
 */

import { db } from "@/lib/db";
import { getBrevoClient } from "@/lib/brevo/client";

// ─── Platform pricing (substituted into templates) ────────────────────────────

const PLATFORM_PRICES = {
  masteringPrice: "$14.99",
  coverArtPrice:  "$9.99",
  arReportPrice:  "$19.99",
};

// ─── Env helpers ──────────────────────────────────────────────────────────────

const FROM_EMAIL = () => process.env.BREVO_FROM_EMAIL ?? "hello@indiethis.com";
const APP_URL    = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Step → template key mapping ─────────────────────────────────────────────

const STEP_KEY: Record<string, "day1" | "day3" | "day7" | "day14"> = {
  DAY_1:  "day1",
  DAY_3:  "day3",
  DAY_7:  "day7",
  DAY_14: "day14",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailTemplateStep = {
  enabled: boolean;
  subject: string;
  body:    string;
};

type EmailTemplates = Partial<Record<"day1" | "day3" | "day7" | "day14", EmailTemplateStep>>;

// ─── Text helpers ─────────────────────────────────────────────────────────────

/**
 * Replace all {variable} tokens in a string with values from the vars map.
 */
function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [key, val]) => t.replace(new RegExp(`\\{${key}\\}`, "g"), val),
    text
  );
}

/**
 * Convert plain-text email body to minimal HTML.
 * - Double newlines → paragraph breaks
 * - Single newlines → <br>
 * - URLs → clickable gold links
 */
function toHtml(plain: string, studioName: string): string {
  const paragraphs = plain
    .split(/\n{2,}/)
    .map((para) => {
      const withBreaks = para.replace(/\n/g, "<br/>");
      const withLinks  = withBreaks.replace(
        /https?:\/\/[^\s<]+/g,
        (url) => `<a href="${url}" style="color:#D4A843;text-decoration:none">${url}</a>`
      );
      return `<p style="margin:0 0 16px 0;line-height:1.6">${withLinks}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
             max-width:600px;margin:0 auto;padding:32px 24px;color:#111111;background:#ffffff">

  <!-- Studio branding strip -->
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
    <tr>
      <td style="width:40px;height:40px;background:#D4A843;border-radius:8px;
                 text-align:center;vertical-align:middle;font-size:18px;
                 font-weight:700;color:#0A0A0A">
        ${studioName[0]?.toUpperCase() ?? "S"}
      </td>
      <td style="padding-left:12px;vertical-align:middle">
        <div style="font-size:14px;font-weight:700;color:#111">${studioName}</div>
        <div style="font-size:11px;color:#888">via IndieThis</div>
      </td>
    </tr>
  </table>

  <!-- Body -->
  ${paragraphs}

  <!-- Footer -->
  <hr style="margin:32px 0 16px;border:none;border-top:1px solid #eeeeee"/>
  <p style="margin:0;font-size:11px;color:#aaaaaa;line-height:1.5">
    This email was sent on behalf of ${studioName} via IndieThis.
    If you didn't record at this studio, you can ignore this email.
  </p>
</body>
</html>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export type SendResult = {
  sent:      number;
  failed:    number;
  cancelled: number;
  skipped:   number;
};

/**
 * Fetch up to `batchSize` pending ScheduledEmail rows that are due,
 * send each one, and update their status.
 */
export async function processPendingEmails(batchSize = 20): Promise<SendResult> {
  const now = new Date();

  const pending = await db.scheduledEmail.findMany({
    where: {
      status:      "PENDING",
      scheduledFor: { lte: now },
    },
    take:    batchSize,
    orderBy: { scheduledFor: "asc" },
  });

  const result: SendResult = { sent: 0, failed: 0, cancelled: 0, skipped: 0 };

  for (const job of pending) {
    try {
      // ── 1. Fetch studio ──────────────────────────────────────────────────
      const studio = await db.studio.findUnique({
        where:  { id: job.studioId },
        select: { name: true, email: true, phone: true, emailTemplates: true },
      });
      if (!studio) {
        await db.scheduledEmail.update({
          where: { id: job.id },
          data:  { status: "CANCELLED", errorMessage: "Studio not found" },
        });
        result.cancelled++;
        continue;
      }

      // ── 2. Resolve template step ─────────────────────────────────────────
      const templateKey = STEP_KEY[job.sequenceStep];
      const templates   = (studio.emailTemplates ?? {}) as EmailTemplates;
      const template    = templateKey ? templates[templateKey] : undefined;

      if (!template?.enabled || !template.subject?.trim() || !template.body?.trim()) {
        // Step disabled or deleted after scheduling — cancel silently
        await db.scheduledEmail.update({
          where: { id: job.id },
          data:  { status: "CANCELLED", errorMessage: "Template disabled or missing" },
        });
        result.cancelled++;
        continue;
      }

      // ── 3. Resolve contact name + session date ───────────────────────────
      let artistName  = job.contactEmail.split("@")[0]; // fallback if no contact record
      let sessionDate = "";

      if (job.contactId) {
        const contact = await db.contact.findUnique({
          where:  { id: job.contactId },
          select: { name: true, lastSessionDate: true },
        });
        if (contact?.name) artistName = contact.name;
        if (contact?.lastSessionDate) {
          sessionDate = contact.lastSessionDate.toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric",
          });
        }
      }

      // ── 4. Resolve download link + fallback session date from quickSend ──
      let downloadLink = APP_URL();

      if (job.quickSendId) {
        const qs = await db.quickSend.findUnique({
          where:  { id: job.quickSendId },
          select: { token: true, createdAt: true },
        });
        if (qs) {
          downloadLink = `${APP_URL()}/dl/${qs.token}`;
          if (!sessionDate) {
            sessionDate = qs.createdAt.toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            });
          }
        }
      }

      // ── 5. Build placeholder substitution map ────────────────────────────
      const vars: Record<string, string> = {
        artistName,
        sessionDate:    sessionDate || "your recent session",
        studioName:     studio.name,
        studioPhone:    studio.phone ?? "",
        downloadLink,
        masteringPrice: PLATFORM_PRICES.masteringPrice,
        coverArtPrice:  PLATFORM_PRICES.coverArtPrice,
        arReportPrice:  PLATFORM_PRICES.arReportPrice,
      };

      const subject  = replacePlaceholders(template.subject, vars);
      const bodyText = replacePlaceholders(template.body,    vars);
      const bodyHtml = toHtml(bodyText, studio.name);

      // ── 6. Send via Brevo ────────────────────────────────────────────────
      const client = getBrevoClient();

      await client.transactionalEmails.sendTransacEmail({
        // From address uses verified IndieThis domain; display name = studio name
        sender:  { email: FROM_EMAIL(), name: studio.name },
        to:      [{ email: job.contactEmail }],
        // Reply-to = studio email so replies land in the studio's inbox
        ...(studio.email && {
          replyTo: { email: studio.email, name: studio.name },
        }),
        subject,
        textContent: bodyText,
        htmlContent: bodyHtml,
        tags: ["email-sequence", job.sequenceStep.toLowerCase().replace("_", "-")],
      });

      // ── 7. Mark SENT ─────────────────────────────────────────────────────
      await db.scheduledEmail.update({
        where: { id: job.id },
        data:  { status: "SENT", sentAt: new Date() },
      });
      result.sent++;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.scheduledEmail.update({
        where: { id: job.id },
        data: {
          status:       "FAILED",
          errorMessage: message.slice(0, 500),
        },
      });
      result.failed++;
    }
  }

  return result;
}
