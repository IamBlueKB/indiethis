/**
 * email-sender.ts
 *
 * Processes pending ScheduledEmail records where scheduledFor <= now()
 * and sends each one via Brevo transactional email.
 *
 * Each ScheduledEmail row stores the full finalized subject + body text
 * written by the studio at delivery time. No template resolution or
 * variable substitution happens here — messages are sent as-is.
 */

import { db } from "@/lib/db";
import { getBrevoClient } from "@/lib/brevo/client";

// ─── Env helpers ──────────────────────────────────────────────────────────────

const FROM_EMAIL = () => process.env.BREVO_FROM_EMAIL ?? "hello@indiethis.com";

// ─── HTML rendering ───────────────────────────────────────────────────────────

/**
 * Convert plain-text email body to minimal branded HTML.
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
 * send each one via Brevo, and update their status.
 */
export async function processPendingEmails(batchSize = 20): Promise<SendResult> {
  const now = new Date();

  const pending = await db.scheduledEmail.findMany({
    where: {
      status:       "PENDING",
      scheduledFor: { lte: now },
    },
    take:    batchSize,
    orderBy: { scheduledFor: "asc" },
    select: {
      id:           true,
      studioId:     true,
      contactEmail: true,
      sequenceStep: true,
      subject:      true,
      body:         true,
    },
  });

  const result: SendResult = { sent: 0, failed: 0, cancelled: 0, skipped: 0 };

  for (const job of pending) {
    try {
      // ── 1. Validate message content ──────────────────────────────────────
      if (!job.subject.trim() || !job.body.trim()) {
        await db.scheduledEmail.update({
          where: { id: job.id },
          data:  { status: "CANCELLED", errorMessage: "Empty subject or body" },
        });
        result.cancelled++;
        continue;
      }

      // ── 2. Fetch studio for sender identity ──────────────────────────────
      const studio = await db.studio.findUnique({
        where:  { id: job.studioId },
        select: { name: true, email: true },
      });
      if (!studio) {
        await db.scheduledEmail.update({
          where: { id: job.id },
          data:  { status: "CANCELLED", errorMessage: "Studio not found" },
        });
        result.cancelled++;
        continue;
      }

      // ── 3. Render HTML ───────────────────────────────────────────────────
      const bodyHtml = toHtml(job.body, studio.name);

      // ── 4. Send via Brevo ────────────────────────────────────────────────
      const client = getBrevoClient();

      await client.transactionalEmails.sendTransacEmail({
        // From = verified IndieThis domain; display name = studio name
        sender:  { email: FROM_EMAIL(), name: studio.name },
        to:      [{ email: job.contactEmail }],
        // Reply-to = studio email so replies land in the studio's inbox
        ...(studio.email && {
          replyTo: { email: studio.email, name: studio.name },
        }),
        subject:     job.subject,
        textContent: job.body,
        htmlContent: bodyHtml,
        tags: ["email-sequence", job.sequenceStep.toLowerCase().replace("_", "-")],
      });

      // ── 5. Mark SENT ─────────────────────────────────────────────────────
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
