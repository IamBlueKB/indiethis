"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "indiethis-install-dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "#111111",
        borderTop: "1px solid rgba(212, 168, 67, 0.25)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* Icon */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt="IndieThis"
        style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }}
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#D4A843", lineHeight: 1.3 }}>
          Add IndieThis to your home screen
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#888", lineHeight: 1.3, marginTop: 2 }}>
          Install the app for quick access
        </p>
      </div>

      {/* Install button */}
      <button
        onClick={handleInstall}
        style={{
          flexShrink: 0,
          backgroundColor: "#D4A843",
          color: "#0A0A0A",
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        Install
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: "#555",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: "4px 6px",
        }}
      >
        ×
      </button>
    </div>
  );
}
