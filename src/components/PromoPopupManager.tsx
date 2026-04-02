"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PopupData = {
  id:              string;
  title:           string;
  subtitle?:       string | null;
  ctaText?:        string | null;
  ctaUrl?:         string | null;
  imageUrl?:       string | null;
  backgroundColor?: string | null;
  frequency:       string;
  trigger:         string;
  triggerDelay?:   number | null;
};

// ── Storage helpers (frequency gating) ───────────────────────────────────────

const STORAGE_KEY = "it_popup_seen";

function getSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  const seen = getSeen();
  seen[id] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
}

function shouldShow(popup: PopupData): boolean {
  const seen = getSeen();
  const lastSeen = seen[popup.id];
  if (!lastSeen) return true;

  const now = Date.now();
  switch (popup.frequency) {
    case "ALWAYS":           return true;
    case "ONCE_EVER":        return false;
    case "ONCE_PER_SESSION": {
      // Reset on new tab/session: check sessionStorage
      const sessionSeen = sessionStorage.getItem(`it_popup_${popup.id}`);
      return !sessionSeen;
    }
    case "ONCE_PER_DAY": {
      const oneDayMs = 24 * 60 * 60 * 1000;
      return now - lastSeen > oneDayMs;
    }
    default:
      return true;
  }
}

function recordSession(id: string) {
  sessionStorage.setItem(`it_popup_${id}`, "1");
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function trackEvent(id: string, event: "impression" | "dismissal" | "ctaClick") {
  try {
    await fetch(`/api/admin/promo-popups/${id}/analytics`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ event }),
    });
  } catch {
    // Silently ignore analytics failures
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  page: string; // e.g. "explore", "home", "pricing"
}

export default function PromoPopupManager({ page }: Props) {
  const [popup, setPopup]   = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const trackedRef = useRef(false);

  const loadPopup = useCallback(async () => {
    try {
      const res  = await fetch(`/api/promo-popups?page=${encodeURIComponent(page)}`);
      const data = await res.json() as { popups: PopupData[] };
      const candidates = (data.popups ?? []).filter(shouldShow);
      if (candidates.length === 0) return;
      setPopup(candidates[0]);
    } catch {
      // Silently fail
    }
  }, [page]);

  useEffect(() => { void loadPopup(); }, [loadPopup]);

  // Handle trigger
  useEffect(() => {
    if (!popup) return;

    const show = () => {
      setVisible(true);
      recordSession(popup.id);
      markSeen(popup.id);
      if (!trackedRef.current) {
        trackedRef.current = true;
        void trackEvent(popup.id, "impression");
      }
    };

    if (popup.trigger === "ON_LOAD") {
      show();
      return;
    }

    if (popup.trigger === "DELAYED") {
      const ms = (popup.triggerDelay ?? 5) * 1000;
      const t = setTimeout(show, ms);
      return () => clearTimeout(t);
    }

    if (popup.trigger === "ON_SCROLL") {
      const handler = () => {
        const scrollPct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrollPct >= 50) {
          show();
          window.removeEventListener("scroll", handler);
        }
      };
      window.addEventListener("scroll", handler, { passive: true });
      return () => window.removeEventListener("scroll", handler);
    }

    if (popup.trigger === "ON_EXIT_INTENT") {
      const handler = (e: MouseEvent) => {
        if (e.clientY <= 5) {
          show();
          document.removeEventListener("mouseleave", handler);
        }
      };
      document.addEventListener("mouseleave", handler);
      return () => document.removeEventListener("mouseleave", handler);
    }
  }, [popup]);

  function dismiss() {
    setVisible(false);
    if (popup) void trackEvent(popup.id, "dismissal");
  }

  function handleCta() {
    if (popup) void trackEvent(popup.id, "ctaClick");
    // Navigation handled by the <a> tag
  }

  if (!visible || !popup) return null;

  const bg = popup.backgroundColor ?? "#111111";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Popup card */}
      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          background: bg,
          border: "1px solid #2A2A2A",
          borderRadius: 16,
          maxWidth: 480,
          width: "calc(100vw - 40px)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: "popupIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.4)", border: "none",
            borderRadius: "50%", width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#F5F5F5", zIndex: 1,
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Hero image */}
        {popup.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.imageUrl}
            alt=""
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
          />
        )}

        {/* Content */}
        <div style={{ padding: "24px 28px 28px" }}>
          <h2 style={{
            color: "#F5F5F5", fontSize: 22, fontWeight: 800,
            margin: 0, lineHeight: 1.25,
          }}>
            {popup.title}
          </h2>

          {popup.subtitle && (
            <p style={{ color: "#9A9A9E", fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
              {popup.subtitle}
            </p>
          )}

          {popup.ctaText && popup.ctaUrl && (
            <a
              href={popup.ctaUrl}
              onClick={handleCta}
              target={popup.ctaUrl.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              style={{
                display: "block",
                marginTop: 20,
                background: "#D4A843",
                color: "#0A0A0A",
                fontWeight: 800,
                fontSize: 15,
                textAlign: "center",
                padding: "13px 24px",
                borderRadius: 10,
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
            >
              {popup.ctaText}
            </a>
          )}

          {popup.ctaText && !popup.ctaUrl && (
            <button
              onClick={() => { handleCta(); dismiss(); }}
              style={{
                display: "block", width: "100%",
                marginTop: 20,
                background: "#D4A843", color: "#0A0A0A",
                fontWeight: 800, fontSize: 15,
                textAlign: "center", padding: "13px 24px",
                borderRadius: 10, border: "none", cursor: "pointer",
              }}
            >
              {popup.ctaText}
            </button>
          )}

          <button
            onClick={dismiss}
            style={{
              display: "block", width: "100%", marginTop: 12,
              background: "none", border: "none",
              color: "#9A9A9E", fontSize: 13, cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            No thanks
          </button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popupIn  {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.95) }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
      `}</style>
    </>
  );
}
