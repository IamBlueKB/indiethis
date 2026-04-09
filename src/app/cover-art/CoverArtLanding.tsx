"use client";

/**
 * CoverArtLanding v3 — Cover Art Studio premium landing page.
 *
 * 6 Acts:
 *   1. Hero — staggered 2x2 album grid + headline + CTA
 *   2. Gallery — tight 2x3 genre grid with whileInView reveals
 *   3. Transformation — before/after drag slider
 *   4. How It Works — 3 steps
 *   5. Pricing — tier cards + subscriber upsell
 *   6. Exit — morph crossfade loop
 *
 * Rules:
 *   - viewport={{ once: false }} on ALL animations
 *   - No sticky sections, no 300vh scroll sequences
 *   - No empty space
 *   - Gold accent: #D4A843
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Check, Sparkles, ChevronRight, Play } from "lucide-react";

// ─── Image paths ──────────────────────────────────────────────────────────────

const H  = "/images/cover-art-hero";
const E  = "/images/cover-art-examples";
const C  = "/images/cover-art-comparison";

const IMG = {
  // Hero 2x2 grid
  heroMoody:      `${H}/hero-moody.png`,
  heroStreet:     `${H}/hero-street.png`,
  heroChrome:     `${H}/hero-chrome.png`,
  heroCinematic:  `${H}/hero-cinematic.png`,
  // Genre gallery (existing)
  hiphop:         `${E}/hiphop-trap.png`,
  rnb:            `${E}/rnb-soul.png`,
  pop:            `${E}/pop.png`,
  indie:          `${E}/indie-alternative.png`,
  electronic:     `${E}/electronic-edm.png`,
  acoustic:       `${E}/acoustic-singer-songwriter.png`,
  // Blur backgrounds
  vibrant:        `${E}/vibrant-illustrated.png`,
  psychedelic:    `${E}/psychedelic.png`,
  smoke:          `${E}/smoke-shadow.png`,
  gothic:         `${E}/gothic-portrait.png`,
  // Before/after
  original:       `${C}/original.png`,
  styled:         `${C}/styled.png`,
  // Morph exit loop
  neon:           `${E}/neon-futuristic.png`,
  dark:           `${E}/dark-gritty.png`,
  watercolor:     `${E}/watercolor-dreamy.png`,
  abstract:       `${E}/abstract-geometric.png`,
  collage:        `${E}/collage-mixed-media.png`,
  street:         `${E}/street-photography.png`,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD = "#D4A843";

const GENRE_CARDS = [
  { src: IMG.hiphop,    label: "Hip-Hop / Trap",    alt: "Hip-hop album cover" },
  { src: IMG.rnb,       label: "R&B / Soul",         alt: "R&B album cover" },
  { src: IMG.pop,       label: "Pop",                alt: "Pop album cover" },
  { src: IMG.indie,     label: "Indie / Alternative", alt: "Indie album cover" },
  { src: IMG.electronic,label: "Electronic / EDM",   alt: "Electronic album cover" },
  { src: IMG.acoustic,  label: "Acoustic / Singer-Songwriter", alt: "Acoustic album cover" },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "Describe Your Sound",
    body: "Tell us your genre, mood, and artist name. Or upload a reference photo — a selfie, a landscape, anything that captures your vibe.",
  },
  {
    n: "02",
    title: "Choose Your Style",
    body: "Pick from 15 AI art styles — Smoke & Shadow, Neon Futuristic, Watercolor Dreamy, Street Photography, and more. Preview every style before you pay.",
  },
  {
    n: "03",
    title: "Download in Seconds",
    body: "Get 4–8 high-res cover art variations instantly — ready for Spotify, Apple Music, and every major DSP.",
  },
];

const MORPH_IMAGES = [
  IMG.neon, IMG.gothic, IMG.vibrant, IMG.smoke,
  IMG.psychedelic, IMG.dark, IMG.watercolor, IMG.abstract,
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Staggered 2×2 album grid for the hero section */
function HeroAlbumGrid() {
  const cards = [
    { src: IMG.heroMoody,     rotate: -3, x: 8,  y: 0,  delay: 0 },
    { src: IMG.heroStreet,    rotate:  2, x: -5, y: 6,  delay: 0.1 },
    { src: IMG.heroChrome,    rotate: -1, x: 12, y: -8, delay: 0.2 },
    { src: IMG.heroCinematic, rotate:  4, x: -3, y: 0,  delay: 0.3 },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: "1/1" }}>
      <div className="grid grid-cols-2 gap-3 relative z-10">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85, rotate: card.rotate - 5 }}
            whileInView={{ opacity: 1, scale: 1, rotate: card.rotate }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.6, delay: card.delay, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
            style={{
              translateX: `${card.x}px`,
              translateY: `${card.y}px`,
              zIndex: cards.length - i,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
            className="rounded-xl overflow-hidden aspect-square"
          >
            <img src={card.src} alt="Album cover" className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </div>
      {/* Gold glow behind the grid */}
      <div
        className="absolute inset-0 -z-10 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(212,168,67,0.2) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "scale(1.3)",
        }}
      />
    </div>
  );
}

