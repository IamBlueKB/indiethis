"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Music, Wand2, Play, Pause, ChevronRight, Zap, Check,
  Upload, Shield, Clock, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MasterGuestWizard } from "./MasterGuestWizard";

type View = "landing" | "wizard";
type Mode = "MIX_AND_MASTER" | "MASTER_ONLY";

const FEATURES = [
  { icon: <Zap size={18} />,    label: "Natural language direction",  description: "Tell the AI exactly what you want — in plain English" },
  { icon: <Music size={18} />,  label: "4 mastered versions",        description: "Clean, Warm, Punch, Loud — A/B compare before downloading" },
  { icon: <Shield size={18} />, label: "Platform-ready exports",     description: "Spotify, Apple Music, YouTube, Tidal, Amazon — all targets hit" },
  { icon: <Clock size={18} />,  label: "Ready in minutes",           description: "Not hours. Average processing time is 4–7 minutes" },
];

const PRICING = [
  {
    name:        "Standard",
    price:       "$11.99",
    mode:        "Stereo master",
    features:    ["4 mastered versions", "1 platform export (Spotify)", "30-second free preview", "Mastering report"],
    tier:        "STANDARD",
    modeValue:   "MASTER_ONLY" as Mode,
  },
  {
    name:        "Premium",
    price:       "$17.99",
    mode:        "Stereo master or stem mix",
    features:    ["4 mastered versions", "All platform exports", "Reference track matching", "30-second free preview", "Mastering report"],
    tier:        "PREMIUM",
    modeValue:   "MASTER_ONLY" as Mode,
    highlight:   true,
  },
  {
    name:        "Pro",
    price:       "$27.99",
    mode:        "Stereo master or stem mix",
    features:    ["4 mastered versions", "All platform exports", "Reference track matching", "1 revision round", "30-second free preview", "Mastering report"],
    tier:        "PRO",
    modeValue:   "MASTER_ONLY" as Mode,
  },
];

