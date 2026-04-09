"use client";

/**
 * LyricVideoLanding — premium marketing landing page for /lyric-video.
 *
 * Shown when the user lands at /lyric-video without ?start=1.
 * All CTAs navigate to ?start=1&mode=quick or ?start=1&mode=director.
 */

import { useRouter }  from "next/navigation";
import {
  Film, Zap, Clapperboard, Download, ChevronRight,
  Check, Music2, Sparkles, Globe, Type, Mic2,
} from "lucide-react";

// ─── Feature item ──────────────────────────────────────────────────────────────

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

// ─── Animation style card ──────────────────────────────────────────────────────

function StyleCard({ name, description, sample, gradient }: {
  name:        string;
  description: string;
  sample:      string;
  gradient:    string;
}) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ borderColor: "#222", backgroundColor: "#0F0F0F" }}>
      <div className="rounded-lg h-16 flex items-center justify-center overflow-hidden"
        style={{ background: gradient }}>
        <span className="text-sm font-bold text-white" style={{ letterSpacing: "0.05em" }}>
          {sample}
        </span>
      </div>
      <p className="text-sm font-bold text-white">{name}</p>
      <p className="text-xs" style={{ color: "#666" }}>{description}</p>
    </div>
  );
}

// ─── Mode card ─────────────────────────────────────────────────────────────────