/** Before/after drag slider */
function TransformationSlider() {
  const [pos, setPos] = useState(50); // percentage
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calcPos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    calcPos(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    calcPos(e.clientX);
  };
  const onPointerUp = () => { dragging.current = false; };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden select-none cursor-ew-resize"
      style={{ aspectRatio: "1/1", maxWidth: 480, margin: "0 auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* After (styled) — full */}
      <img src={IMG.styled} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      {/* Before (original) — clipped */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={IMG.original} alt="Before" className="w-full h-full object-cover" />
      </div>
      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 z-20"
        style={{ left: `${pos}%`, background: GOLD }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 flex items-center justify-center"
          style={{ background: "#0A0A0A", borderColor: GOLD }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8H2M2 8L4 6M2 8L4 10M11 8H14M14 8L12 6M14 8L12 10" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#aaa" }}>BEFORE</div>
      <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(0,0,0,0.7)", color: GOLD }}>AFTER</div>
    </div>
  );
}

/** Morph crossfade exit loop */
function MorphLoop() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % MORPH_IMAGES.length);
        setVisible(true);
      }, 600);
    }, 2800);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <div ref={ref} className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "1/1", maxWidth: 400, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        <motion.img
          key={idx}
          src={MORPH_IMAGES[idx]}
          alt="Cover art example"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </div>
  );
}

