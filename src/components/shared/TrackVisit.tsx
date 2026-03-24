"use client";

import { useEffect } from "react";

/**
 * Sets a lightweight first-visit cookie (`itev`) the first time any page loads.
 * The timestamp is read at signup and saved to User.firstVisitAt.
 * Cookie lives 1 year; no server call needed.
 */
export default function TrackVisit() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const has = document.cookie.split(";").some((c) => c.trim().startsWith("itev="));
    if (!has) {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `itev=${Date.now()}; expires=${expires}; path=/; SameSite=Lax`;
    }
  }, []);

  return null;
}
