"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Fires a POST to record a page view for the artist's public page.
 * Reads the `?ref` URL param so QR-scan traffic is tagged as referrer "qr".
 * Renders nothing — pure side-effect component.
 * Mount once; the API handles owner-skip and 30-minute dedup.
 */
export default function ArtistPageViewTracker({ artistSlug }: { artistSlug: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref") ?? undefined;
    fetch(`/api/public/artist-pageview/${artistSlug}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ referrer: ref ?? null }),
    }).catch(() => {});
  }, [artistSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
