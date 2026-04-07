"use client";

/**
 * src/app/lyric-video/LyricVideoClient.tsx
 *
 * Main container for the public Lyric Video Studio.
 * Shows mode picker (Quick / Director), then renders the chosen wizard.
 *
 * Subscribers are redirected server-side to /dashboard/ai/lyric-video.
 */

import { useState } from "react";
import { Film, Clapperboard, Zap, ChevronRight, Star } from "lucide-react";
import QuickModeWizard    from "./QuickModeWizard";
import DirectorModeWizard from "./DirectorModeWizard";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  guestEmail:    string;
  artistName?:   string | null;
  isSubscriber?: boolean;
  initialMode?:  "quick" | "director" | null;
}

type Mode = "quick" | "director" | null;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LyricVideoClient({ guestEmail, artistName, isSubscriber = false, initialMode = null }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const quickGuestPrice    = PRICING_DEFAULTS.LYRIC_VIDEO_QUICK_GUEST.display;
  const directorGuestPrice = PRICING_DEFAULTS.LYRIC_VIDEO_DIRECTOR_GUEST.display;
  const quickSubPrice      = PRICING_DEFAULTS.LYRIC_VIDEO_QUICK_SUB.display;
  const directorSubPrice   = PRICING_DEFAULTS.LYRIC_VIDEO_DIRECTOR_SUB.display;

  // ── Mode picker ──────────────────────────────────────────────────────────────
  if (!mode) return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}
      >
        <a href="/lyric-video" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Film size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Lyric Video Studio</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
            by IndieThis
          </span>
        </a>
        {artistName && <span className="text-xs" style={{ color: "#666" }}>{artistName}</span>}
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full space-y-10">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-black text-white leading-tight">
              Cinematic Lyric Videos<br/>
              <span style={{ color: "#D4A843" }}>Powered by AI</span>
            </h1>
            <p className="text-sm" style={{ color: "#888" }}>
              Upload your track. Choose your style. Get a professional lyric video in minutes.
            </p>
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Quick Mode */}
            <button
              onClick={() => setMode("quick")}
              className="group text-left rounded-2xl border p-5 transition-all hover:border-[#D4A843]/60 hover:bg-[#D4A843]/5"
              style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
                >
                  <Zap size={18} style={{ color: "#D4A843" }} />
                </div>
                <ChevronRight size={16} style={{ color: "#555" }} className="group-hover:text-[#D4A843] transition-colors mt-1" />
              </div>
              <p className="font-bold text-white text-base mb-1">Quick Mode</p>
              <p className="text-xs mb-3" style={{ color: "#888" }}>
                Upload · pick a style · pay · get your video in minutes
              </p>
              <div className="space-y-1">
                {["Automated section analysis", "5 typography animation styles", "AI background per section"].map(f => (
                  <p key={f} className="text-[11px] flex items-center gap-1.5" style={{ color: "#666" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#D4A843", display: "inline-block", flexShrink: 0 }} />
                    {f}
                  </p>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "#1A1A1A" }}>
                <span className="text-sm font-bold" style={{ color: "#D4A843" }}>
                  {isSubscriber ? quickSubPrice : quickGuestPrice}
                </span>
              </div>
            </button>

            {/* Director Mode */}
            <button
              onClick={() => setMode("director")}
              className="group text-left rounded-2xl border p-5 transition-all hover:border-[#D4A843]/60 hover:bg-[#D4A843]/5 relative"
              style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}
            >
              <div
                className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
              >
                PREMIUM
              </div>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
                >
                  <Clapperboard size={18} style={{ color: "#D4A843" }} />
                </div>
                <ChevronRight size={16} style={{ color: "#555" }} className="group-hover:text-[#D4A843] transition-colors mt-1 mr-5" />
              </div>
              <p className="font-bold text-white text-base mb-1">Director Mode</p>
              <p className="text-xs mb-3" style={{ color: "#888" }}>
                Chat with an AI creative director to craft every detail
              </p>
              <div className="space-y-1">
                {["Claude creative brief session", "Custom scene for every section", "Per-section typography overrides"].map(f => (
                  <p key={f} className="text-[11px] flex items-center gap-1.5" style={{ color: "#666" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#D4A843", display: "inline-block", flexShrink: 0 }} />
                    {f}
                  </p>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "#1A1A1A" }}>
                <span className="text-sm font-bold" style={{ color: "#D4A843" }}>
                  {isSubscriber ? directorSubPrice : directorGuestPrice}
                </span>
              </div>
            </button>
          </div>

          {/* Subscriber upsell */}
          {!isSubscriber && (
            <div
              className="rounded-xl border p-4 flex items-start gap-3"
              style={{ borderColor: "#2A2A2A", backgroundColor: "rgba(212,168,67,0.03)" }}
            >
              <Star size={14} style={{ color: "#D4A843", flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">Save on every video with a subscription</p>
                <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                  Subscribers pay {quickSubPrice} (Quick) or {directorSubPrice} (Director) — plus monthly credits included.
                  <a href="/pricing" className="ml-1" style={{ color: "#D4A843" }}>View plans →</a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Wizard container ────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}
    >
      {/* Header with back-to-mode-picker */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center gap-3"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}
      >
        <button onClick={() => setMode(null)} className="text-xs font-medium transition-colors hover:text-white" style={{ color: "#666" }}>
          ← Modes
        </button>
        <div className="w-px h-4" style={{ backgroundColor: "#222" }} />
        <div className="flex items-center gap-2">
          {mode === "quick" ? <Zap size={14} style={{ color: "#D4A843" }} /> : <Clapperboard size={14} style={{ color: "#D4A843" }} />}
          <span className="text-sm font-bold text-white">
            {mode === "quick" ? "Quick Mode" : "Director Mode"}
          </span>
        </div>
      </header>

      {/* Wizard */}
      <div className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {mode === "quick" ? (
            <QuickModeWizard
              guestEmail={guestEmail}
              artistName={artistName}
              isSubscriber={isSubscriber}
            />
          ) : (
            <DirectorModeWizard
              guestEmail={guestEmail}
              artistName={artistName}
              isSubscriber={isSubscriber}
            />
          )}
        </div>
      </div>
    </div>
  );
}
