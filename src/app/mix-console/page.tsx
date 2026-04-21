import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import SignalFlowGraphic from "./SignalFlowGraphic";

export const metadata: Metadata = {
  title: "AI Mix Console — IndieThis",
  description:
    "Professional mixing powered by Claude. Vocal cleaning, section-aware processing, lyric-driven delay throws — delivered in minutes.",
  openGraph: {
    title: "AI Mix Console — IndieThis",
    description:
      "Professional mixing powered by Claude. Vocal cleaning, section-aware processing, lyric-driven delay throws — delivered in minutes.",
  },
};

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PRICING = [
  {
    name:     "Standard",
    tier:     "STANDARD",
    price:    "$59.99",
    features: [
      "3 mix variations (Clean / Polished / Aggressive)",
      "Full vocal chain processing",
      "Breath editing",
      "Pitch correction",
      "All 6 download formats",
    ],
    highlight: false,
    badge:     null,
  },
  {
    name:     "Premium",
    tier:     "PREMIUM",
    price:    "$79.99",
    features: [
      "AI-recommended single mix",
      "2 revision rounds",
      "Delay throws & reverb",
      "Section-aware processing",
      "Reference track matching",
      "All 6 download formats",
    ],
    highlight: true,
    badge:     "Most Popular",
  },
  {
    name:     "Pro",
    tier:     "PRO",
    price:    "$99.99",
    features: [
      "Everything in Premium",
      "Claude identifies delay words from lyrics",
      "3 revision rounds",
      "Per-word delay requests",
      "All 6 download formats",
    ],
    highlight: false,
    badge:     null,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MixConsolePage() {
  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
          style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.25)" }}
        >
          AI Mix Console
        </div>

        <h1
          className="text-5xl md:text-6xl font-black tracking-tight leading-none mb-6"
          style={{
            background: "linear-gradient(135deg, #D4A843 0%, #E8735A 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AI Mix Console
        </h1>

        <p className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: "#aaa" }}>
          Professional mixing powered by Claude. Vocal cleaning, section-aware processing,
          lyric-driven delay throws — delivered in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/mix-console/wizard"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 no-underline"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Mix My Track →
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:border-[#555] no-underline"
            style={{ border: "1px solid #2A2A2A", color: "#ccc" }}
          >
            See how it works ↓
          </a>
        </div>
      </section>

      {/* ── Mode Cards ── */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest mb-8" style={{ color: "#555" }}>
          Choose your workflow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Vocal + Beat */}
          <div
            className="rounded-2xl p-7 flex flex-col gap-4"
            style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.25)" }}
            >
              {/* Mic + waveform */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Vocal + Beat</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                Upload your vocal recording and instrumental. We&apos;ll clean, process, and mix
                them into a professional-sounding track.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["Vocal isolation & de-reverb", "Breath editing & pitch correction", "Beat stem separation", "Section-aware processing"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#777" }}>
                  <Check size={12} style={{ color: "#D4A843", flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Tracked-out Stems */}
          <div
            className="rounded-2xl p-7 flex flex-col gap-4"
            style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(232,115,90,0.12)", border: "1px solid rgba(232,115,90,0.25)" }}
            >
              {/* Sliders */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8735A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"/>
                <line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/>
                <line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/>
                <line x1="9" y1="8" x2="15" y2="8"/>
                <line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Tracked-out Stems</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                Upload 2–16 individual stems. Full control, AI precision — per-stem processing
                chains with section-aware automation.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["Per-stem classification & processing", "Vocal chain on all vocal layers", "Dynamic EQ carving", "Lyric-driven delay throws (Pro)"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#777" }}>
                  <Check size={12} style={{ color: "#E8735A", flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Signal Flow Graphic ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-center text-2xl font-bold mb-2">The signal path</h2>
        <p className="text-center text-sm mb-10" style={{ color: "#666" }}>
          Every stem runs through an intelligent processing chain.
        </p>
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <SignalFlowGraphic />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-center text-2xl font-bold mb-2">Simple pricing</h2>
        <p className="text-center text-sm mb-10" style={{ color: "#666" }}>
          Pay per mix. No subscription required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl p-6 flex flex-col relative"
              style={{
                backgroundColor: "#111",
                border: plan.highlight ? "1px solid #D4A843" : "1px solid #1A1A1A",
                boxShadow: plan.highlight ? "0 0 30px rgba(212,168,67,0.1)" : "none",
              }}
            >
              {plan.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {plan.badge}
                </div>
              )}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#666" }}>
                  {plan.name}
                </p>
                <p className="text-3xl font-black" style={{ color: plan.highlight ? "#D4A843" : "#fff" }}>
                  {plan.price}
                </p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "#888" }}>
                    <Check size={13} className="mt-0.5 shrink-0" style={{ color: plan.highlight ? "#D4A843" : "#555" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/mix-console/wizard?tier=${plan.tier}`}
                className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 no-underline"
                style={
                  plan.highlight
                    ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                    : { backgroundColor: "#1A1A1A", color: "#ccc", border: "1px solid #2A2A2A" }
                }
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cross-sell ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div
          className="rounded-2xl p-7 flex flex-col sm:flex-row items-center justify-between gap-5"
          style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}
        >
          <div>
            <p className="text-lg font-bold mb-1">Mixed and ready to master?</p>
            <p className="text-sm" style={{ color: "#777" }}>
              Take your track to release-ready with 4 mastered versions starting at $7.99.
            </p>
          </div>
          <Link
            href="/master"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 no-underline"
            style={{ backgroundColor: "#E8735A", color: "#fff" }}
          >
            Master for $7.99 →
          </Link>
        </div>
      </section>

    </div>
  );
}