function ModeCard({
  icon: Icon, title, description, price, features, accent, onStart,
}: {
  icon:        React.ElementType;
  title:       string;
  description: string;
  price:       string;
  features:    string[];
  accent:      string;
  onStart:     () => void;
}) {
  return (
    <div className="rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: "#222", backgroundColor: "#0F0F0F" }}>
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
      <ul className="space-y-1.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
            <Check size={11} style={{ color: accent }} className="shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onStart}
        className="mt-auto w-full py-3 rounded-xl text-sm font-bold transition-all"
        style={{ backgroundColor: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}
      >
        Start {title} &rarr;
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  userTier: string | null;
}

const ANIMATION_STYLES = [
  {
    name:        "Karaoke",
    description: "Words highlight in sequence as they're sung",
    sample:      "Your lyrics ►",
    gradient:    "linear-gradient(135deg, #001a3a, #002a5a)",
  },
  {
    name:        "Kinetic Bounce",
    description: "Words pop in with weight and energy",
    sample:      "YOUR LYRICS",
    gradient:    "linear-gradient(135deg, #1a0030, #3a0060)",
  },
  {
    name:        "Smooth Fade",
    description: "Elegant fade-in, perfect for ballads",
    sample:      "your lyrics",
    gradient:    "linear-gradient(135deg, #0a1a0a, #001a10)",
  },
  {
    name:        "Glitch",
    description: "Digital distortion — electronic/trap",
    sample:      "Y0UR LYR1CS",
    gradient:    "linear-gradient(135deg, #001a00, #0a2a0a)",
  },
  {
    name:        "Handwritten",
    description: "Letters draw in as if being written",
    sample:      "your lyrics...",
    gradient:    "linear-gradient(135deg, #1a0800, #2a1000)",
  },
];

export default function LyricVideoLanding({ userId, userTier }: Props) {
  const router = useRouter();

  function handleQuick() {
    router.push("/lyric-video?start=1&mode=quick");
  }

  function handleDirector() {
    router.push("/lyric-video?start=1&mode=director");
  }

  function handleStart() {
    router.push("/lyric-video?start=1");
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
          <span className="text-sm font-bold text-white">Lyric Video Studio</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
            by IndieThis
          </span>
        </a>
        <div className="flex items-center gap-2">
          {!userId && (
            <a href="/login" className="text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ color: "#888" }}>
              Sign In
            </a>
          )}
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Get Started <ChevronRight size={12} />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div style={{ background: "radial-gradient(ellipse at 70% 30%, #1a003a40 0%, transparent 60%)", opacity: 0.8 }} className="absolute inset-0" />
          <div style={{ background: "radial-gradient(ellipse at 20% 70%, #00331a30 0%, transparent 60%)", opacity: 0.8 }} className="absolute inset-0" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}>
            <Sparkles size={11} /> AI-Powered Lyric Videos — no account required
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-5">
            Turn Your Lyrics Into a{" "}
            <br className="hidden sm:block" />
            <span style={{ color: "#D4A843" }}>Visual Experience</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-3" style={{ color: "#aaa", lineHeight: 1.6 }}>
            Dynamic typography synced to your music. AI-generated cinematic backgrounds per section. 5 animation styles to match your sound.
          </p>

          <p className="text-sm mb-10 font-semibold" style={{ color: "#D4A843" }}>
            No account needed. Pay once. Download + keep forever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleQuick}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-black transition-all hover:scale-105"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <Zap size={16} /> Start Quick Mode — from $17.99 →
            </button>
            <button
              onClick={handleDirector}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all border"
              style={{ borderColor: "#333", color: "#ccc", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <Clapperboard size={16} /> Director Mode — from $29.99
            </button>
          </div>

          <p className="text-xs mt-6" style={{ color: "#555" }}>
            Results in ~10 minutes &nbsp;·&nbsp; Download MP4
          </p>
        </div>
      </section>

      {/* ── Demo reel placeholder ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-8">See your lyrics come alive</h2>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #222" }}>
          {/* Film strip top */}
          <div className="flex gap-1 px-2 py-1.5" style={{ backgroundColor: "#111" }}>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-sm h-3" style={{ backgroundColor: "#222" }} />
            ))}
          </div>
          {/* Placeholder content */}
          <div className="flex flex-col items-center justify-center py-20 gap-4"
            style={{ backgroundColor: "#0D0D0D" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
              <Film size={24} style={{ color: "#D4A843" }} />
            </div>
            <p className="text-base font-bold" style={{ color: "#D4A843" }}>Demo reel coming soon</p>
            <p className="text-sm" style={{ color: "#555" }}>Drop your track in and see what we make</p>
          </div>
          {/* Film strip bottom */}
          <div className="flex gap-1 px-2 py-1.5" style={{ backgroundColor: "#111" }}>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-sm h-3" style={{ backgroundColor: "#222" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Animation styles ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-3">5 animation styles</h2>
        <p className="text-sm text-center mb-8" style={{ color: "#666" }}>
          Pick the style that fits your sound — or let the AI choose
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ANIMATION_STYLES.map(s => (
            <StyleCard key={s.name} {...s} />
          ))}
        </div>
      </section>

      {/* ── Mode cards ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-8">Choose Your Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ModeCard
            icon={Zap}
            title="Quick Mode"
            description="Upload your track and lyrics — the AI handles the rest. Backgrounds, typography, and timing are all generated automatically."
            price="$17.99"
            accent="#D4A843"
            features={[
              "Upload track + lyrics auto-detected",
              "AI selects typography style",
              "Cinematic AI backgrounds per section",
              "Synced to your music's BPM and energy",
              "Download MP4 instantly",
            ]}
            onStart={handleQuick}
          />
          <ModeCard
            icon={Clapperboard}
            title="Director Mode"
            description="Chat with our AI director about your vision. Customize every section, pick typography per part, and get exactly the video you imagined."
            price="$29.99"
            accent="#E85D4A"
            features={[
              "Everything in Quick Mode",
              "Chat with AI director about your vision",
              "Per-section background customization",
              "Choose typography style per section",
              "Section plan editor",
            ]}
            onStart={handleDirector}
          />
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border p-8" style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}>
          <h2 className="text-xl font-black text-white mb-8 text-center">Everything you need, nothing you don&rsquo;t</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <Feature icon={Film}        label="Cinematic AI backgrounds"  sub="Each section gets its own AI-generated visual — verse, chorus, bridge all look different." />
            <Feature icon={Music2}      label="Beat-synced typography"    sub="Every word lands on beat. Whisper transcription with word-level timing." />
            <Feature icon={Type}        label="5 animation styles"        sub="Karaoke, kinetic bounce, smooth fade, glitch, handwritten — pick what fits your sound." />
            <Feature icon={Globe}       label="Multi-format export"       sub="YouTube 16:9, TikTok 9:16, Instagram 1:1 — one render covers every platform." />
            <Feature icon={Download}    label="Download forever"          sub="Your MP4 is yours. No expiry, no watermarks, no subscriptions needed." />
            <Feature icon={Clapperboard} label="Director Mode"            sub="Chat with our AI director. Customize every section. Get exactly the video you imagined." />
          </div>
        </div>
      </section>

      {/* ── Subscriber upsell ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border px-8 py-8 text-center"
          style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#D4A843" }}>
            Already on IndieThis?
          </p>
          <h2 className="text-xl font-black text-white mb-2">Subscribers save up to 40% on lyric videos</h2>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Plus music videos, cover art, mastering, merch store, and an artist page — all for $19/month.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/pricing"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border"
              style={{ borderColor: "rgba(212,168,67,0.4)", color: "#D4A843" }}>
              View Plans <ChevronRight size={14} />
            </a>
            <button onClick={handleStart}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "#333", color: "#888" }}>
              Continue without account
            </button>
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
