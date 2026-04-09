"use client";

/**
 * CoverArtLanding — scroll-driven art gallery landing page for /cover-art.
 *
 * Architecture: 7 Acts that reveal the product through the art itself.
 * Each act manages its own scroll animations. Color shifts between acts make
 * the page feel alive. The artist doesn't read about cover art — they experience it.
 *
 * Image base: /public/images/cover-art-examples/*.png (no separate styles dir)
 * Comparison: /public/images/cover-art-comparison/{before,after}.png
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  motion, AnimatePresence,
  useScroll, useTransform, useInView,
} from "framer-motion";
import { ChevronDown, Check, Sparkles, ChevronRight, X } from "lucide-react";

// ─── Image paths ──────────────────────────────────────────────────────────────
// All files are .png in /images/cover-art-examples/ — no separate styles dir.

const E = "/images/cover-art-examples";
const C = "/images/cover-art-comparison";

const IMG = {
  hiphop:               `${E}/hiphop-trap.png`,
  rnb:                  `${E}/rnb-soul.png`,
  pop:                  `${E}/pop.png`,
  indie:                `${E}/indie-alternative.png`,
  electronic:           `${E}/electronic-edm.png`,
  acoustic:             `${E}/acoustic-singer-songwriter.png`,
  vibrantIllustrated:   `${E}/vibrant-illustrated.png`,
  smokeShadow:          `${E}/smoke-shadow.png`,
  psychedelic:          `${E}/psychedelic.png`,
  gothicPortrait:       `${E}/gothic-portrait.png`,
  neonFuturistic:       `${E}/neon-futuristic.png`,
  darkGritty:           `${E}/dark-gritty.png`,
  watercolorDreamy:     `${E}/watercolor-dreamy.png`,
  abstractGeometric:    `${E}/abstract-geometric.png`,
  minimalistTypography: `${E}/minimalist-typography.png`,
  monochromeFilm:       `${E}/monochrome-film.png`,
  cleanGradient:        `${E}/clean-gradient.png`,
  vintageVinyl:         `${E}/vintage-vinyl.png`,
  streetPhotography:    `${E}/street-photography.png`,
  photoRealPortrait:    `${E}/photo-real-portrait.png`,
  collage:              `${E}/collage-mixed-media.png`,
  before:               `${C}/before.png`,
  after:                `${C}/after.png`,
};

// ─── Color system ─────────────────────────────────────────────────────────────
// Each act has its own background color + radial gradient accent.
// Shifts are subtle (1-2 hex digits) so sections bleed together naturally.

const PAGE_COLORS = [
  { bg: "#0a0a0a", accent: "rgba(212,168,67,0.08)"  }, // Act 1: deep black + gold
  { bg: "#0c0a10", accent: "rgba(120,60,180,0.06)"  }, // Act 2: hint of purple
  { bg: "#0a0d0d", accent: "rgba(0,128,128,0.06)"   }, // Act 3: teal undertone
  { bg: "#0d0a10", accent: "rgba(100,40,160,0.07)"  }, // Act 4: purple gallery
  { bg: "#0a0a0a", accent: "rgba(212,168,67,0.04)"  }, // Act 5: clean
  { bg: "#0d0b08", accent: "rgba(180,120,40,0.07)"  }, // Act 6: warm brown
  { bg: "#0a0a0a", accent: "rgba(212,168,67,0.10)"  }, // Act 7: gold finale
] as const;

function actBg(i: number, pos1 = "20% 40%", pos2 = "75% 70%") {
  const { bg, accent } = PAGE_COLORS[i];
  return `
    radial-gradient(ellipse at ${pos1}, ${accent} 0%, transparent 60%),
    radial-gradient(ellipse at ${pos2}, ${accent} 0%, transparent 50%),
    ${bg}
  `;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GALLERY_ITEMS = [
  { genre: "HIP-HOP",    title: "Hip-Hop / Trap",              style: "Dark & Gritty",        image: IMG.hiphop    },
  { genre: "R&B",        title: "R&B / Soul",                  style: "Smoke & Shadow",       image: IMG.rnb       },
  { genre: "POP",        title: "Pop",                         style: "Vibrant Illustrated",  image: IMG.pop       },
  { genre: "INDIE",      title: "Indie / Alternative",         style: "Vintage Vinyl",        image: IMG.indie     },
  { genre: "ELECTRONIC", title: "Electronic / EDM",            style: "Neon Futuristic",      image: IMG.electronic },
  { genre: "ACOUSTIC",   title: "Acoustic / Singer-Songwriter",style: "Watercolor Dreamy",    image: IMG.acoustic  },
];

const STYLE_ITEMS = [
  { name: "Minimalist Typography", image: IMG.minimalistTypography, category: "Minimal"      },
  { name: "Clean Gradient",        image: IMG.cleanGradient,        category: "Minimal"      },
  { name: "Dark & Gritty",         image: IMG.darkGritty,           category: "Dark"         },
  { name: "Smoke & Shadow",        image: IMG.smokeShadow,          category: "Dark"         },
  { name: "Gothic Portrait",       image: IMG.gothicPortrait,       category: "Dark"         },
  { name: "Vibrant Illustrated",   image: IMG.vibrantIllustrated,   category: "Vibrant"      },
  { name: "Neon Futuristic",       image: IMG.neonFuturistic,       category: "Vibrant"      },
  { name: "Watercolor Dreamy",     image: IMG.watercolorDreamy,     category: "Vibrant"      },
  { name: "Psychedelic",           image: IMG.psychedelic,          category: "Experimental" },
  { name: "Abstract Geometric",    image: IMG.abstractGeometric,    category: "Experimental" },
  { name: "Collage Mixed Media",   image: IMG.collage,              category: "Experimental" },
  { name: "Vintage Vinyl",         image: IMG.vintageVinyl,         category: "Classic"      },
  { name: "Monochrome Film",       image: IMG.monochromeFilm,       category: "Classic"      },
  { name: "Street Photography",    image: IMG.streetPhotography,    category: "Classic"      },
  { name: "Photo Real Portrait",   image: IMG.photoRealPortrait,    category: "Classic"      },
] as const;

const CATEGORIES = ["All", "Minimal", "Dark", "Vibrant", "Classic", "Experimental"] as const;
type Category = (typeof CATEGORIES)[number];

const STEPS = [
  { number: "1", title: "Describe",  desc: "Tell us your vision in plain language — or upload a reference image." },
  { number: "2", title: "Generate",  desc: "AI creates 4–8 unique variations in your chosen style, album-ready."  },
  { number: "3", title: "Download",  desc: "Pick your favorite. Download in high resolution. Release it."          },
];

const TIERS = [
  {
    title: "Standard", price: "$6.99", popular: false,
    features: [
      { text: "4 AI variations",        ok: true  },
      { text: "6 style presets",         ok: true  },
      { text: "Reference image input",   ok: false },
      { text: "AI prompt enhancement",   ok: false },
      { text: "Refinement round",        ok: false },
      { text: "Download instantly",      ok: true  },
    ],
  },
  {
    title: "Premium", price: "$9.99", popular: true,
    features: [
      { text: "4 AI variations",         ok: true  },
      { text: "6 style presets",         ok: true  },
      { text: "Reference image input",   ok: true  },
      { text: "AI prompt enhancement",   ok: true  },
      { text: "Refinement round",        ok: false },
      { text: "Download instantly",      ok: true  },
    ],
  },
  {
    title: "Pro", price: "$14.99", popular: false,
    features: [
      { text: "8 AI variations",         ok: true  },
      { text: "6 style presets",         ok: true  },
      { text: "Reference image input",   ok: true  },
      { text: "AI prompt enhancement",   ok: true  },
      { text: "Refinement round (1)",    ok: true  },
      { text: "Download instantly",      ok: true  },
    ],
  },
];

const MORPH_IMAGES = [
  IMG.neonFuturistic,
  IMG.gothicPortrait,
  IMG.vibrantIllustrated,
  IMG.smokeShadow,
  IMG.psychedelic,
  IMG.darkGritty,
  IMG.watercolorDreamy,
  IMG.abstractGeometric,
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Blurred cover-art image used as atmospheric depth layer behind section content. */
function BlurBg({ src }: { src: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        backgroundImage:    `url('${src}')`,
        backgroundSize:     "cover",
        backgroundPosition: "center",
        filter:             "blur(70px)",
        opacity:            0.08,
        transform:          "scale(1.2)",
      }}
    />
  );
}