/** Sticky nav that appears after scrolling past hero */
function StickyNav({ onStart }: { onStart: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("act1-hero");
    if (!hero) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
          style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(212,168,67,0.15)" }}
        >
          <span className="font-bold text-white tracking-wide" style={{ fontSize: 15 }}>AI Cover Art Studio</span>
          <button
            onClick={onStart}
            className="px-4 py-1.5 rounded-lg font-semibold text-sm"
            style={{ background: GOLD, color: "#0A0A0A" }}
          >
            Get Started →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoverArtLanding({
  userId,
  userTier,
}: {
  userId: string | null;
  userTier: string | null;
}) {
  const router = useRouter();

  const handleStart = useCallback(() => {
    router.push("/cover-art?start=1");
  }, [router]);

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A", color: "#fff" }}>
      <StickyNav onStart={handleStart} />

      {/* ── ACT 1: HERO ─────────────────────────────────────────────────────── */}
      <section
        id="act1-hero"
        className="relative overflow-hidden"
        style={{ paddingTop: 80, paddingBottom: 80 }}
      >
        {/* Gradient mesh background */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: "absolute", width: "60%", height: "60%",
            top: "-10%", left: "-10%",
            background: "radial-gradient(circle, rgba(212,168,67,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
          }} />
          <div style={{
            position: "absolute", width: "50%", height: "50%",
            bottom: "-5%", right: "-5%",
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
          }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: headline */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: "rgba(212,168,67,0.12)", color: GOLD, border: `1px solid rgba(212,168,67,0.3)` }}
            >
              <Sparkles size={12} />
              AI-Powered Album Art
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-black leading-none mb-6"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
            >
              Create Album
              <br />
              <span style={{ color: GOLD }}>Cover Art</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg mb-8"
              style={{ color: "#aaa", lineHeight: 1.6 }}
            >
              Generate 4–8 professional album cover variations in seconds.
              No design skills. No account required. From $6.99.
            </motion.p>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex gap-8 mb-10"
            >
              {[
                { value: "15", label: "Art Styles" },
                { value: "4–8", label: "Variations" },
                { value: "~2 min", label: "To Generate" },
                { value: "1:1", label: "Album-Ready" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="font-black text-2xl" style={{ color: GOLD }}>{s.value}</div>
                  <div className="text-xs" style={{ color: "#666" }}>{s.label}</div>
                </div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-3"
            >
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                <Play size={16} fill="#0A0A0A" />
                Create yours — from $6.99 →
              </button>
            </motion.div>
          </div>

          {/* Right: staggered album grid */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroAlbumGrid />
          </motion.div>
        </div>
      </section>

      {/* ── ACT 2: GALLERY ──────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#0A0A0A" }}>
        {/* Blur art texture backgrounds */}
        <div className="relative">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[IMG.vibrant, IMG.psychedelic, IMG.smoke, IMG.gothic].map((src, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 300,
                  height: 300,
                  top: i < 2 ? "-10%" : "60%",
                  left: i % 2 === 0 ? "-5%" : "75%",
                  backgroundImage: `url(${src})`,
                  backgroundSize: "cover",
                  opacity: 0.07,
                  filter: "blur(70px)",
                  transform: "scale(1.1)",
                  borderRadius: "50%",
                }}
              />
            ))}
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="font-black text-4xl mb-3">Every genre. Every sound.</h2>
              <p style={{ color: "#888" }}>15 AI art styles crafted for real artists.</p>
            </motion.div>

            {/* 2×3 tight grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GENRE_CARDS.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.03 }}
                  className="group relative rounded-xl overflow-hidden cursor-pointer"
                  style={{ aspectRatio: "1/1" }}
                >
                  <img
                    src={card.src}
                    alt={card.alt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Label on hover */}
                  <div
                    className="absolute inset-0 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)" }}
                  >
                    <span className="text-sm font-semibold text-white">{card.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA below gallery */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.5 }}
              className="text-center mt-10"
            >
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                Generate Your Cover Art <ChevronRight size={16} />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── ACT 3: TRANSFORMATION ───────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#0D0D0D" }}>
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Slider */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <TransformationSlider />
          </motion.div>

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-5"
              style={{ background: "rgba(212,168,67,0.12)", color: GOLD, border: `1px solid rgba(212,168,67,0.25)` }}
            >
              BEFORE → AFTER
            </div>
            <h2 className="font-black text-4xl mb-5 leading-tight">
              From selfie to
              <br />
              <span style={{ color: GOLD }}>album-ready</span>
              <br />
              in seconds.
            </h2>
            <p style={{ color: "#888", lineHeight: 1.7, marginBottom: 24 }}>
              Upload a photo — or describe your vision. Our AI transforms it
              into cinematic, professional album cover art that stands out
              on every platform.
            </p>
            <ul className="space-y-3">
              {[
                "Upload any photo or describe your vibe",
                "AI applies professional art direction",
                "Download high-res files, DSP-ready",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "#ccc" }}>
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(212,168,67,0.15)", color: GOLD }}>
                    <Check size={11} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ── ACT 4: HOW IT WORKS ─────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#0A0A0A" }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="font-black text-4xl mb-3">How it works</h2>
            <p style={{ color: "#888" }}>Three steps. No design skills needed.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                className="relative rounded-2xl p-6"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="font-black text-5xl mb-4 leading-none"
                  style={{ color: "rgba(212,168,67,0.2)" }}
                >
                  {step.n}
                </div>
                <h3 className="font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#888" }}>{step.body}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.5 }}
            className="text-center mt-12"
          >
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold"
              style={{ background: GOLD, color: "#0A0A0A" }}
            >
              Start Creating <ChevronRight size={16} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── ACT 5: PRICING ──────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#0D0D0D" }}>
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="font-black text-4xl mb-3">Choose your tier</h2>
            <p style={{ color: "#888" }}>Pay once, download instantly. No subscription required.</p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Standard */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.55 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: "#111", border: "1px solid #2a2a2a" }}
            >
              <p className="font-black text-white text-lg mb-1">Standard</p>
              <p className="font-black text-white text-3xl mb-5">$6.99</p>
              <ul className="space-y-2 flex-1 mb-6">
                {[
                  "4 AI variations",
                  "6 style presets",
                  "Square 1:1 format",
                  "Download instantly",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                    <Check size={12} style={{ color: GOLD }} className="shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStart}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                Start for $6.99
              </button>
            </motion.div>

            {/* Premium */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.55, delay: 0.07 }}
              className="rounded-2xl p-6 flex flex-col relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1a1500 0%, #111 60%)", border: `1px solid rgba(212,168,67,0.5)` }}
            >
              <div
                className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                MOST POPULAR
              </div>
              <p className="font-black text-white text-lg mb-1">Premium</p>
              <p className="font-black text-white text-3xl mb-5">$9.99</p>
              <ul className="space-y-2 flex-1 mb-6">
                {[
                  "4 AI variations",
                  "6 style presets",
                  "Reference image input",
                  "AI prompt enhancement",
                  "Download instantly",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                    <Check size={12} style={{ color: GOLD }} className="shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStart}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                Start for $9.99
              </button>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.55, delay: 0.14 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: "#111", border: "1px solid #2a2a2a" }}
            >
              <p className="font-black text-white text-lg mb-1">Pro</p>
              <p className="font-black text-white text-3xl mb-5">$14.99</p>
              <ul className="space-y-2 flex-1 mb-6">
                {[
                  "8 AI variations",
                  "6 style presets",
                  "Reference image input",
                  "AI prompt enhancement",
                  "1 refinement round",
                  "Download instantly",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                    <Check size={12} style={{ color: GOLD }} className="shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStart}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                Start for $14.99
              </button>
            </motion.div>
          </div>

          {/* Subscriber upsell */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.5 }}
            className="mt-8 p-6 rounded-2xl"
            style={{ background: "rgba(212,168,67,0.07)", border: "1px solid rgba(212,168,67,0.2)" }}
          >
            <p className="text-sm mb-1 font-semibold" style={{ color: GOLD }}>Already on IndieThis?</p>
            <p className="text-sm mb-4" style={{ color: "#aaa" }}>
              Subscribers get cover art from $3.99. Plus music videos, lyric videos, mastering, merch store,
              and an artist page — all for $19/month.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/pricing")}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm border"
                style={{ borderColor: "rgba(212,168,67,0.4)", color: GOLD }}
              >
                View Plans <ChevronRight size={14} />
              </button>
              <button
                onClick={handleStart}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "rgba(255,255,255,0.06)", color: "#aaa" }}
              >
                Continue without account
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ACT 6: EXIT ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#0A0A0A" }}>
        <div className="max-w-5xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Morph loop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <MorphLoop />
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <h2 className="font-black leading-none mb-6" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
              Your next release
              <br />
              deserves art
              <br />
              <span style={{ color: GOLD }}>this good.</span>
            </h2>
            <p className="mb-8 text-lg" style={{ color: "#888", lineHeight: 1.6 }}>
              Your music deserves to be seen. Professional cover art
              in minutes — no agencies, no designers, no big budgets.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStart}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base"
                style={{ background: GOLD, color: "#0A0A0A" }}
              >
                <Play size={16} fill="#0A0A0A" />
                Create Cover Art
              </button>
              <button
                onClick={() => router.push("/pricing")}
                className="px-6 py-4 rounded-xl font-semibold text-sm border"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#ccc" }}
              >
                View All Plans
              </button>
            </div>

            {/* Trust line */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ color: "#555" }}>
              {["No account required", "Instant download", "Album-ready format", "DSP-ready files"].map((t, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Check size={10} style={{ color: GOLD }} />
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer spacer */}
      <div style={{ height: 60, background: "#0A0A0A" }} />
    </div>
  );
}
