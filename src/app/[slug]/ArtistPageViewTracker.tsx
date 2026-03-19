"use client";

import { useEffect } from "react";

/**
 * Fires a POST to record a page view for the artist's public page.
 * Renders nothing — pure side-effect component.
 * Mount once; the API handles owner-skip and 30-minute dedup.
 */
export default function ArtistPageViewTracker({ artistSlug }: { artistSlug: string }) {
  useEffect(() => {
    fetch(`/api/public/artist-pageview/${artistSlug}`, { method: "POST" }).catch(() => {});
  }, [artistSlug]);

  return null;
}
