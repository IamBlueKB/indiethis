/**
 * GET /api/video-studio/track/click?v=VIDEO_ID&url=REDIRECT_URL
 *
 * Email click tracking for the Video Conversion Agent.
 * Sets conversionAnyOpened = true on the MusicVideo record,
 * then redirects the user to the intended destination.
 *
 * Embedded in all conversion email CTAs as the tracking layer.
 */

import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const videoId    = req.nextUrl.searchParams.get("v");
  const redirectTo = req.nextUrl.searchParams.get("url");

  // Mark email as opened/clicked (fire and forget — don't delay redirect)
  if (videoId) {
    void db.musicVideo.updateMany({
      where: { id: videoId, conversionAnyOpened: false },
      data:  { conversionAnyOpened: true },
    }).catch(() => {});
  }

  // Redirect to destination (or homepage as fallback)
  const dest = redirectTo
    ? decodeURIComponent(redirectTo)
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  return NextResponse.redirect(dest, 302);
}