export function MasterLandingClient() {
  const [view,         setView]         = useState<View>("landing");
  const [selectedTier, setSelectedTier] = useState<string>("PREMIUM");
  const [selectedMode, setSelectedMode] = useState<Mode>("MASTER_ONLY");
  const [demoPlaying,  setDemoPlaying]  = useState(false);
  const [abDemo,       setAbDemo]       = useState<"before" | "after">("after");
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);

  // Placeholder demo audio URLs — swap for real samples at launch
  const DEMO_BEFORE_URL = "/audio/demo-unmastered.wav";
  const DEMO_AFTER_URL  = "/audio/demo-mastered.wav";

  function toggleDemoPlay() {
    const url = abDemo === "before" ? DEMO_BEFORE_URL : DEMO_AFTER_URL;
    if (demoPlaying) {
      demoAudioRef.current?.pause();
      setDemoPlaying(false);
    } else {
      if (demoAudioRef.current) demoAudioRef.current.pause();
      demoAudioRef.current = new Audio(url);
      demoAudioRef.current.play().catch(() => {}); // graceful fail on placeholder
      demoAudioRef.current.onended = () => setDemoPlaying(false);
      setDemoPlaying(true);
    }
  }

  function switchAbMode(mode: "before" | "after") {
    if (demoAudioRef.current) { demoAudioRef.current.pause(); setDemoPlaying(false); }
    setAbDemo(mode);
  }

  function startWizard(tier: string, mode: Mode) {
    setSelectedTier(tier);
    setSelectedMode(mode);
    setView("wizard");
  }

  if (view === "wizard") {
    return (
      <MasterGuestWizard
        initialTier={selectedTier}
        initialMode={selectedMode}
        onBack={() => setView("landing")}
      />
    );
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
        <Link href="/">
          <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: 28 }} />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-[#777] hover:text-white transition-colors">Sign in</Link>
          <Link
            href="/pricing"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Subscribe &amp; save
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Star size={11} fill="#0A0A0A" /> Free 30-second preview — no account required
        </div>

        <h1 className="text-5xl font-display font-black tracking-tight leading-tight mb-6">
          Professional AI<br />
          <span style={{ color: "#D4A843" }}>Mix &amp; Master</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "#999" }}>
          Upload stems for a full AI mix, or drop in a stereo mix for mastering.
          Four versions. Platform-ready exports. Natural language direction.
          No plug-ins. No engineers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => startWizard("PREMIUM", "MASTER_ONLY")}
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Master a track — $17.99 <ChevronRight size={18} />
          </button>
          <button
            onClick={() => startWizard("PREMIUM", "MIX_AND_MASTER")}
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold border transition-all hover:border-[#444]"
            style={{ borderColor: "#2A2A2A", color: "#ccc" }}
          >
            <Wand2 size={18} /> Mix + Master from stems
          </button>
        </div>

        <p className="text-xs mt-4" style={{ color: "#555" }}>
          Subscribers get up to 50% off · <Link href="/pricing" className="underline hover:text-white transition-colors">See subscriber pricing</Link>
        </p>
      </section>

      {/* ── A/B Demo Player ─────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>Live comparison</p>
              <p className="font-bold text-base mt-0.5">Hear the difference AI mastering makes</p>
            </div>
            {/* Before / After toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#2A2A2A]">
              <button
                onClick={() => switchAbMode("before")}
                className="px-4 py-1.5 text-xs font-semibold transition-all"
                style={abDemo === "before"
                  ? { backgroundColor: "#2A2A2A", color: "#fff" }
                  : { backgroundColor: "transparent", color: "#555" }}
              >
                Before
              </button>
              <button
                onClick={() => switchAbMode("after")}
                className="px-4 py-1.5 text-xs font-semibold transition-all"
                style={abDemo === "after"
                  ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                  : { backgroundColor: "transparent", color: "#555" }}
              >
                After
              </button>
            </div>
          </div>

          {/* Waveform visualization */}
          <div className="flex items-end gap-[2px] h-14 mb-5 overflow-hidden rounded-lg px-1">
            {Array.from({ length: 80 }, (_, i) => {
              const h = 20 + Math.abs(Math.sin(i * 0.4 + 1) * 60 + Math.sin(i * 0.9) * 30);
              const active = abDemo === "after";
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.min(100, h * (active ? 1 : 0.45))}%`,
                    borderRadius: 1,
                    backgroundColor: active
                      ? i % 3 === 0 ? "#D4A843" : i % 3 === 1 ? "#E85D4A" : "#c4943a"
                      : "#333",
                    transition: "height 0.4s ease, background-color 0.4s ease",
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            {/* Play button */}
            <button
              onClick={toggleDemoPlay}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {demoPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Track info + LUFS */}
            <div className="flex-1">
              <p className="text-sm font-semibold">Sample Track</p>
              <p className="text-xs mt-0.5" style={{ color: "#777" }}>
                {abDemo === "before" ? "Unmastered · −23 LUFS · Raw mix" : "AI Mastered · −14 LUFS · Spotify-ready"}
              </p>
            </div>

            {/* LUFS pill */}
            <div
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg"
              style={abDemo === "after"
                ? { backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }
                : { backgroundColor: "#1A1A1A", color: "#555" }}
            >
              {abDemo === "before" ? "−23 LUFS" : "−14 LUFS"}
            </div>
          </div>

          {/* Platform loudness targets */}
          {abDemo === "after" && (
            <div className="mt-4 pt-4 border-t border-[#1A1A1A] grid grid-cols-4 gap-2">
              {[
                { name: "Spotify",     lufs: "−14" },
                { name: "Apple",       lufs: "−16" },
                { name: "YouTube",     lufs: "−13" },
                { name: "WAV Master",  lufs: "0"   },
              ].map((p) => (
                <div key={p.name} className="text-center">
                  <div className="text-xs font-bold" style={{ color: "#D4A843" }}>{p.lufs}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#555" }}>{p.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Free preview callout ─────────────────────────────────────────── */}
      <section className="border-y border-[#1A1A1A] py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center gap-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A" }}
          >
            <Play size={22} style={{ color: "#D4A843" }} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold text-base">Free 30-second preview — always</p>
            <p className="text-sm mt-1" style={{ color: "#777" }}>
              Before you pay for your full master, we generate a free preview of the highest-energy
              section so you can hear exactly what the AI will do to your track.
            </p>
          </div>
          <button
            onClick={() => startWizard("STANDARD", "MASTER_ONLY")}
            className="shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold border transition-all hover:border-[#D4A843] hover:text-[#D4A843]"
            style={{ borderColor: "#2A2A2A", color: "#ccc" }}
          >
            Hear your preview
          </button>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">
          Everything a professional mastering studio gives you
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-start gap-4 p-5 rounded-2xl border"
              style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {f.icon}
              </div>
              <div>
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#777" }}>{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { n: "1", label: "Upload",    body: "Drop your stereo mix or up to 16 individual stems" },
            { n: "2", label: "Direct",    body: "Describe how you want it to sound in plain language" },
            { n: "3", label: "Process",   body: "AI analyzes, mixes, and masters in 4–7 minutes" },
            { n: "4", label: "Download",  body: "Pick your favorite version, download platform-ready files" },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black mx-auto mb-3"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {s.n}
              </div>
              <p className="font-bold text-sm mb-1">{s.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-20" id="pricing">
        <h2 className="text-2xl font-bold text-center mb-3">Simple pricing</h2>
        <p className="text-sm text-center mb-10" style={{ color: "#777" }}>
          Pay per track. <Link href="/pricing" className="underline hover:text-white transition-colors">Subscribe</Link> for up to 50% off.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={cn(
                "rounded-2xl border p-6 flex flex-col",
                p.highlight ? "border-[#D4A843]" : "border-[#2A2A2A]"
              )}
              style={{ backgroundColor: p.highlight ? "#111" : "#0D0D0D" }}
            >
              {p.highlight && (
                <div
                  className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded mb-3 self-start"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  Most popular
                </div>
              )}
              <h3 className="font-bold text-base mb-1">{p.name}</h3>
              <p className="text-xs mb-4" style={{ color: "#777" }}>{p.mode}</p>
              <div className="text-3xl font-black mb-6">{p.price}</div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <Check size={13} className="shrink-0 mt-0.5" style={{ color: "#D4A843" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startWizard(p.tier, p.modeValue)}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                )}
                style={
                  p.highlight
                    ? { backgroundColor: "#E85D4A", color: "#fff" }
                    : { backgroundColor: "#1A1A1A", color: "#ccc", border: "1px solid #2A2A2A" }
                }
              >
                Start for {p.price}
              </button>
            </div>
          ))}
        </div>

        <div
          className="mt-6 p-4 rounded-xl border text-center"
          style={{ backgroundColor: "rgba(212,168,67,0.05)", borderColor: "rgba(212,168,67,0.3)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
            IndieThis subscribers get up to 50% off every master
          </p>
          <Link
            href="/pricing"
            className="text-xs mt-1 inline-flex items-center gap-1 hover:underline"
            style={{ color: "#D4A843" }}
          >
            See subscriber pricing <ChevronRight size={12} />
          </Link>
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-[#1A1A1A] py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to hear it?</h2>
        <p className="text-sm mb-8" style={{ color: "#777" }}>
          Free 30-second preview. No account needed to listen.
        </p>
        <button
          onClick={() => startWizard("PREMIUM", "MASTER_ONLY")}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all hover:opacity-90"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          Get a free preview <ChevronRight size={18} />
        </button>
      </section>

    </div>
  );
}
