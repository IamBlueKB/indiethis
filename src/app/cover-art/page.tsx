/**
 * /cover-art — Cover Art Studio (public, no auth required)
 *
 * URL behaviour:
 *   /cover-art             → CoverArtLanding  (premium marketing page)
 *   /cover-art?start=1     → GateScreen → CoverArtClient wizard
 *
 * Authenticated subscribers are redirected to the full-featured dashboard wizard.
 */

import { Metadata, Viewport } from "next";
import { redirect }           from "next/navigation";
import { cookies }            from "next/headers";
import { Suspense }           from "react";
import { auth }               from "@/lib/auth";
import { db }                 from "@/lib/db";
import CoverArtLanding        from "./CoverArtLanding";
import GateScreen             from "./GateScreen";
import CoverArtClient         from "./CoverArtClient";

export const viewport: Viewport = { themeColor: "#0A0A0A" };

// ─── OG Metadata ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       "AI Cover Art Studio — IndieThis",
  description: "Generate professional album cover art in seconds with AI. No account needed. 4–8 stunning variations from $6.99. Download instantly.",
  openGraph: {
    title:       "AI Cover Art Studio — IndieThis",
    description: "Generate professional album cover art with AI. No account needed.",
    url:         "https://indiethis.com/cover-art",
    siteName:    "IndieThis",
    type:        "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "AI Cover Art — IndieThis",
    description: "Generate album cover art with AI from $6.99. No account needed.",
    site:        "@indiethisapp",
  },
  keywords: [
    "AI album cover art", "cover art generator", "AI music artwork",
    "album art maker", "music cover generator", "indie artist tools",
  ],
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CoverArtPage({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string }>;
}) {
  const sp      = await searchParams;
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  // Authenticated subscribers → redirect to the full dashboard wizard
  if (userId) {
    const sub = await db.subscription.findFirst({
      where:  { userId, status: "ACTIVE" },
      select: { tier: true },
    });
    if (sub) redirect("/dashboard/ai/cover-art");
  }

  // Default view: premium landing page
  if (sp?.start !== "1") {
    return <CoverArtLanding userId={userId} userTier={null} />;
  }

  // ?start=1 — show gate screen or jump straight to wizard if cookie already set
  const cookieStore    = await cookies();
  const coverArtCookie = cookieStore.get("indiethis_guest_cover_art")?.value;
  const sharedCookie   = cookieStore.get("indiethis_guest_email")?.value;

  let guestEmail: string | null = null;
  let artistName: string | null = null;

  if (session?.user) {
    guestEmail = session.user.email ?? null;
    artistName = (session.user as { artistName?: string }).artistName ?? session.user.name ?? null;
  } else if (coverArtCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(coverArtCookie)) as { email?: string; name?: string };
      guestEmail   = parsed.email ?? null;
      artistName   = parsed.name ?? null;
    } catch { /* malformed cookie */ }
  } else if (sharedCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sharedCookie)) as { email?: string; name?: string };
      guestEmail   = parsed.email ?? null;
      artistName   = parsed.name ?? null;
    } catch { /* malformed cookie */ }
  }

  // No email → gate screen collects it
  if (!guestEmail) {
    return <GateScreen />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }} />}>
      <CoverArtClient
        guestEmail={guestEmail}
        artistName={artistName}
        userId={userId}
      />
    </Suspense>
  );
}
