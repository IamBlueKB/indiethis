"use client";

import { useState, useEffect } from "react";
import { MapPin, Phone, Mail, Clock, Instagram, Youtube, Twitter, Facebook } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const GOLD   = "#D4A843";
const CORAL  = "#E85D4A";
const BG     = "#0A0A0A";
const SERIF  = "var(--font-playfair, 'Playfair Display', Georgia, serif)";
const SANS   = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

function fmt12h(time: string) {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ? parseInt(mStr, 10) : 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${mStr} ${ampm}`;
}

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav({ studio, slug, logoSrc }: { studio: any; slug: string; logoSrc: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        fontFamily: SANS,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={studio.name}
              style={{ height: "32px", width: "auto" }}
              className="object-contain"
            />
          ) : (
            <span className="font-bold text-base" style={{ color: "#FAFAFA", fontFamily: SERIF }}>
              {studio.name}
            </span>
          )}
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {["Services", "About", "Contact"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className="text-sm font-medium no-underline transition-colors hover:opacity-100"
              style={{ color: "rgba(255,255,255,0.6)", fontFamily: SANS }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href={`/${slug}/intake`}
          className="px-5 py-2.5 rounded-lg text-sm font-bold no-underline hover:opacity-90 transition-opacity shrink-0"
          style={{ backgroundColor: CORAL, color: "#fff", fontFamily: SANS }}
        >
          Book Now
        </a>
      </div>
    </nav>
  );
}

// ─── Contact form ────────────────────────────────────────────────────────────

function ContactForm({ studioId }: { studioId: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/studio/${studioId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Something went wrong."); setStatus("error"); return; }
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#141414",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "12px",
    padding: "14px 16px",
    color: "#FAFAFA",
    fontSize: "14px",
    fontFamily: SANS,
    outline: "none",
  };

  if (status === "success") {
    return (
      <div
        className="rounded-2xl p-10 text-center border"
        style={{ backgroundColor: "#141414", borderColor: `${GOLD}33` }}
      >
        <p className="text-xl font-bold mb-2" style={{ fontFamily: SERIF }}>Message sent.</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)", fontFamily: SANS }}>
          We&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: SANS }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <input
          required
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={inputStyle}
        />
        <input
          required
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          style={inputStyle}
        />
      </div>
      <input
        placeholder="Phone (optional)"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        style={inputStyle}
      />
      <textarea
        required
        placeholder="What can we help you with?"
        rows={5}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        style={{ ...inputStyle, resize: "none" }}
      />
      {/* honeypot */}
      <input type="text" name="website" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
      {errorMsg && (
        <p className="text-sm" style={{ color: CORAL }}>{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: CORAL, color: "#fff", fontFamily: SANS }}
      >
        {status === "loading" ? "Sending…" : "Send Message →"}
      </button>
    </form>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type ServiceItem = { name: string; price: string; description: string };
type Testimonial  = { quote: string; author: string; track?: string };

interface CustomTemplateProps {
  studio: any;
  services: ServiceItem[];
  testimonials: Testimonial[];
  featuredArtists: any[];
  fullAddress: string;
  mapQuery: string;
  socials: { label: string; href: string }[];
}

export function CustomTemplate({
  studio,
  services,
  testimonials,
  featuredArtists,
  fullAddress,
  mapQuery,
  socials,
}: CustomTemplateProps) {
  const slug = studio.slug as string;

  // Static assets — stored in public/images/studio/
  const HERO_IMG    = "/images/studio/hero.jpg";
  const LOGO_IMG    = "/images/studio/logo.png";
  const STATIC_GALLERY = [
    "/images/studio/gallery-1.jpg",
    "/images/studio/gallery-2.jpg",
    "/images/studio/gallery-3.jpg",
    "/images/studio/gallery-4.jpg",
    "/images/studio/gallery-5.jpg",
    "/images/studio/gallery-6.jpg",
    "/images/studio/gallery-7.jpg",
  ];

  const heroSrc = studio.heroImage || HERO_IMG;
  const logoSrc = studio.logo || studio.logoUrl || LOGO_IMG;
  const galleryImages: string[] =
    Array.isArray(studio.galleryImages) && studio.galleryImages.length > 0
      ? studio.galleryImages
      : STATIC_GALLERY;

  const [galleryFirst, ...galleryRest] = galleryImages;

  const hasHours =
    (studio.studioHours && typeof studio.studioHours === "object") ||
    studio.hours;

  const socialPlatforms = [
    studio.instagram && {
      label: "Instagram",
      href: `https://instagram.com/${studio.instagram.replace(/^@/, "")}`,
      icon: <Instagram size={18} />,
    },
    studio.youtube && {
      label: "YouTube",
      href: studio.youtube,
      icon: <Youtube size={18} />,
    },
    studio.twitter && {
      label: "Twitter",
      href: `https://twitter.com/${studio.twitter.replace(/^@/, "")}`,
      icon: <Twitter size={18} />,
    },
    studio.facebook && {
      label: "Facebook",
      href: studio.facebook.startsWith("http") ? studio.facebook : `https://facebook.com/${studio.facebook}`,
      icon: <Facebook size={18} />,
    },
    studio.tiktok && {
      label: "TikTok",
      href: `https://tiktok.com/@${studio.tiktok.replace(/^@/, "")}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z" />
        </svg>
      ),
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  return (
    <div style={{ backgroundColor: BG, color: "#FAFAFA", fontFamily: SANS }}>
      <Nav studio={studio} slug={slug} logoSrc={logoSrc} />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative flex flex-col items-center justify-center text-center px-6 overflow-hidden"
        style={{
          minHeight: "100vh",
          background: `linear-gradient(to bottom, rgba(10,10,10,0.3), rgba(10,10,10,0.85) 70%, #0A0A0A 100%), url(${heroSrc}) center/cover no-repeat`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(212,168,67,0.05) 0%, transparent 70%)",
          }}
        />

        <p
          className="relative z-10 text-xs font-bold uppercase mb-5"
          style={{ color: GOLD, letterSpacing: "0.32em", fontFamily: SANS }}
        >
          Professional Recording Studio
        </p>

        <h1
          className="relative z-10 font-bold leading-none mb-5"
          style={{
            fontSize: "clamp(3rem, 9vw, 7rem)",
            fontFamily: SERIF,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
          }}
        >
          {studio.name}
        </h1>

        {studio.tagline && (
          <p
            className="relative z-10 max-w-xl mx-auto mb-10 text-lg leading-relaxed"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: SANS }}
          >
            {studio.tagline}
          </p>
        )}

        <div className="relative z-10 flex flex-wrap gap-4 justify-center">
          <a
            href={`/${slug}/intake`}
            className="px-9 py-4 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: GOLD, color: BG, fontFamily: SANS }}
          >
            Book a Session →
          </a>
          {studio.phone && (
            <a
              href={`tel:${studio.phone}`}
              className="px-9 py-4 rounded-xl font-bold text-sm no-underline transition-colors border"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                color: "#FAFAFA",
                backdropFilter: "blur(8px)",
                fontFamily: SANS,
              }}
            >
              {studio.phone}
            </a>
          )}
        </div>

        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: 0.35 }}
        >
          <div
            className="w-px h-14"
            style={{ background: `linear-gradient(to bottom, transparent, ${GOLD})` }}
          />
          <p
            className="text-[9px] font-bold uppercase"
            style={{ color: GOLD, letterSpacing: "0.3em" }}
          >
            Scroll
          </p>
        </div>
      </section>

      {/* ── SERVICES ──────────────────────────────────────────────────────── */}
      <section id="services" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p
              className="text-xs font-bold uppercase mb-3"
              style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
            >
              Services
            </p>
            <h2
              className="font-bold"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontFamily: SERIF }}
            >
              What We Do
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {services.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl p-7 border flex flex-col gap-3 group hover:border-[#D4A843]/30 transition-all"
                style={{
                  backgroundColor: "#111",
                  borderColor: "rgba(255,255,255,0.07)",
                  boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
                }}
              >
                <p className="font-bold text-lg" style={{ fontFamily: SERIF }}>
                  {s.name}
                </p>
                {s.description && (
                  <p
                    className="text-sm leading-relaxed flex-1"
                    style={{ color: "rgba(255,255,255,0.5)", fontFamily: SANS }}
                  >
                    {s.description}
                  </p>
                )}
                <a
                  href={`/${slug}/intake`}
                  className="mt-auto text-xs font-bold no-underline opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: GOLD, fontFamily: SANS }}
                >
                  Book this service →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ───────────────────────────────────────────────────────── */}
      {galleryImages.length > 0 && (
        <section className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <p
                className="text-xs font-bold uppercase mb-3"
                style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
              >
                Inside the Studio
              </p>
              <h2
                className="font-bold"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontFamily: SERIF }}
              >
                The Space
              </h2>
            </div>

            {/* Asymmetric grid: first image 2/3, rest stacked on right 1/3 */}
            <div className="flex gap-3" style={{ height: "520px" }}>
              {galleryFirst && (
                <div className="rounded-2xl overflow-hidden shrink-0" style={{ flex: "0 0 66%" }}>
                  <img
                    src={galleryFirst}
                    alt="Studio — main"
                    className="w-full h-full object-cover transition-transform hover:scale-[1.02]"
                  />
                </div>
              )}
              {galleryRest.length > 0 && (
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  {galleryRest.slice(0, 3).map((url, i) => (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden flex-1"
                    >
                      <img
                        src={url}
                        alt={`Studio — photo ${i + 2}`}
                        className="w-full h-full object-cover transition-transform hover:scale-[1.02]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ─────────────────────────────────────────────────────────── */}
      {(studio.bio || studio.description) && (
        <section id="about" className="py-28 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-start">
            <div>
              <p
                className="text-xs font-bold uppercase mb-4"
                style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
              >
                Our Story
              </p>
              <h2
                className="font-bold mb-8"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontFamily: SERIF }}
              >
                About the Studio
              </h2>
              <p
                className="text-base leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.85, fontFamily: SANS }}
              >
                {studio.bio || studio.description}
              </p>
            </div>

            {/* Hours card */}
            {hasHours && (
              <div
                className="rounded-2xl p-8 border"
                style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <Clock size={15} style={{ color: GOLD }} />
                  <p
                    className="text-xs font-bold uppercase"
                    style={{ color: GOLD, letterSpacing: "0.2em", fontFamily: SANS }}
                  >
                    Studio Hours
                  </p>
                </div>
                {studio.studioHours && typeof studio.studioHours === "object" ? (
                  <div className="space-y-2">
                    {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map((d) => {
                      const labels: Record<string, string> = {
                        monday: "Mon", tuesday: "Tue", wednesday: "Wed",
                        thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
                      };
                      const day = (studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }>)[d];
                      if (!day) return null;
                      return (
                        <div key={d} className="flex justify-between text-sm gap-4" style={{ fontFamily: SANS }}>
                          <span className="font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {labels[d]}
                          </span>
                          <span style={{ color: day.open ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)" }}>
                            {day.open ? `${fmt12h(day.openTime)} – ${fmt12h(day.closeTime)}` : "Closed"}
                          </span>
                        </div>
                      );
                    })}
                    {studio.hoursNote && (
                      <p
                        className="text-xs mt-3 pt-3 border-t"
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          borderColor: "rgba(255,255,255,0.07)",
                          fontFamily: SANS,
                        }}
                      >
                        {studio.hoursNote}
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    className="text-sm whitespace-pre-line leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.65)", fontFamily: SANS }}
                  >
                    {studio.hours}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p
                className="text-xs font-bold uppercase mb-3"
                style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
              >
                What Artists Say
              </p>
              <h2
                className="font-bold"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontFamily: SERIF }}
              >
                Testimonials
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-8 border flex flex-col gap-5"
                  style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <p
                    className="text-3xl leading-none"
                    style={{ color: GOLD, opacity: 0.5, fontFamily: SERIF }}
                  >
                    &ldquo;
                  </p>
                  <p
                    className="text-base leading-relaxed flex-1"
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontStyle: "italic",
                      fontFamily: SANS,
                    }}
                  >
                    {t.quote}
                  </p>
                  <div>
                    <p className="font-bold" style={{ fontFamily: SANS }}>{t.author}</p>
                    {t.track && (
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(255,255,255,0.35)", fontFamily: SANS }}
                      >
                        {t.track}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOOKING CTA ───────────────────────────────────────────────────── */}
      <section
        className="relative py-40 px-6 text-center overflow-hidden"
        style={{
          background: `linear-gradient(160deg, #130d00 0%, ${BG} 50%, #0d0d0d 100%)`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(212,168,67,0.07) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto">
          <p
            className="text-xs font-bold uppercase mb-5"
            style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
          >
            Ready to Record?
          </p>
          <h2
            className="font-bold mb-6"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 5rem)",
              lineHeight: 1.1,
              fontFamily: SERIF,
            }}
          >
            Book Your Session<br />Today
          </h2>
          <p
            className="text-lg mb-12"
            style={{ color: "rgba(255,255,255,0.5)", fontFamily: SANS }}
          >
            Fill out our quick intake form — we&apos;ll confirm your booking within the hour.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={`/${slug}/intake`}
              className="px-10 py-4 rounded-xl font-bold text-base no-underline hover:opacity-90 transition-opacity"
              style={{ backgroundColor: CORAL, color: "#fff", fontFamily: SANS }}
            >
              Book a Session →
            </a>
            {studio.phone && (
              <a
                href={`tel:${studio.phone}`}
                className="px-10 py-4 rounded-xl font-bold text-base no-underline border transition-colors hover:border-white/30"
                style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA", fontFamily: SANS }}
              >
                Call {studio.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── CONTACT FORM ──────────────────────────────────────────────────── */}
      <section id="contact" className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <p
              className="text-xs font-bold uppercase mb-3"
              style={{ color: GOLD, letterSpacing: "0.3em", fontFamily: SANS }}
            >
              Send Us a Message
            </p>
            <h2
              className="font-bold"
              style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontFamily: SERIF }}
            >
              Get in Touch
            </h2>
          </div>
          <ContactForm studioId={studio.id} />
        </div>
      </section>

      {/* ── CONTACT & LOCATION ────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2
              className="font-bold"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontFamily: SERIF }}
            >
              Contact &amp; Location
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Info */}
            <div className="space-y-6">
              {fullAddress && (
                <div className="flex items-start gap-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${GOLD}18` }}
                  >
                    <MapPin size={18} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold uppercase mb-1"
                      style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", fontFamily: SANS }}
                    >
                      Address
                    </p>
                    <p className="font-medium" style={{ fontFamily: SANS }}>{fullAddress}</p>
                  </div>
                </div>
              )}
              {studio.phone && (
                <div className="flex items-start gap-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${GOLD}18` }}
                  >
                    <Phone size={18} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold uppercase mb-1"
                      style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", fontFamily: SANS }}
                    >
                      Phone
                    </p>
                    <a
                      href={`tel:${studio.phone}`}
                      className="font-medium no-underline hover:opacity-80"
                      style={{ fontFamily: SANS }}
                    >
                      {studio.phone}
                    </a>
                  </div>
                </div>
              )}
              {studio.email && (
                <div className="flex items-start gap-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${GOLD}18` }}
                  >
                    <Mail size={18} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold uppercase mb-1"
                      style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", fontFamily: SANS }}
                    >
                      Email
                    </p>
                    <a
                      href={`mailto:${studio.email}`}
                      className="font-medium no-underline hover:opacity-80"
                      style={{ fontFamily: SANS }}
                    >
                      {studio.email}
                    </a>
                  </div>
                </div>
              )}

              {/* Social icons */}
              {socialPlatforms.length > 0 && (
                <div className="flex gap-3 pt-2">
                  {socialPlatforms.map(({ label, href, icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className="w-10 h-10 rounded-xl flex items-center justify-center border no-underline transition-colors hover:border-[#D4A843]/40 hover:text-[#D4A843]"
                      style={{
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Map */}
            {fullAddress && (
              <div
                className="rounded-2xl overflow-hidden border"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <iframe
                  title="Studio location"
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  width="100%"
                  height="380"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        className="py-10 px-6 border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: BG }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-bold" style={{ fontFamily: SERIF }}>{studio.name}</p>
          <p
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: SANS }}
          >
            Powered by{" "}
            <span style={{ color: GOLD, fontWeight: 600 }}>IndieThis</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
