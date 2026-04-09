"use client";

/**
 * CoverArtLanding — premium marketing landing page for /cover-art.
 *
 * Shown when the user lands at /cover-art without ?start=1.
 * All CTAs navigate to ?start=1 which renders the GateScreen → wizard.
 *
 * Visual layers (applied in Steps 1–8):
 *   Step 1 — Gradient mesh backgrounds on every section
 *   Step 2 — Blurred cover-art image textures behind sections
 *   Step 3 — Live morph hero: crossfading style images in background
 *   Step 4 — Sticky CTA bar that appears after hero scrolls away
 *   Step 5 — Animated stat counters that count up on scroll-into-view
 *   Step 6 — Floating 3-D album mockup in hero with scroll parallax
 *   Step 7 — Before/after style comparison drag slider
 *   Step 8 — Interactive genre cards that reveal alt style on hover/tap
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
import {
  Wand2, Download, ImageIcon, Sparkles, ChevronRight,
  Check, Layers, Printer, Film, Palette, Grid2x2, Clock, Square,
} from "lucide-react";

// ─── Gradient mesh palettes ───────────────────────────────────────────────────
// Each section gets its own layered radial gradients. Max opacity on any single
// colour stop: 10%. These are atmospheric, not neon — subtlety is intentional.

const HERO_GRADIENT =
  "radial-gradient(ellipse at 20% 50%, rgba(212,168,67,0.08) 0%, transparent 60%), " +
  "radial-gradient(ellipse at 80% 20%, rgba(120,60,180,0.06) 0%, transparent 50%), " +
  "radial-gradient(ellipse at 50% 80%, rgba(40,20,60,0.10) 0%, transparent 70%), " +
  "#0A0A0A";

const GALLERY_GRADIENT =
  "radial-gradient(ellipse at 30% 40%, rgba(0,128,128,0.07) 0%, transparent 60%), " +
  "radial-gradient(ellipse at 75% 70%, rgba(20,40,100,0.08) 0%, transparent 55%), " +
  "radial-gradient(ellipse at 80% 10%, rgba(10,20,80,0.07) 0%, transparent 50%), " +
  "#0A0A0A";

const STATS_GRADIENT =
  "radial-gradient(ellipse at 50% 50%, rgba(212,168,67,0.06) 0%, transparent 65%), " +
  "radial-gradient(ellipse at 15% 80%, rgba(80,30,10,0.08) 0%, transparent 55%), " +
  "#0A0A0A";

const PRICING_GRADIENT =
  "radial-gradient(ellipse at 50% 60%, rgba(30,25,15,0.10) 0%, transparent 70%), " +
  "radial-gradient(ellipse at 20% 20%, rgba(212,168,67,0.05) 0%, transparent 60%), " +
  "radial-gradient(ellipse at 85% 80%, rgba(212,168,67,0.05) 0%, transparent 50%), " +
  "#0A0A0A";

const FEATURES_GRADIENT =
  "radial-gradient(ellipse at 60% 30%, rgba(80,20,120,0.06) 0%, transparent 55%), " +
  "radial-gradient(ellipse at 20% 75%, rgba(40,10,80,0.08) 0%, transparent 60%), " +
  "radial-gradient(ellipse at 90% 60%, rgba(60,15,120,0.06) 0%, transparent 50%), " +
  "#0A0A0A";

const UPSELL_GRADIENT =
  "radial-gradient(ellipse at 40% 60%, rgba(80,40,10,0.08) 0%, transparent 65%), " +
  "radial-gradient(ellipse at 70% 20%, rgba(212,168,67,0.03) 0%, transparent 50%), " +
  "radial-gradient(ellipse at 15% 30%, rgba(60,30,5,0.06) 0%, transparent 55%), " +
  "#0A0A0A";

// ─── Morph hero image set ─────────────────────────────────────────────────────
// 8 of the most visually diverse styles — displayed at low opacity behind hero text.
// Skipping subtle ones (minimalist-typography, clean-gradient, monochrome-film).

const MORPH_IMAGES = [
  "/images/cover-art-examples/neon-futuristic.png",
  "/images/cover-art-examples/gothic-portrait.png",
  "/images/cover-art-examples/vibrant-illustrated.png",
  "/images/cover-art-examples/smoke-shadow.png",
  "/images/cover-art-examples/psychedelic.png",
  "/images/cover-art-examples/dark-gritty.png",
  "/images/cover-art-examples/watercolor-dreamy.png",
  "/images/cover-art-examples/abstract-geometric.png",
];

const MORPH_IMAGES_MOBILE = MORPH_IMAGES.slice(0, 4);

// ─── Stat counter data ────────────────────────────────────────────────────────

const STATS: Array<{
  icon:      React.ElementType;
  value:     number | string;
  label:     string;
  suffix:    string;
  isNumeric: boolean;
  prefix?:   string;
}> = [
  { icon: Palette,  value: 15,    label: "Art Styles",               suffix: "",    isNumeric: true },
  { icon: Grid2x2,  value: 4,     label: "Variations Per Generation", suffix: "–8", isNumeric: true },
  { icon: Clock,    value: 2,     label: "Minutes to Create",         suffix: "",   isNumeric: true, prefix: "~" },
  { icon: Square,   value: "1:1", label: "Album-Ready Format",        suffix: "",   isNumeric: false },
];

// ─── Genre examples ───────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label:          "Hip-Hop",
    genre:          "Hip-Hop / Trap",
    image:          "/images/cover-art-examples/hiphop-trap.png",
    primaryStyle:   "Dark & Gritty",
    altImage:       "/images/cover-art-examples/hiphop-alt.png",
    altStyle:       "Neon Futuristic",
  },
  {
    label:          "R&B",
    genre:          "R&B / Soul",
    image:          "/images/cover-art-examples/rnb-soul.png",
    primaryStyle:   "Smoke & Shadow",
    altImage:       "/images/cover-art-examples/rnb-alt.png",
    altStyle:       "Watercolor Dreamy",
  },
  {
    label:          "Pop",
    genre:          "Pop",
    image:          "/images/cover-art-examples/pop.png",
    primaryStyle:   "Vibrant Illustrated",
    altImage:       "/images/cover-art-examples/pop-alt.png",
    altStyle:       "Abstract Geometric",
  },
  {
    label:          "Indie",
    genre:          "Indie / Alternative",
    image:          "/images/cover-art-examples/indie-alternative.png",
    primaryStyle:   "Vintage Vinyl",
    altImage:       "/images/cover-art-examples/indie-alt.png",
    altStyle:       "Monochrome Film",
  },
  {
    label:          "Electronic",
    genre:          "Electronic / EDM",
    image:          "/images/cover-art-examples/electronic-edm.png",
    primaryStyle:   "Neon Futuristic",
    altImage:       "/images/cover-art-examples/electronic-alt.png",
    altStyle:       "Psychedelic",
  },
  {
    label:          "Acoustic",
    genre:          "Acoustic / Singer-Songwriter",
    image:          "/images/cover-art-examples/acoustic-singer-songwriter.png",
    primaryStyle:   "Watercolor Dreamy",
    altImage:       "/images/cover-art-examples/acoustic-alt.png",
    altStyle:       "Clean Gradient",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ─── Feature item ─────────────────────────────────────────────────────────────

function Feature({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
      >
        <Icon size={14} style={{ color: "#D4A843" }} />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#666" }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Tier card ────────────────────────────────────────────────────────────────

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
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
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

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  duration = 1.5,
  prefix = "",
  suffix = "",
}: {
  target:    number;
  duration?: number;
  prefix?:   string;
  suffix?:   string;
}) {
  const [count, setCount] = useState(0);
  const ref               = useRef<HTMLSpanElement>(null);
  const isInView          = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!isInView) return;
    let current = 0;
    const step  = target / (duration * 60);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {prefix}{count}{suffix}
    </span>
  );
}

// ─── Interactive genre card ───────────────────────────────────────────────────

function GenreCard({
  label, genre, image, primaryStyle, altImage, altStyle,
}: {
  label:        string;
  genre:        string;
  image:        string;
  primaryStyle: string;
  altImage:     string;
  altStyle:     string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  function toggle() {
    setFlipped(f => !f);
    setHintVisible(false);
  }

  return (
    <div
      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group select-none"
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={toggle}
    >
      {/* Primary image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={genre}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: flipped ? 0 : 1 }}
      />
      {/* Alt image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={altImage}
        alt={`${genre} — ${altStyle}`}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: flipped ? 1 : 0 }}
      />

      {/* Bottom label */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)" }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#D4A843" }}>
          {label}
        </p>
        <p className="text-xs font-semibold text-white leading-tight transition-all duration-500">
          {flipped ? altStyle : primaryStyle}
        </p>
      </div>

      {/* Hover hint — disappears on first interact */}
      {hintVisible && (
        <div
          className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.6)" }}
        >
          Hover to remix ✦
        </div>
      )}
    </div>
  );
}

