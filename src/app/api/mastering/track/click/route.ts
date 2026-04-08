/**
 * GET /api/mastering/track/click?j=JOB_ID&url=REDIRECT_URL
 *
 * Email click tracking for the Mastering Conversion Agent.
 * Sets conversionAnyOpened = true on the MasteringJob record,
 * then redirects the user to the intended destination.
 *
 * Embedded in all conversion email CTAs as the tracking layer.
 */

import { db }                        from "@/lib/db";
import { NextRequest, NextResponse }  from "next/server";

export async function GET(req: NextRequest) {
  const jobId      = req.nextUrl.searchParams.get("j");
  const redirectTo = req.nextUrl.searchParams.get("url");

  // Mark email as opened/clicked (fire and forget — don't delay redirect)
  if (jobId) {
    void db.masteringJob.updateMany({
      where: { id: jobId, conversionAnyOpened: false },
      data:  { conversionAnyOpened: true },
    }).catch(() => {});
  }

  // Redirect to destination (or homepage as fallback)
  const dest = redirectTo
    ? decodeURIComponent(redirectTo)
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  return NextResponse.redirect(dest, 302);
}
