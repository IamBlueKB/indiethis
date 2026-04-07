/**
 * /cover-art — Cover Art Studio (public, no auth required)
 *
 * URL behaviour:
 *   /cover-art                   → GateScreen (if no cookie and not authenticated)
 *   /cover-art (cookie set)      → CoverArtClient wizard
 *   /cover-art?paid=1&jobId=...  → CoverArtClient (post-Stripe return)
 *
 * Subscriber users are redirected to the full-featured dashboard wizard.
 */

import { Metadata, Viewport } from "next";
import { redirect }           from "next/navigation";
import { cookies }            from "next/headers";
import { Suspense }           from "react";
import { auth }               from "@/lib/auth";
import { db }                 from "@/lib/db";
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

export default async function CoverArtPage() {
  const session = await auth();

  // Authenticated subscribers → redirect to the full dashboard wizard
  if (session?.user?.id) {
    const sub = await db.subscription.findFirst({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { tier: true },
    });
    if (sub) {
      redirect("/dashboard/ai/cover-art");
    }
  }

  const cookieStore = await cookies();

  // Google OAuth return: user is authenticated but not a subscriber → let them use the wizard
  // Read guest cookie for their email
  const coverArtCookie  = cookieStore.get("indiethis_guest_cover_art")?.value;
  // Also check the shared indithis_guest_email cookie (used across tools)
  const sharedCookie    = cookieStore.get("indiethis_guest_email")?.value;

  let guestEmail:  string | null = null;
  let artistName:  string | null = null;

  // If authenticated (non-subscriber) — use their profile
  if (session?.user) {
    guestEmail  = session.user.email ?? null;
    artistName  = (session.user as { artistName?: string }).artistName ?? session.user.name ?? null;
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

  // No email identified → show gate screen
  if (!guestEmail) {
    return <GateScreen />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }} />}>
      <CoverArtClient guestEmail={guestEmail} artistName={artistName} />
    </Suspense>
  );
}