// ─── Blur background layer ────────────────────────────────────────────────────
// Heavily blurred, very low opacity cover art image used as atmospheric texture.
// Sits BELOW the gradient mesh in z-order (z-index: 0). Content at z-index: 10.

function BlurBg({ src, opacity = 0.07 }: { src: string; opacity?: number }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:    `url('${src}')`,
        backgroundSize:     "cover",
        backgroundPosition: "center",
        opacity,
        filter:             "blur(70px)",
        transform:          "scale(1.1)",
        zIndex:             0,
      }}
    />
  );
}

// ─── Style comparison slider ──────────────────────────────────────────────────

function StyleComparisonSlider() {
  const [position,  setPosition]  = useState(50);
  const [dragging,  setDragging]  = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  function clamp(v: number) { return Math.max(2, Math.min(98, v)); }

  function getPos(clientX: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  }

  // Mouse
  function onMouseDown() { setDragging(true); }
  function onMouseUp()   { setDragging(false); }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    getPos(e.clientX);
  }

  // Touch
  function onTouchMove(e: React.TouchEvent) {
    getPos(e.touches[0].clientX);
  }

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md mx-auto rounded-xl overflow-hidden"
      style={{
        aspectRatio: "1/1",
        cursor: "ew-resize",
        border: "1px solid rgba(212,168,67,0.12)",
        userSelect: "none",
        touchAction: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchMove={onTouchMove}
    >
      {/* "After" (styled) — full width base layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/cover-art-comparison/after.png"
        alt="After — styled album cover"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* "Before" (raw) — clipped to slider position */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/cover-art-comparison/before.png"
          alt="Before — unprocessed reference photo"
          className="absolute inset-0 h-full object-cover"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-px z-10"
        style={{ left: `${position}%`, backgroundColor: "rgba(255,255,255,0.75)" }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center rounded-full shadow-lg"
          style={{
            width:           40,
            height:          40,
            backgroundColor: "rgba(255,255,255,0.92)",
            border:          "2px solid #D4A843",
          }}
        >
          <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 700, letterSpacing: -1 }}>↔</span>
        </div>
      </div>

      {/* Labels */}
      <span
        className="absolute top-3 left-3 text-xs font-semibold rounded px-2 py-1"
        style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.75)" }}
      >
        Before
      </span>
      <span
        className="absolute top-3 right-3 text-xs font-semibold rounded px-2 py-1"
        style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.75)" }}
      >
        After
      </span>
    </div>
  );
}