// ─── Sticky CTA Nav ───────────────────────────────────────────────────────────

function StickyNav() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("act1-hero");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 md:px-8"
          style={{
            backdropFilter:  "blur(14px)",
            backgroundColor: "rgba(10,10,10,0.85)",
            borderBottom:    "1px solid rgba(212,168,67,0.12)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Cover Art Studio</span>
            <span
              className="text-xs px-2 py-0.5 rounded hidden sm:inline"
              style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
            >
              by IndieThis
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm" style={{ color: "#888" }}>From $6.99</span>
            <a
              href="/cover-art?start=1"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              Get Started →
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Act 1: THE ENTRANCE ──────────────────────────────────────────────────────

function Act1Hero({ reducedMotion }: { reducedMotion: boolean }) {
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const handler = () => setShowScrollHint(window.scrollY < 100);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const fadeIn = (delay: number) =>
    reducedMotion
      ? {}
      : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay } };

  return (
    <section
      id="act1-hero"
      className="relative overflow-hidden min-h-screen flex flex-col"
      style={{ background: actBg(0) }}
    >
      <BlurBg src={IMG.vibrantIllustrated} />

      {/* Dark bottom fade so scroll hint is readable */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-10"
        style={{ background: "linear-gradient(to top, #0a0a0a 0%, transparent 100%)" }}
      />

      <div className="relative z-10 flex-1 flex items-center max-w-6xl mx-auto w-full px-6 py-24 md:py-32">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16 w-full">

          {/* ── Left col: copy ── */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">

            {/* Gold pill badge */}
            <motion.div
              {...(reducedMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.5 } })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
              style={{ border: "1px solid rgba(212,168,67,0.3)", color: "#D4A843", backgroundColor: "rgba(212,168,67,0.06)" }}
            >
              <Sparkles size={11} /> AI-Powered Album Art — no account required
            </motion.div>

            {/* Headline */}
            <motion.h1
              {...fadeIn(0.3)}
              className="font-black leading-tight mb-5"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.02em" }}
            >
              Create Album{" "}
              <span style={{ color: "#D4A843" }}>Cover Art</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              {...fadeIn(0.6)}
              className="text-lg md:text-xl mb-3 max-w-md"
              style={{ color: "#aaa", lineHeight: 1.6 }}
            >
              Upload a reference or describe your vision. Get 4 AI-generated variations in album-ready 1:1 format — designed for music.
            </motion.p>

            {/* Gold subtext */}
            <motion.p
              {...fadeIn(0.8)}
              className="text-sm font-semibold mb-8"
              style={{ color: "#D4A843" }}
            >
              No account needed. Pay once. Download + keep forever.
            </motion.p>

            {/* CTA */}
            <motion.div {...fadeIn(1.0)}>
              <a
                href="/cover-art?start=1"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-black transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                Create yours — from $6.99 →
              </a>
            </motion.div>
          </div>

          {/* ── Right col (desktop): floating 3D mockup ── */}
          <div className="hidden md:block shrink-0">
            <HeroMockup reducedMotion={reducedMotion} />
          </div>
        </div>
      </div>

      {/* Mobile mockup: below headline, above fold */}
      <div className="md:hidden relative z-10 flex justify-center pb-10">
        <HeroMockup reducedMotion={reducedMotion} mobile />
      </div>

      {/* Scroll hint */}
      <AnimatePresence>
        {showScrollHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1"
          >
            <motion.div
              animate={reducedMotion ? {} : { opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown size={22} style={{ color: "rgba(255,255,255,0.5)" }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HeroMockup({ reducedMotion, mobile }: { reducedMotion: boolean; mobile?: boolean }) {
  const size = mobile ? "w-52 h-52" : "w-72 h-72 md:w-80 md:h-80";

  return (
    <motion.div
      className="relative"
      style={{ perspective: "1000px" }}
      {...(reducedMotion
        ? {}
        : {
            initial:    { opacity: 0, scale: 0.9 },
            animate:    { opacity: 1, scale: 1 },
            transition: { duration: 1.2, delay: 0.4, ease: "easeOut" },
          })}
    >
      {/* Gold glow ring behind mockup */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: -24, borderRadius: 24,
          boxShadow: "0 0 100px rgba(212,168,67,0.10)", pointerEvents: "none",
        }}
      />

      <motion.div
        animate={
          reducedMotion
            ? {}
            : { rotateY: [-6, 6, -6], rotateX: [2, -2, 2] }
        }
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position:     "relative",
          borderRadius: "12px",
          overflow:     "hidden",
          boxShadow:    "0 25px 60px rgba(0,0,0,0.5)",
          willChange:   "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG.vibrantIllustrated}
          alt="AI-generated album cover art — Vibrant Illustrated style"
          className={`${size} object-cover`}
        />
      </motion.div>

      {/* Reflection */}
      <div
        aria-hidden
        className="mt-1 overflow-hidden"
        style={{
          height:                mobile ? 48 : 64,
          width:                 "100%",
          opacity:               0.15,
          transform:             "scaleY(-1)",
          maskImage:             "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
          WebkitMaskImage:       "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG.vibrantIllustrated}
          alt=""
          className="w-full object-cover object-top"
          style={{ height: mobile ? 48 : 64 }}
        />
      </div>
    </motion.div>
  );
}

// ─── Act 2: THE GALLERY WALK ──────────────────────────────────────────────────

function Act2GalleryWalk({ reducedMotion }: { reducedMotion: boolean }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-80px" });

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: actBg(1) }}
    >
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        {/* Section header */}
        <div ref={headerRef} className="text-center mb-6">
          <motion.h2
            className="text-3xl md:text-4xl font-black text-white mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            See what the AI creates
          </motion.h2>
          <motion.p
            className="text-sm"
            style={{ color: "#666" }}
            initial={{ opacity: 0, y: 10 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            6 genres. 6 moods. Find yours.
          </motion.p>
        </div>

        {/* Gallery items */}
        <div className="space-y-0">
          {GALLERY_ITEMS.map((item, i) => {
            const isOdd = i % 2 === 0;
            return (
              <GalleryItem
                key={item.genre}
                item={item}
                isOdd={isOdd}
                reducedMotion={reducedMotion}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GalleryItem({
  item, isOdd, reducedMotion,
}: {
  item:          (typeof GALLERY_ITEMS)[number];
  isOdd:         boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      className={`flex flex-col md:flex-row ${isOdd ? "" : "md:flex-row-reverse"} items-center gap-8 md:gap-16 py-16 md:py-24`}
      initial={reducedMotion ? {} : { opacity: 0, x: isOdd ? -80 : 80 }}
      whileInView={reducedMotion ? {} : { opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Image */}
      <motion.div
        className="shrink-0 group cursor-pointer"
        whileHover={reducedMotion ? {} : { scale: 1.03 }}
        transition={{ duration: 0.3 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-xl shadow-2xl ring-0 group-hover:ring-2 transition-all duration-300"
          style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
        />
      </motion.div>

      {/* Text */}
      <div className={`flex flex-col ${isOdd ? "md:items-start" : "md:items-end"} items-center text-center md:text-${isOdd ? "left" : "right"}`}>
        <p
          className="text-sm font-black uppercase tracking-widest mb-2"
          style={{ color: "#D4A843" }}
        >
          {item.genre}
        </p>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{item.title}</h3>
        <p className="text-sm" style={{ color: "#666" }}>Created with {item.style} style</p>
      </div>
    </motion.div>
  );
}

// ─── Act 3: THE TRANSFORMATION ────────────────────────────────────────────────

function Act3Transformation({ reducedMotion }: { reducedMotion: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target:  containerRef,
    offset:  ["start start", "end end"],
  });

  // All transforms defined at component top level (hooks rules)
  const clipPercent      = useTransform(scrollYProgress, [0.1, 0.8], [0, 100]);
  const clipPath         = useTransform(clipPercent, (v: number) => `inset(0 ${100 - v}% 0 0)`);
  const dividerLeft      = useTransform(clipPercent, (v: number) => `${v}%`);
  const beforeTextOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const afterTextOpacity  = useTransform(scrollYProgress, [0.55, 0.8], [0, 1]);
  const hintOpacity       = useTransform(scrollYProgress, [0, 0.2],  [1, 0]);

  // Reduced motion: show side-by-side instead of sticky scroll
  if (reducedMotion) {
    return (
      <section
        className="relative overflow-hidden"
        style={{ background: actBg(2) }}
      >
        <BlurBg src={IMG.smokeShadow} />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
          <p className="text-sm uppercase tracking-widest mb-2" style={{ color: "#D4A843" }}>See the transformation</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">Your reference → Your album cover</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.before} alt="Before — reference photo" className="w-64 h-64 object-cover rounded-xl" loading="lazy" />
              <span className="absolute top-3 left-3 text-xs font-semibold rounded px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)" }}>Before</span>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.after} alt="After — album cover art" className="w-64 h-64 object-cover rounded-xl" loading="lazy" />
              <span className="absolute top-3 left-3 text-xs font-semibold rounded px-2 py-1" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)" }}>After</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: "300vh" }}>
      {/* Sticky viewport */}
      <div
        className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{ background: actBg(2), willChange: "transform" }}
      >
        <BlurBg src={IMG.smokeShadow} />

        <div className="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-lg">
          {/* "See the transformation" label — fades out as scroll progresses */}
          <motion.p
            className="text-sm uppercase tracking-widest mb-3 absolute top-[-80px] left-1/2 -translate-x-1/2 whitespace-nowrap"
            style={{ color: "#D4A843", opacity: beforeTextOpacity }}
          >
            See the transformation
          </motion.p>

          {/* Before headline */}
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-white mb-8"
            style={{ opacity: beforeTextOpacity }}
          >
            Your reference photo
          </motion.h2>

          {/* After headline (cross-fades in) */}
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-white mb-8 absolute"
            style={{ opacity: afterTextOpacity, top: "calc(50% - 180px)" }}
          >
            Your album cover
          </motion.h2>

          {/* Image comparison container */}
          <div
            className="relative rounded-xl overflow-hidden shadow-2xl"
            style={{
              width:     "min(384px, 85vw)",
              height:    "min(384px, 85vw)",
              willChange: "contents",
            }}
          >
            {/* Before (always visible base) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMG.before}
              alt="Reference photo"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />

            {/* After (revealed by clip-path driven by scroll) */}
            <motion.div
              className="absolute inset-0"
              style={{ clipPath }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMG.after}
                alt="Styled album cover"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </motion.div>

            {/* Divider line — tracks clip position */}
            <motion.div
              className="absolute top-0 bottom-0 z-10"
              style={{
                left:            dividerLeft,
                width:           2,
                backgroundColor: "rgba(255,255,255,0.7)",
                willChange:      "left",
              }}
            >
              {/* Handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center rounded-full shadow-lg"
                style={{
                  width:           36,
                  height:          36,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  border:          "2px solid #D4A843",
                }}
              >
                <span style={{ fontSize: 12, color: "#0A0A0A", fontWeight: 700 }}>↔</span>
              </div>
            </motion.div>

            {/* Labels */}
            <motion.span
              className="absolute top-3 left-3 text-xs font-semibold rounded px-2 py-1"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)", opacity: beforeTextOpacity }}
            >
              Before
            </motion.span>
            <motion.span
              className="absolute top-3 right-3 text-xs font-semibold rounded px-2 py-1"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)", opacity: afterTextOpacity }}
            >
              After
            </motion.span>
          </div>

          {/* Hint */}
          <motion.p
            className="mt-6 text-sm"
            style={{ color: "#555", opacity: hintOpacity }}
          >
            Keep scrolling to reveal the transformation
          </motion.p>
        </div>
      </div>
    </div>
  );
}

// ─── Act 4: THE PALETTE (15 styles) ──────────────────────────────────────────

function Act4StylePalette({ reducedMotion }: { reducedMotion: boolean }) {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered = activeCategory === "All"
    ? STYLE_ITEMS
    : STYLE_ITEMS.filter(s => s.category === activeCategory);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: actBg(3, "30% 20%", "70% 80%") }}
    >
      <BlurBg src={IMG.psychedelic} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            15 styles. Infinite possibilities.
          </h2>
          <p className="text-sm" style={{ color: "#666" }}>
            Every mood. Every genre. Every vision.
          </p>
        </motion.div>

        {/* Filter pills */}
        <div className="flex gap-2 justify-center flex-wrap mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: activeCategory === cat ? "#D4A843" : "transparent",
                color:           activeCategory === cat ? "#0A0A0A" : "#888",
                border:          activeCategory === cat ? "none"    : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((style, i) => (
              <motion.div
                key={style.name}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, delay: reducedMotion ? 0 : i * 0.04 }}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={style.image}
                  alt={style.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                {/* Hover gold ring */}
                <div
                  className="absolute inset-0 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100"
                  style={{ boxShadow: "inset 0 0 0 2px rgba(212,168,67,0.45)" }}
                />
                {/* Label */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
                >
                  <p className="text-white text-xs font-medium">{style.name}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ─── Act 5: HOW IT WORKS ──────────────────────────────────────────────────────

function Act5HowItWorks({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: actBg(4) }}
    >
      {/* Intentionally clean — no blur bg */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        <motion.div
          className="text-center mb-16"
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            Three steps to release-ready art
          </h2>
        </motion.div>

        <div className="flex flex-col md:flex-row items-start justify-center gap-10 md:gap-16">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              className="flex flex-col items-center text-center max-w-xs w-full"
              initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
              whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                style={{ border: "2px solid #D4A843" }}
              >
                <span className="text-xl font-bold" style={{ color: "#D4A843" }}>{step.number}</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{step.desc}</p>

              {/* Connector arrow — only between steps, not after last */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute" style={{ marginLeft: "100%", marginTop: 28 }}>
                  {/* pure CSS — rendered by flex gap */}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Act 6: THE INVESTMENT (Pricing) ─────────────────────────────────────────

function Act6Pricing({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: actBg(5, "50% 30%", "20% 80%") }}
    >
      <BlurBg src={IMG.gothicPortrait} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        <motion.div
          className="text-center mb-12"
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            Choose your tier
          </h2>
          <p className="text-sm" style={{ color: "#666" }}>
            One-time payment. No subscription.
          </p>
        </motion.div>

        {/* Tier cards — Premium first on mobile via order */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.title}
              initial={reducedMotion ? {} : { opacity: 0, scale: 0.93 }}
              whileInView={reducedMotion ? {} : { opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="rounded-2xl p-6 flex flex-col gap-4 relative"
              style={{
                border:          tier.popular ? "2px solid rgba(212,168,67,0.5)" : "1px solid rgba(255,255,255,0.08)",
                backgroundColor: tier.popular ? "rgba(212,168,67,0.03)" : "rgba(255,255,255,0.02)",
                // Premium card first on mobile
                order:           tier.popular ? -1 : 0,
              }}
            >
              {tier.popular && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  MOST POPULAR
                </div>
              )}
              <div>
                <p className="font-black text-white text-lg">{tier.title}</p>
                <p className="text-3xl font-black text-white mt-1">{tier.price}</p>
              </div>
              <ul className="space-y-2 flex-1">
                {tier.features.map(f => (
                  <li key={f.text} className="flex items-center gap-2 text-sm" style={{ color: f.ok ? "#aaa" : "#3a3a3a" }}>
                    {f.ok
                      ? <Check size={12} style={{ color: "#D4A843", flexShrink: 0 }} />
                      : <X size={12} style={{ color: "#333", flexShrink: 0 }} />
                    }
                    {f.text}
                  </li>
                ))}
              </ul>
              <a
                href="/cover-art?start=1"
                className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: tier.popular ? "#D4A843" : "rgba(255,255,255,0.06)",
                  color:           tier.popular ? "#0A0A0A" : "#aaa",
                  border:          tier.popular ? "none"    : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Start for {tier.price}
              </a>
            </motion.div>
          ))}
        </div>

        {/* Subscriber upsell */}
        <motion.div
          className="mt-8 rounded-2xl p-6 md:p-8 text-center"
          style={{ border: "1px solid rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.03)" }}
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#D4A843" }}>
            Already on IndieThis?
          </p>
          <h3 className="text-xl font-black text-white mb-2">Subscribers get cover art from $3.99</h3>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Plus music videos, lyric videos, mastering, merch store, and an artist page — all for $19/month.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold no-underline"
              style={{ border: "1px solid rgba(212,168,67,0.4)", color: "#D4A843" }}
            >
              View Plans <ChevronRight size={14} />
            </a>
            <a
              href="/cover-art?start=1"
              className="text-sm no-underline"
              style={{ color: "#555" }}
            >
              Continue without account
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Act 7: THE EXIT ──────────────────────────────────────────────────────────

function Act7Exit({ reducedMotion }: { reducedMotion: boolean }) {
  const [morphIndex, setMorphIndex] = useState(0);
  const [morphReady, setMorphReady] = useState(false);

  // Preload morph images when Act 5 scrolls into view — preloaded via a trigger
  // that fires before Act 7 is reached. Here we start after component mounts.
  useEffect(() => {
    const timer = setTimeout(() => setMorphReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!morphReady) return;
    const id = setInterval(() => {
      setMorphIndex(p => (p + 1) % MORPH_IMAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [morphReady]);

  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center justify-center"
      style={{ background: actBg(6, "50% 30%", "30% 70%") }}
    >
      {/* Morph crossfade background */}
      {!reducedMotion && morphReady ? (
        MORPH_IMAGES.map((src, i) => (
          <div
            key={src}
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:    `url('${src}')`,
              backgroundSize:     "cover",
              backgroundPosition: "center",
              filter:             "blur(50px)",
              opacity:            i === morphIndex ? 0.18 : 0,
              transform:          "scale(1.2)",
              transition:         "opacity 2000ms ease-in-out",
            }}
          />
        ))
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:    `url('${MORPH_IMAGES[0]}')`,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            filter:             "blur(50px)",
            opacity:            0.12,
            transform:          "scale(1.2)",
          }}
        />
      )}

      {/* Dark overlay — readability */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.5) 100%)" }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        <motion.h2
          className="font-black text-white mb-8 leading-tight"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Your music deserves<br />to be seen.
        </motion.h2>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/cover-art?start=1"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-lg font-black transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Create Your Cover Art →
          </a>
        </motion.div>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0 }}
          whileInView={reducedMotion ? {} : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-6"
        >
          <a href="/explore" className="text-sm no-underline" style={{ color: "#555" }}>
            Explore IndieThis artists →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  userTier: string | null;
}

export default function CoverArtLanding({ userId: _userId, userTier: _userTier }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="relative overflow-x-hidden" style={{ backgroundColor: "#0a0a0a", color: "#F0F0F0" }}>
      <StickyNav />
      <Act1Hero       reducedMotion={reducedMotion} />
      <Act2GalleryWalk reducedMotion={reducedMotion} />
      <Act3Transformation reducedMotion={reducedMotion} />
      <Act4StylePalette   reducedMotion={reducedMotion} />
      <Act5HowItWorks     reducedMotion={reducedMotion} />
      <Act6Pricing        reducedMotion={reducedMotion} />
      <Act7Exit           reducedMotion={reducedMotion} />

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center" style={{ borderColor: "#1A1A1A", backgroundColor: "#0a0a0a" }}>
        <p className="text-xs" style={{ color: "#444" }}>
          &copy; {new Date().getFullYear()} IndieThis &nbsp;·&nbsp;{" "}
          <a href="/privacy" style={{ color: "#444" }}>Privacy</a> &nbsp;·&nbsp;{" "}
          <a href="/terms" style={{ color: "#444" }}>Terms</a>
        </p>
      </footer>
    </div>
  );
}
