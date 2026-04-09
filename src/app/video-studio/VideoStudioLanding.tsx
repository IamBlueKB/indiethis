"use client";

/**
 * VideoStudioLanding — premium marketing landing page for /video-studio.
 *
 * Shown when the user lands at /video-studio without ?start=1.
 * "Get Started" navigates to ?start=1 which renders VideoStudioClient.
 */

import { useState }               from "react";
import { useRouter }              from "next/navigation";
import {
  Film, Zap, Clapperboard, Download, ChevronRight,
  Check, Music2, Sparkles, Globe,
} from "lucide-react";
import DemoReel                   from "./DemoReel";

// ─── Feature row ───────────────────────────────────────────────────────────────

function Feature({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
        <Icon size={14} style={{ color: "#D4A843" }} />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#666" }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Mode card ─────────────────────────────────────────────────────────────────

function ModeCard({
  icon: Icon, title, description, price, features, accent, onStart,
}: {
  icon: React.ElementType;
  title:       string;
  description: string;
  price:       string;
  features:    string[];
  accent:      string;
  onStart:     (mode: "QUICK" | "DIRECTOR") => void;
}) {
  const mode = title.startsWith("Quick") ? "QUICK" : "DIRECTOR";
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4 cursor-pointer transition-all hover:scale-[1.01]"
      style={{ borderColor: "#222", backgroundColor: "#0F0F0F" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}18` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div>
          <p className="font-bold text-white text-base">{title}</p>
          <p className="text-xs" style={{ color: "#666" }}>from {price}</p>
        </div>
      </div>
      <p className="text-sm" style={{ color: "#aaa", lineHeight: 1.6 }}>{description}</p>
      <ul className="space-y-1.5">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
            <Check size={11} style={{ color: accent }} className="shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onStart(mode)}
        className="mt-auto w-full py-3 rounded-xl text-sm font-bold transition-all"
        style={{ backgroundColor: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}
      >
        Start {title} &rarr;
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  userTier: string | null;
}

export default function VideoStudioLanding({ userId, userTier }: Props) {
  const router       = useRouter();


  function handleStart(mode?: "QUICK" | "DIRECTOR") {
    const q = mode ? `?start=1&mode=${mode}` : "?start=1";
    router.push(`/video-studio${q}`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}>
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Film size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Music Video Studio</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
            by IndieThis
          </span>
        </a>
        <div className="flex items-center gap-2">
          {!userId && (
            <a href="/login" className="text-xs font-semibold px-3 py-2 rounded-lg transition"
              style={{ color: "#888" }}>
              Sign In
            </a>
          )}
          <button
            onClick={() => handleStart()}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Get Started <ChevronRight size={12} />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient (replace with a video src once demo reel is ready) */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.08) 0%, transparent 65%), linear-gradient(180deg, #0A0A0A 0%, #0D0D0D 50%, #0A0A0A 100%)" }} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}>
            <Sparkles size={11} /> AI-Powered Music Video Creation
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-5">
            Turn Your Track Into a{" "}
            <span style={{ color: "#D4A843" }}>Music Video</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-3" style={{ color: "#aaa", lineHeight: 1.6 }}>
            Upload your song. Choose your style. Get a full cinematic music video — ready to post.
          </p>

          <p className="text-sm mb-10 font-semibold" style={{ color: "#D4A843" }}>
            No account needed. Pay once. Download + keep forever.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handleStart("QUICK")}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-black transition-all hover:scale-105"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Zap size={16} /> Start Quick Mode — from $14.99
            </button>
            <button
              onClick={() => handleStart("DIRECTOR")}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all border"
              style={{ borderColor: "#333", color: "#ccc", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <Clapperboard size={16} /> Director Mode — from $24.99
            </button>
          </div>

          {/* Trust line */}
          <p className="text-xs mt-6" style={{ color: "#555" }}>
            Results in ~15 minutes &nbsp;·&nbsp; Download MP4
          </p>
        </div>
      </section>

      {/* ── Demo reel ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <DemoReel />
      </section>

      {/* ── Mode cards ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-8">Choose Your Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ModeCard
            icon={Zap}
            title="Quick Mode"
            description="Upload your track and our AI analyzes the BPM, energy, and song structure to automatically generate a full music video in minutes."
            price="$14.99"
            accent="#D4A843"
            features={[
              "AI selects the best visual style",
              "Beat-synced scene transitions",
              "4–7 generated scenes",
              "16:9, 9:16, or 1:1 format",
              "Download MP4 instantly",
            ]}
            onStart={handleStart}
          />
          <ModeCard
            icon={Clapperboard}
            title="Director Mode"
            description="Collaborate with our AI director in a creative conversation. Build a shot list, approve the creative brief, and get a bespoke video that tells your story."
            price="$24.99"
            accent="#E85D4A"
            features={[
              "AI creative brief from your vision",
              "Custom shot list with scene prompts",
              "Per-scene model selection",
              "One free scene regeneration",
              "Director notes preserved",
            ]}
            onStart={handleStart}
          />
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border p-8" style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}>
          <h2 className="text-xl font-black text-white mb-8 text-center">Everything you need, nothing you don&rsquo;t</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <Feature icon={Music2}     label="Tracks any genre"         sub="Electronic, hip-hop, indie, pop — the AI adapts to your sound." />
            <Feature icon={Film}       label="Multiple visual styles"   sub="Cinematic noir, neon city, abstract, lo-fi — 12+ styles available." />
            <Feature icon={Zap}        label="Beat-synced cuts"         sub="Scene transitions align to your track's BPM and energy peaks." />
            <Feature icon={Download}   label="Download forever"         sub="Your MP4 is yours. No expiry, no watermarks, no subscriptions needed." />
            <Feature icon={Globe}      label="Shareable preview page"   sub="Every video gets a public preview URL to drop in your bio." />
            <Feature icon={Sparkles}   label="Powered by top AI models" sub="State-of-the-art video generation — automatically matched to your style." />
          </div>
        </div>
      </section>

      {/* ── Pricing callout ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border px-8 py-8 text-center"
          style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#D4A843" }}>
            Already on IndieThis?
          </p>
          <h2 className="text-xl font-black text-white mb-2">Launch subscribers get 1 video/month included</h2>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Plus cover art, mastering, press kits, merch store, and an artist page — all for $19/month.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {userId ? (
              <button onClick={() => handleStart()} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                Create Your Video <ChevronRight size={14} />
              </button>
            ) : (
              <>
                <a href="/pricing" className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  View Plans <ChevronRight size={14} />
                </a>
                <button onClick={() => handleStart()} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: "#333", color: "#888" }}>
                  Continue without account
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-6 text-center" style={{ borderColor: "#1A1A1A" }}>
        <p className="text-xs" style={{ color: "#555" }}>
          &copy; {new Date().getFullYear()} IndieThis &nbsp;·&nbsp;{" "}
          <a href="/privacy" style={{ color: "#555" }}>Privacy</a> &nbsp;·&nbsp;{" "}
          <a href="/terms" style={{ color: "#555" }}>Terms</a>
        </p>
      </footer>
    </div>
  );
}
