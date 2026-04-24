"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Re-register /sw.js so the kill-switch version activates and unregisters
    // itself. The old SW was intercepting POSTs and breaking API calls. Once
    // every client has activated the kill-switch, this block is a no-op.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Also unregister any SW this page already has, defensively
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        // The kill-switch unregisters itself; this covers other stale SWs too
        if (r.active && r.active.scriptURL.endsWith("/sw.js")) return;
        r.unregister().catch(() => {});
      });
    }).catch(() => {});
  }, []);
  return null;
}
