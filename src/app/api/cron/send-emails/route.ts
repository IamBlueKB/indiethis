/**
 * GET /api/cron/send-emails
 *
 * Cron endpoint — processes all ScheduledEmail rows where
 * scheduledFor <= now() and status = PENDING, up to 50 per run.
 *
 * Invocation options:
 *   1. Vercel Cron (vercel.json schedule) — called automatically
 *   2. Manual trigger — hit GET /api/cron/send-emails with the
 *      CRON_SECRET header: Authorization: Bearer <CRON_SECRET>
 *
 * Authentication:
 *   Requires Authorization: Bearer <CRON_SECRET> header.
 *   Set CRON_SECRET in environment variables.
 *   Vercel Cron jobs send this header automatically when configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { processPendingEmails } from "@/lib/email-sender";

const BATCH_SIZE = 50;

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — give Brevo calls room to breathe

export async function GET(req: NextRequest) {
  // ── Auth: require CRON_SECRET ────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const token      = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  // If CRON_SECRET is not set, allow the request (useful in local dev).
  // Log a warning so it's visible in server logs.
  else {
    console.warn("[send-emails cron] CRON_SECRET not set — endpoint is unprotected");
  }

  // ── Process pending emails ───────────────────────────────────────────────
  const startedAt = Date.now();

  try {
    const result = await processPendingEmails(BATCH_SIZE);

    const elapsed = Date.now() - startedAt;

    console.log(
      `[send-emails cron] sent=${result.sent} failed=${result.failed} ` +
      `cancelled=${result.cancelled} elapsed=${elapsed}ms`
    );

    return NextResponse.json({
      ok:        true,
      sent:      result.sent,
      failed:    result.failed,
      cancelled: result.cancelled,
      elapsed:   `${elapsed}ms`,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-emails cron] Fatal error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
