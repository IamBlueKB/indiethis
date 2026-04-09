"use client";

/**
 * CoverArtLanding — premium marketing landing page for /cover-art.
 *
 * Shown when the user lands at /cover-art without ?start=1.
 * All CTAs navigate to ?start=1 which renders the GateScreen → wizard.
 */

import { useRouter }  from "next/navigation";
import {
  Wand2, Download, ImageIcon, Sparkles, ChevronRight,
  Check, Layers, Printer, Film,
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

// ─── Example cover ────────────────────────────────────────────────────────────

function ExampleCover({ label, genre, image }: { label: string; genre: string; image: string }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={genre}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        className="absolute inset-0 flex flex-col justify-end p-3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)" }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#D4A843" }}>
          {label}
        </p>
        <p className="text-xs font-semibold text-white leading-tight">{genre}</p>
      </div>
    </div>
  );
}

// ─── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  title, price, features, popular, onStart,
}: {
  title:    string;
  price:    string;
  features: string[];
  popular?: boolean;
  onStart:  () => void;
}) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4 relative"
      style={{
        borderColor:     popular ? "rgba(212,168,67,0.4)" : "#222",
        backgroundColor: popular ? "rgba(212,168,67,0.04)" : "#0F0F0F",
      }}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
          MOST POPULAR
        </div>
      )}
      <div>
        <p className="font-black text-white text-lg">{title}</p>
        <p className="text-3xl font-black text-white mt-1">{price}</p>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
            <Check size={12} style={{ color: "#D4A843" }} className="shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onStart}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all"
        style={{
          backgroundColor: popular ? "#D4A843" : "rgba(255,255,255,0.06)",
          color:           popular ? "#0A0A0A"  : "#ccc",
          border:          popular ? "none"      : "1px solid #2a2a2a",
        }}
      >
        Start for {price}
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  userTier: string | null;
}

const EXAMPLES = [
  { label: "Hip-Hop",    genre: "Hip-Hop / Trap",               image: "/images/cover-art-examples/hiphop-trap.png" },
  { label: "R&B",        genre: "R&B / Soul",                   image: "/images/cover-art-examples/rnb-soul.png" },
  { label: "Pop",        genre: "Pop",                          image: "/images/cover-art-examples/pop.png" },
  { label: "Indie",      genre: "Indie / Alternative",          image: "/images/cover-art-examples/indie-alternative.png" },
  { label: "Electronic", genre: "Electronic / EDM",             image: "/images/cover-art-examples/electronic-edm.png" },
  { label: "Acoustic",   genre: "Acoustic / Singer-Songwriter", image: "/images/cover-art-examples/acoustic-singer-songwriter.png" },
];

export default function CoverArtLanding({ userId, userTier }: Props) {
  const router = useRouter();

  function handleStart() {
    router.push("/cover-art?start=1");
  }

  function scrollToExamples() {
    document.getElementById("examples")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}>
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <ImageIcon size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Cover Art Studio</span>
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
        <div className="absolute inset-0 z-0" style={{ opacity: 0.12 }}>
          <div style={{ background: "radial-gradient(ellipse at 60% 40%, #D4A84330 0%, transparent 70%)" }} className="absolute inset-0" />
          <div style={{ background: "radial-gradient(ellipse at 20% 80%, #6600cc20 0%, transparent 60%)" }} className="absolute inset-0" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}>
            <Sparkles size={11} /> AI-Powered Album Art — no account required
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-5">
            Create Album{" "}
            <span style={{ color: "#D4A843" }}>Cover Art</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-3" style={{ color: "#aaa", lineHeight: 1.6 }}>
            Upload a reference or describe your vision. Get 4 AI-generated variations in album-ready 1:1 format — designed for music.
          </p>

          <p className="text-sm mb-10 font-semibold" style={{ color: "#D4A843" }}>
            No account needed. Pay once. Download + keep forever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-black transition-all hover:scale-105"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <Wand2 size={16} /> Create Cover Art — from $6.99 →
            </button>
            <button
              onClick={scrollToExamples}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all border"
              style={{ borderColor: "#333", color: "#ccc", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              See examples ↓
            </button>
          </div>

          <p className="text-xs mt-6" style={{ color: "#555" }}>
            Results in ~2 minutes &nbsp;·&nbsp; Square 1:1 format &nbsp;·&nbsp; Print-ready resolution
          </p>
        </div>
      </section>

      {/* ── Example gallery ── */}
      <section id="examples" className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-3">See what the AI creates</h2>
        <p className="text-sm text-center mb-8" style={{ color: "#666" }}>
          6 genres. 6 moods. Find yours.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EXAMPLES.map(ex => (
            <ExampleCover key={ex.genre} label={ex.label} genre={ex.genre} image={ex.image} />
          ))}
        </div>
      </section>

      {/* ── Tier cards ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-black text-white text-center mb-8">Choose your tier</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TierCard
            title="Standard"
            price="$6.99"
            features={[
              "4 AI variations",
              "6 style presets",
              "Square 1:1 format",
              "Download instantly",
            ]}
            onStart={handleStart}
          />
          <TierCard
            title="Premium"
            price="$9.99"
            popular
            features={[
              "4 AI variations",
              "6 style presets",
              "Reference image input",
              "Claude prompt enhancement",
              "Download instantly",
            ]}
            onStart={handleStart}
          />
          <TierCard
            title="Pro"
            price="$14.99"
            features={[
              "8 AI variations",
              "6 style presets",
              "Reference image input",
              "Claude prompt enhancement",
              "1 refinement round",
              "Download instantly",
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
            <Feature icon={Layers}     label="6 curated styles"          sub="Cinematic, neon, retro, minimal, abstract, golden hour — each designed for album covers." />
            <Feature icon={Wand2}      label="AI prompt enhancement"     sub="Describe your vision in plain language. Our AI translates it into a precise visual prompt." />
            <Feature icon={ImageIcon}  label="Reference matching"        sub="Upload an image you love. The AI creates artwork inspired by it, not a copy of it." />
            <Feature icon={Printer}    label="Print-ready resolution"    sub="High-resolution square format ready for Spotify, Apple Music, Bandcamp, and physical prints." />
            <Feature icon={Download}   label="Download forever"          sub="Your artwork is yours. No expiry, no watermarks, no subscriptions needed." />
            <Feature icon={Film}       label="Cover to video pipeline"   sub="Turn your cover art into a canvas video or music video with one click." />
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
          <h2 className="text-xl font-black text-white mb-2">Subscribers get cover art from $3.99</h2>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Plus music videos, lyric videos, mastering, merch store, and an artist page — all for $19/month.
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
