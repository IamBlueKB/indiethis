"use client";

import { useState, useEffect, useRef } from "react";
import { Instagram, Twitter, Facebook, Youtube, Music2, ChevronLeft, ChevronRight } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const BG      = "#0A0A0A";
const OFF     = "#111111";
const SERIF   = "var(--font-playfair, 'Playfair Display', Georgia, serif)";
const SANS    = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

// ── Types ──────────────────────────────────────────────────────────────────────
type ServiceItem = { name: string; price?: string; description?: string };
type Testimonial = { quote: string; author: string; track?: string };
type Social      = { label: string; href: string };
type Studio = {
  id: string; slug: string; name: string; tagline?: string | null; bio?: string | null;
  email?: string | null; phone?: string | null; instagram?: string | null; twitter?: string | null;
  facebook?: string | null; tiktok?: string | null; youtube?: string | null; heroImage?: string | null;
  logoUrl?: string | null; logo?: string | null; galleryImages?: unknown; studioHours?: unknown;
  hoursNote?: string | null; accentColor?: string | null; streetAddress?: string | null;
  city?: string | null; state?: string | null; zipCode?: string | null;
};
interface Props {
  studio: Studio; services: ServiceItem[]; testimonials: Testimonial[];
  fullAddress: string; mapQuery: string; socials: Social[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt12h(t: string) {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? "PM" : "AM"}`;
}
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABELS: Record<string,string> = { monday:"Monday", tuesday:"Tuesday", wednesday:"Wednesday", thursday:"Thursday", friday:"Friday", saturday:"Saturday", sunday:"Sunday" };

// ── Gallery Carousel ───────────────────────────────────────────────────────────
function GalleryCarousel({ images, accent }: { images: string[]; accent: string }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden", backgroundColor: "#000" }}>
      <div style={{ display: "flex", transition: "transform 0.6s cubic-bezier(0.77,0,0.18,1)", transform: `translateX(-${idx * 100}%)` }}>
        {images.map((src, i) => (
          <div key={i} style={{ minWidth: "100%", height: "70vh", flexShrink: 0, position: "relative" }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button onClick={prev} aria-label="Previous"
            style={{ position: "absolute", left: "2rem", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer", padding: "0.75rem", display: "flex" }}>
            <ChevronLeft size={20} />
          </button>
          <button onClick={next} aria-label="Next"
            style={{ position: "absolute", right: "2rem", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer", padding: "0.75rem", display: "flex" }}>
            <ChevronRight size={20} />
          </button>
          <div style={{ position: "absolute", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.5rem" }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                style={{ width: i === idx ? "2rem" : "0.5rem", height: "2px", backgroundColor: i === idx ? accent : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Contact Form ───────────────────────────────────────────────────────────────
function ContactForm({ studioId, accent }: { studioId: string; accent: string }) {
  const [form, setForm] = useState({ name:"", email:"", phone:"", message:"", website:"" });
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.website) return;
    setStatus("sending");
    try {
      const res = await fetch(`/api/studio/${studioId}/contact`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch { setStatus("error"); }
  }

  if (status === "sent") return <p style={{ color: accent, fontFamily: SANS, fontSize: "1rem" }}>Message received. We'll be in touch.</p>;

  const field: React.CSSProperties = {
    display: "block", width: "100%", backgroundColor: "transparent",
    border: "none", borderBottom: "1px solid rgba(255,255,255,0.15)",
    color: "#fff", fontFamily: SANS, fontSize: "0.95rem", padding: "0.85rem 0",
    outline: "none",
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <input type="text" name="website" value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} style={{ display:"none" }} tabIndex={-1} />
      <input style={field} placeholder="Your name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
      <input style={field} placeholder="Email" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required />
      <input style={field} placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} />
      <textarea style={{ ...field, resize: "none" }} rows={4} placeholder="Your project" value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} required />
      <button type="submit" disabled={status==="sending"}
        style={{ alignSelf: "flex-start", backgroundColor: accent, color: BG, border: "none", padding: "1rem 2.5rem", fontFamily: SANS, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
      {status === "error" && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>Something went wrong.</p>}
    </form>
  );
}

// ── Parallax Hero ──────────────────────────────────────────────────────────────
function ParallaxHero({ studio, accent }: { studio: Studio; accent: string }) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    function onScroll() {
      if (ref.current) setOffset(window.scrollY * 0.4);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={ref} style={{
      position: "relative", height: "100svh", overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", color: "#fff",
    }}>
      {/* Parallax background */}
      {studio.heroImage && (
        <div style={{
          position: "absolute", inset: "-20%",
          backgroundImage: `url(${studio.heroImage})`,
          backgroundSize: "cover", backgroundPosition: "center",
          transform: `translateY(${offset}px)`,
          zIndex: 0,
        }} />
      )}
      {/* Dark overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: studio.heroImage
          ? "linear-gradient(to bottom, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.7) 60%, #0A0A0A 100%)"
          : "linear-gradient(160deg, #1a1a1a 0%, #0A0A0A 100%)",
        zIndex: 1,
      }} />
      {/* Radial glow */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${accent}12 0%, transparent 70%)`,
      }} />

      <div style={{ position: "relative", zIndex: 3, padding: "0 2rem" }}>
        {(studio.logoUrl ?? studio.logo) && (
          <img src={(studio.logoUrl ?? studio.logo)!} alt={studio.name}
            style={{ height: "56px", width: "auto", objectFit: "contain", margin: "0 auto 2.5rem", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        )}
        <h1 style={{
          fontFamily: SERIF, fontSize: "clamp(3.5rem, 10vw, 8rem)",
          fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1,
          marginBottom: "1.5rem", textShadow: "0 8px 60px rgba(0,0,0,0.7)",
        }}>
          {studio.name}
        </h1>
        {studio.tagline && (
          <p style={{ fontFamily: SANS, fontSize: "1.15rem", opacity: 0.65, maxWidth: "520px", margin: "0 auto 3rem", lineHeight: 1.7 }}>
            {studio.tagline}
          </p>
        )}
        <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/${studio.slug}/book`} style={{
            backgroundColor: accent, color: BG, padding: "1rem 2.75rem",
            fontFamily: SANS, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase",
            textDecoration: "none",
          }}>
            Book a Session
          </a>
          <a href="#gallery" style={{
            border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
            padding: "1rem 2.75rem", fontFamily: SANS, fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase",
            textDecoration: "none", backdropFilter: "blur(8px)",
          }}>
            View the Space
          </a>
        </div>
      </div>
      {/* Scroll indicator */}
      <div style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", opacity: 0.4 }}>
        <div style={{ width: "1px", height: "60px", background: `linear-gradient(to bottom, transparent, ${accent})` }} />
        <p style={{ fontFamily: SANS, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: accent }}>Scroll</p>
      </div>
    </section>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────────
export function CinematicTemplate({ studio, services, testimonials, fullAddress, mapQuery, socials }: Props) {
  const { slug } = studio;
  const accent = studio.accentColor ?? "#D4A843";
  const gallery: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages as string[] : [];
  const hours = studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }> | null;

  const socialIcons: Record<string, React.ReactNode> = {
    Instagram: <Instagram size={16} />, Twitter: <Twitter size={16} />,
    Facebook: <Facebook size={16} />, YouTube: <Youtube size={16} />, TikTok: <Music2 size={16} />,
  };

  return (
    <div style={{ backgroundColor: BG, color: "#fff", fontFamily: SANS }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 2.5rem", height: "72px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,10,0.9) 0%, transparent 100%)", pointerEvents: "none" }} />
        <span style={{ position: "relative", fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.02em", color: "#fff" }}>
          {studio.name}
        </span>
        <nav style={{ position: "relative", display: "flex", gap: "2rem", alignItems: "center" }}>
          {services.length > 0 && <a href="#services" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Services</a>}
          {gallery.length > 0 && <a href="#gallery" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gallery</a>}
          {studio.bio && <a href="#about" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>About</a>}
          <a href={`/${slug}/book`} style={{ backgroundColor: accent, color: BG, padding: "0.6rem 1.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
            Book Now
          </a>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <ParallaxHero studio={studio} accent={accent} />

      {/* ── SERVICES — alternating rows ───────────────────────────────────── */}
      {services.length > 0 && (
        <section id="services" style={{ backgroundColor: BG }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "7rem 2rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "1rem" }}>
              Services
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, marginBottom: "5rem", color: "#fff" }}>
              What We Create
            </h2>
          </div>
          {services.map((s, i) => (
            <div key={i} style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "4rem 2rem",
              backgroundColor: i % 2 === 1 ? OFF : BG,
            }}>
              <div style={{
                maxWidth: "1200px", margin: "0 auto",
                display: "flex", flexDirection: i % 2 === 0 ? "row" : "row-reverse",
                alignItems: "flex-start", gap: "6rem",
              }}>
                <div style={{ flex: "0 0 50%" }}>
                  <p style={{ fontFamily: SERIF, fontSize: "clamp(1.5rem,3.5vw,2.5rem)", fontWeight: 700, color: "#fff", marginBottom: "1rem", lineHeight: 1.2 }}>
                    {s.name}
                  </p>
                  {s.description && (
                    <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>
                      {s.description}
                    </p>
                  )}
                  {s.price && (
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: accent, marginBottom: "1.5rem" }}>{s.price}</p>
                  )}
                  <a href={`/${slug}/book`} style={{ color: accent, textDecoration: "none", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: `1px solid ${accent}`, paddingBottom: "2px" }}>
                    Book this service →
                  </a>
                </div>
                <div style={{ flex: 1 }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── GALLERY — horizontal carousel ────────────────────────────────── */}
      {gallery.length > 0 && (
        <section id="gallery" style={{ backgroundColor: BG, padding: "5rem 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem", marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent }}>
              The Space
            </p>
          </div>
          <GalleryCarousel images={gallery} accent={accent} />
        </section>
      )}

      {/* ── ABOUT — photo + text ─────────────────────────────────────────── */}
      {studio.bio && (
        <section id="about" style={{ backgroundColor: OFF, padding: "8rem 2rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
            {gallery.length > 0 && (
              <div style={{ overflow: "hidden", height: "560px" }}>
                <img src={gallery[0]} alt={studio.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ gridColumn: gallery.length > 0 ? "auto" : "1 / -1" }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "1.5rem" }}>
                About
              </p>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem,4vw,3rem)", fontWeight: 700, marginBottom: "1.5rem", lineHeight: 1.2 }}>
                {studio.name}
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.9, color: "rgba(255,255,255,0.6)", marginBottom: "2rem" }}>{studio.bio}</p>
              {hours && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "2rem" }}>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "1rem" }}>Studio Hours</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {DAYS.map(day => {
                      const d = (hours as Record<string, { open: boolean; openTime: string; closeTime: string }>)[day];
                      if (!d) return null;
                      return (
                        <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>{DAY_LABELS[day]}</span>
                          <span style={{ color: d.open ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)" }}>
                            {d.open ? `${fmt12h(d.openTime)} – ${fmt12h(d.closeTime)}` : "Closed"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {studio.hoursNote && <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: "1rem" }}>{studio.hoursNote}</p>}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section style={{ backgroundColor: BG, padding: "8rem 2rem", textAlign: "center" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "3rem" }}>
              What Artists Say
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4rem" }}>
              {testimonials.map((t, i) => (
                <div key={i}>
                  <p style={{ fontFamily: SERIF, fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", fontStyle: "italic", lineHeight: 1.7, color: "rgba(255,255,255,0.8)", marginBottom: "1.25rem" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>{t.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOOKING CTA — radial glow ─────────────────────────────────────── */}
      <section style={{ backgroundColor: OFF, padding: "10rem 2rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "600px", height: "600px",
          background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "1.5rem" }}>
            Ready to Create
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2.5rem, 7vw, 5.5rem)", fontWeight: 700, marginBottom: "2.5rem", lineHeight: 1.1 }}>
            Book Your Session
          </h2>
          <a href={`/${slug}/book`} style={{
            display: "inline-block", backgroundColor: accent, color: BG,
            padding: "1.1rem 3.5rem", fontFamily: SANS, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase",
            textDecoration: "none",
          }}>
            Reserve Your Time
          </a>
        </div>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" style={{ backgroundColor: BG, padding: "8rem 2rem" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7rem" }}>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "2rem" }}>
              Get in Touch
            </p>
            <ContactForm studioId={studio.id} accent={accent} />
          </div>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: "2rem" }}>
              Find Us
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2.5rem", fontSize: "0.95rem", color: "rgba(255,255,255,0.5)" }}>
              {fullAddress && <p>{fullAddress}</p>}
              {studio.phone && <p>{studio.phone}</p>}
              {studio.email && <p>{studio.email}</p>}
            </div>
            {socials.length > 0 && (
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
                {socials.map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", transition: "color 0.2s" }}
                    onMouseEnter={e=>(e.currentTarget.style.color=accent)}
                    onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.4)")}>
                    {socialIcons[s.label] ?? null}
                  </a>
                ))}
              </div>
            )}
            {fullAddress && (
              <div style={{ height: "260px", overflow: "hidden", filter: "grayscale(1) brightness(0.3) contrast(1.2)" }}>
                <iframe src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Map" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} {studio.name} · Powered by{" "}
          <a href="https://indiethis.com" style={{ color: accent, textDecoration: "none", fontWeight: 600 }}>IndieThis</a>
        </p>
      </footer>
    </div>
  );
}