// ─── Floating 3-D album mockup ────────────────────────────────────────────────
// Base transform: rotateY(-8deg) rotateX(3deg) per spec.
// Scroll parallax shifts these values slightly (±3deg) for a living feel.

function FloatingMockup() {
  const { scrollYProgress } = useScroll();
  // Subtle scroll-driven parallax shift around the static base values
  const rotY       = useTransform(scrollYProgress, [0, 1], [-8, -5]);
  const rotX       = useTransform(scrollYProgress, [0, 1], [3,   0]);
  const translateY = useTransform(scrollYProgress, [0, 1], [0,  -20]);

  return (
    <motion.div
      className="relative hidden md:block shrink-0"
      style={{
        perspective: "1000px",
        width:       300,
        height:      300,
        translateY,
      }}
    >
      {/* Gold glow layer — sits behind the image */}
      <div
        style={{
          position:     "absolute",
          inset:        -20,
          borderRadius: 24,
          boxShadow:    "0 0 80px rgba(212,168,67,0.10)",
          zIndex:       0,
          pointerEvents: "none",
        }}
      />

      <motion.div
        style={{
          rotateY:      rotY,
          rotateX:      rotX,
          position:     "relative",
          zIndex:       1,
          width:        "100%",
          height:       "100%",
          borderRadius: 16,
          overflow:     "hidden",
          boxShadow:    "0 25px 60px rgba(0,0,0,0.50)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/cover-art-examples/neon-futuristic.png"
          alt="Cover art mockup"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </motion.div>

      {/* Reflection */}
      <div
        style={{
          position:        "absolute",
          left:            0,
          right:           0,
          top:             "calc(100% + 8px)",
          height:          70,
          overflow:        "hidden",
          transform:       "scaleY(-1)",
          opacity:         0.10,
          filter:          "blur(4px)",
          borderRadius:    "0 0 16px 16px",
          maskImage:       "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          zIndex:          0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/cover-art-examples/neon-futuristic.png"
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  userTier: string | null;
}

export default function CoverArtLanding({ userId, userTier: _userTier }: Props) {
  const router = useRouter();

  // ── Morph hero state ──────────────────────────────────────────────────────
  const [morphIndex, setMorphIndex] = useState(0);
  const [isMobile,   setIsMobile]   = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const morphSet = isMobile ? MORPH_IMAGES_MOBILE : MORPH_IMAGES;

  useEffect(() => {
    const id = setInterval(() => {
      setMorphIndex(i => (i + 1) % morphSet.length);
    }, 4000);
    return () => clearInterval(id);
  }, [morphSet.length]);

  // ── Sticky bar state ──────────────────────────────────────────────────────
  const heroRef      = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function handleStart() { router.push("/cover-art?start=1"); }
  function scrollToExamples() {
    document.getElementById("examples")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* ── Sticky CTA bar (Step 4) ── */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{    y: -48, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6"
            style={{
              height:          48,
              backgroundColor: "rgba(10,10,10,0.95)",
              backdropFilter:  "blur(12px)",
              borderBottom:    "1px solid rgba(212,168,67,0.15)",
            }}
          >
            {/* Left */}
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
              >
                <ImageIcon size={10} style={{ color: "#D4A843" }} />
              </div>
              <span className="text-xs font-bold text-white hidden sm:block">Cover Art Studio</span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              <span className="text-xs hidden sm:block" style={{ color: "#888" }}>
                Create your cover art — from $6.99
              </span>
              <span className="text-xs sm:hidden" style={{ color: "#888" }}>From $6.99</span>
              <button
                onClick={handleStart}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition hover:opacity-90"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ChevronRight size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Site header ── */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}
      >
        <a href="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
          >
            <ImageIcon size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Cover Art Studio</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
          >
            by IndieThis
          </span>
        </a>
        <div className="flex items-center gap-2">
          {!userId && (
            <a href="/login" className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ color: "#888" }}>
              Sign In
            </a>
          )}
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition hover:opacity-90"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Get Started <ChevronRight size={12} />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO
          Stack: morph images (Step 3) → gradient mesh (Step 1) → 3D mockup + text
      ═══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ background: HERO_GRADIENT }}
      >
        {/* Step 3 — Morph background images: crossfade every 4s, 2s transition */}
        {morphSet.map((src, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity:            i === morphIndex ? 0.18 : 0,
              filter:             "blur(40px)",
              transform:          "scale(1.12)",
              transition:         "opacity 2000ms ease-in-out",
              zIndex:             0,
            }}
          />
        ))}

        {/* Step 2 — dark overlay so text stays legible */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: "linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.35) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-24">
          {/* Desktop: side-by-side text + mockup | Mobile: stacked */}
          <div className="flex flex-col md:flex-row items-center gap-12">

            {/* Left — headline copy */}
            <div className="flex-1 text-center md:text-left">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
                style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
              >
                <Sparkles size={11} /> AI-Powered Album Art — no account required
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-5">
                Create Album{" "}
                <span style={{ color: "#D4A843" }}>Cover Art</span>
              </h1>

              <p className="text-lg sm:text-xl mb-3 md:max-w-lg" style={{ color: "#aaa", lineHeight: 1.6 }}>
                Upload a reference or describe your vision. Get 4 AI-generated variations in album-ready 1:1 format — designed for music.
              </p>

              <p className="text-sm mb-8 font-semibold" style={{ color: "#D4A843" }}>
                No account needed. Pay once. Download + keep forever.
              </p>

              <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3">
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

            {/* Right — floating 3D album mockup (Step 6, desktop only) */}
            <FloatingMockup />

          </div>

          {/* Mobile mockup — centered below CTA buttons */}
          <div
            className="md:hidden mt-10 flex justify-center"
            style={{ perspective: "800px" }}
          >
            <div style={{ position: "relative" }}>
              {/* Gold glow behind */}
              <div style={{
                position:  "absolute", inset: -16, borderRadius: 20,
                boxShadow: "0 0 60px rgba(212,168,67,0.10)", pointerEvents: "none",
              }} />
              <div
                style={{
                  position:     "relative",
                  width:        220,
                  height:       220,
                  borderRadius: 12,
                  overflow:     "hidden",
                  transform:    "rotateY(-8deg) rotateX(3deg)",
                  boxShadow:    "0 20px 50px rgba(0,0,0,0.50)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/cover-art-examples/neon-futuristic.png"
                  alt="Cover art example"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          STAT COUNTERS (Step 5)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: STATS_GRADIENT }}>
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl"
                  style={{ border: "1px solid rgba(212,168,67,0.10)", backgroundColor: "rgba(212,168,67,0.02)" }}
                >
                  <Icon size={22} style={{ color: "#D4A843" }} />
                  <p className="font-black text-white" style={{ fontSize: 40, lineHeight: 1 }}>
                    {stat.isNumeric ? (
                      <AnimatedCounter
                        target={stat.value as number}
                        prefix={stat.prefix ?? ""}
                        suffix={stat.suffix}
                      />
                    ) : (
                      <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      >
                        {String(stat.value)}
                      </motion.span>
                    )}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "#666" }}>{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          GENRE GALLERY (Step 8 — interactive cards)
          Background: Step 1 gradient + Step 2 blur layer
      ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="examples"
        className="relative overflow-hidden"
        style={{ background: GALLERY_GRADIENT }}
      >
        {/* Step 2 — blurred atmospheric bg */}
        <BlurBg src="/images/cover-art-examples/vibrant-illustrated.png" opacity={0.055} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-black text-white text-center mb-2">See what the AI creates</h2>
          <p className="text-sm text-center mb-2" style={{ color: "#666" }}>
            6 genres. 6 moods. Find yours.
          </p>
          <p className="text-xs text-center mb-8" style={{ color: "#555" }}>
            Hover to see another style. Same vision, infinite looks.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EXAMPLES.map(ex => (
              <GenreCard key={ex.genre} {...ex} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          STYLE COMPARISON SLIDER (Step 7)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: PRICING_GRADIENT }}>
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-black text-white mb-2">See the transformation</h2>
          <p className="text-sm mb-8" style={{ color: "#777" }}>
            Drag to compare. Your reference photo becomes album-ready artwork.
          </p>
          <StyleComparisonSlider />
          <p className="text-xs mt-6" style={{ color: "#555" }}>
            AI doesn't just filter your image — it reimagines it.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TIER CARDS
          Background: Step 1 gradient
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: PRICING_GRADIENT }}>
        <BlurBg src="/images/cover-art-examples/smoke-shadow.png" opacity={0.05} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE GRID
          Background: Step 1 gradient + Step 2 blur layer
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: FEATURES_GRADIENT }}>
        <BlurBg src="/images/cover-art-examples/neon-futuristic.png" opacity={0.055} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-2xl border p-8" style={{ borderColor: "#1E1E1E", backgroundColor: "rgba(15,15,15,0.85)" }}>
            <h2 className="text-xl font-black text-white mb-8 text-center">
              Everything you need, nothing you don&rsquo;t
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <Feature icon={Layers}    label="6 curated styles"        sub="Cinematic, neon, retro, minimal, abstract, golden hour — each designed for album covers." />
              <Feature icon={Wand2}     label="AI prompt enhancement"   sub="Describe your vision in plain language. Our AI translates it into a precise visual prompt." />
              <Feature icon={ImageIcon} label="Reference matching"      sub="Upload an image you love. The AI creates artwork inspired by it, not a copy of it." />
              <Feature icon={Printer}   label="Print-ready resolution"  sub="High-resolution square format ready for Spotify, Apple Music, Bandcamp, and physical prints." />
              <Feature icon={Download}  label="Download forever"        sub="Your artwork is yours. No expiry, no watermarks, no subscriptions needed." />
              <Feature icon={Film}      label="Cover to video pipeline" sub="Turn your cover art into a canvas video or music video with one click." />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SUBSCRIBER UPSELL
          Background: Step 1 gradient + Step 2 blur layer
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: UPSELL_GRADIENT }}>
        <BlurBg src="/images/cover-art-examples/vintage-vinyl.png" opacity={0.055} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
          <div
            className="rounded-2xl border px-8 py-8 text-center"
            style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.04)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#D4A843" }}>
              Already on IndieThis?
            </p>
            <h2 className="text-xl font-black text-white mb-2">Subscribers get cover art from $3.99</h2>
            <p className="text-sm mb-6" style={{ color: "#888" }}>
              Plus music videos, lyric videos, mastering, merch store, and an artist page — all for $19/month.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/pricing"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border no-underline"
                style={{ borderColor: "rgba(212,168,67,0.4)", color: "#D4A843" }}
              >
                View Plans <ChevronRight size={14} />
              </a>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "#333", color: "#888" }}
              >
                Continue without account
              </button>
            </div>
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
