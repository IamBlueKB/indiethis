"use client";

import { useEffect } from "react";

export default function PageViewTracker({ studioId }: { studioId: string }) {
  useEffect(() => {
    fetch(`/api/studio/pageview/${studioId}`, { method: "POST" }).catch(() => {});
  }, [studioId]);

  return null;
}
