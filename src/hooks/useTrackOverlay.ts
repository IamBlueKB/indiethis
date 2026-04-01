"use client";

import { useExpandedCard } from "@/store/expandedCard";
import { TrackDetailOverlay } from "@/components/tracks/TrackDetailOverlay";

/**
 * useTrackOverlay
 *
 * Single hook that gives any card component access to the global track overlay.
 * openOverlay(trackData) opens the panel.
 * OverlayComponent must be rendered once on the page (typically at the bottom).
 */
export function useTrackOverlay() {
  const { open, close } = useExpandedCard();

  return {
    openOverlay:      open,
    closeOverlay:     close,
    OverlayComponent: TrackDetailOverlay,
  };
}
