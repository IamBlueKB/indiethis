"use client";

import { useState } from "react";
import { Instagram, Twitter, Facebook, Youtube, Music2 } from "lucide-react";
import { PortfolioSection, type PortfolioTrack } from "@/components/studio-public/sections/PortfolioSection";
import { CreditsSection, type StudioCreditItem } from "@/components/studio-public/sections/CreditsSection";
import { EngineersSection, type StudioEngineerItem } from "@/components/studio-public/sections/EngineersSection";
import { EquipmentSection, type EquipmentItem } from "@/components/studio-public/sections/EquipmentSection";
import { FooterMinimal } from "../sections/FooterMinimal";

// ── Constants ──────────────────────────────────────────────────────────────────
const BG    = "#0A0A0A";
const OFF   = "#111111";
const SERIF = "var(--font-playfair, 'Playfair Display', Georgia, serif)";
const SANS  = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

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
  portfolioTracks?: PortfolioTrack[];
  credits?: StudioCreditItem[];
  engineers?: StudioEngineerItem[];
  equipment?: EquipmentItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt12h(t: string) {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? "PM" : "AM"}`;
}
const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABELS: Record<string,string> = {
  monday:"Monday", tuesday:"Tuesday", wednesday:"Wednesday",
  thursday:"Thursday", friday:"Friday", saturday:"Saturday", sunday:"Sunday",
};

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

  if (status === "sent") return <p style={{ color: accent, fontFamily: SANS }}>We'll be in touch.</p>;

  const field: React.CSSProperties = {
    display: "block", width: "100%", backgroundColor: "transparent",
    border: "none", borderBottom: "1px solid rgba(255,255,255,0.12)",
    color: "#fff", fontFamily: SANS, fontSize: "0.95rem", padding: "0.85rem 0", outline: "none",
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <input type="text" name="website" value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} style={{ display:"none" }} tabIndex={-1} />
      <input style={field} placeholder="Your name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
      <input style={field} placeholder="Email" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required />
      <input style={field} placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} />
      <textarea style={{ ...field, resize: "none" }} rows={4} placeholder="Your project" value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} required />
      <button type="submit" disabled={status==="sending"}
        style={{ alignSelf: "flex-start", backgroundColor: accent, color: BG, border: "none", padding: "0.85rem 2.25rem", fontFamily: SANS, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
        {status === "sending" ? "Sending…" : "Send"}
      </button>
      {status === "error" && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>Something went wrong.</p>}
    </form>
  );
}

// ── Sticky Services Scroll ─────────────────────────────────────────────────────
function StickyServices({ services, slug, accent }: { services: ServiceItem[]; slug: string; accent: string }) {
  return (
    <section id="services" style={{ backgroundColor: BG, padding: "8rem 2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "start" }}>
        {/* Sticky left label */}
        <div style={{ position: "sticky", top: "8rem" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "1.25rem" }}>
            What We Do
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 700, lineHeight: 1.05, color: "#fff" }}>
            Services
          </h2>
          <a href={`/${slug}/book`} style={{
            display: "inline-block", marginTop: "3rem",
            backgroundColor: accent, color: BG, padding: "0.85rem 2rem",
            fontFamily: SANS, fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase",
            textDecoration: "none",
          }}>
            Book a Session
          </a>
        </div>
        {/* Scrolling right column */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {services.map((s, i) => (
            <div key={i} style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              padding: "2.5rem 0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <p style={{ fontFamily: SERIF, fontSize: "1.35rem", fontWeight: 700, color: "#fff" }}>{s.name}</p>
                {s.price && <p style={{ fontSize: "0.9rem", color: accent, fontWeight: 700 }}>{s.price}</p>}
              </div>
              {s.description && (
                <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "rgba(255,255,255,0.45)", marginBottom: "1rem" }}>{s.description}</p>
              )}
              <a href={`/${slug}/book`} style={{ fontSize: "0.75rem", fontWeight: 700, color: accent, textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Book this →
              </a>
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
        </div>
      </div>
    </section>
  );
}

// ── Mosaic Gallery ─────────────────────────────────────────────────────────────
function MosaicGallery({ images }: { images: string[] }) {
  // Build mosaic: irregular mix of tall/wide/square cells
  const patterns = [
    { colSpan: 2, rowSpan: 1 }, // wide
    { colSpan: 1, rowSpan: 2 }, // tall
    { colSpan: 1, rowSpan: 1 }, // square
    { colSpan: 1, rowSpan: 1 }, // square
    { colSpan: 1, rowSpan: 2 }, // tall
    { colSpan: 2, rowSpan: 1 }, // wide
    { colSpan: 1, rowSpan: 1 }, // square
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridAutoRows: "220px",
      gap: "8px",
    }}>
      {images.slice(0, 7).map((src, i) => {
        const p = patterns[i] ?? { colSpan: 1, rowSpan: 1 };
        return (
          <div key={i} style={{
            gridColumn: `span ${p.colSpan}`,
            gridRow: `span ${p.rowSpan}`,
            overflow: "hidden", backgroundColor: "#1a1a1a",
          }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.6s ease" }}
              onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.04)")}
              onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")} />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────────
export function GridTemplate({ studio, services, testimonials, fullAddress, mapQuery, socials, portfolioTracks = [], credits = [], engineers = [], equipment = [] }: Props) {
  const { slug } = studio;
  const accent = studio.accentColor ?? "#D4A843";
  const gallery: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages as string[] : [];
  const hours = studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }> | null;

  const socialIcons: Record<string, React.ReactNode> = {
    Instagram: <Instagram size={14} />, Twitter: <Twitter size={14} />,
    Facebook: <Facebook size={14} />, YouTube: <Youtube size={14} />, TikTok: <Music2 size={14} />,
  };

  return (
    <div style={{ backgroundColor: BG, color: "#fff", fontFamily: SANS }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: BG, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 2rem", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, letterSpacing: "0.01em" }}>{studio.name}</span>
          <nav style={{ display: "flex", gap: "1.75rem", alignItems: "center" }}>
            {services.length > 0 && <a href="#services" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.06em" }}>Services</a>}
            {studio.bio && <a href="#about" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.06em" }}>About</a>}
            <a href={`/${slug}/book`} style={{ backgroundColor: accent, color: BG, padding: "0.5rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textDecoration: "none" }}>
              Book
            </a>
          </nav>
        </div>
      </header>

      {/* ── HERO — massive text + inset photo ────────────────────────────── */}
      <section style={{ padding: "4rem 2rem 2rem", position: "relative", overflow: "hidden", backgroundColor: BG }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", position: "relative" }}>
          {/* Massive studio name */}
          <h1 style={{
            fontFamily: SERIF,
            fontSize: "clamp(4rem, 14vw, 14rem)",
            fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em",
            color: "#fff",
            margin: 0,
            userSelect: "none",
          }}>
            {studio.name}
          </h1>
          {/* Inset photo overlapping text */}
          {studio.heroImage && (
            <div style={{
              position: "absolute", right: "0", top: "50%", transform: "translateY(-50%)",
              width: "clamp(200px, 28vw, 400px)", height: "clamp(260px, 36vw, 520px)",
              overflow: "hidden", border: `3px solid ${accent}`,
              zIndex: 2,
            }}>
              <img src={studio.heroImage} alt={studio.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
        </div>
        {/* Tagline + CTA row below title */}
        <div style={{ maxWidth: "1400px", margin: "2rem auto 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "2rem" }}>
          {studio.tagline && (
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", maxWidth: "500px", lineHeight: 1.6 }}>{studio.tagline}</p>
          )}
          <div style={{ display: "flex", gap: "1rem" }}>
            <a href={`/${slug}/book`} style={{ backgroundColor: accent, color: BG, padding: "0.85rem 2rem", fontFamily: SANS, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
              Book Now
            </a>
            {services.length > 0 && (
              <a href="#services" style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "0.85rem 2rem", fontFamily: SANS, fontWeight: 600, fontSize: "0.8rem", letterSpacing: "0.06em", textDecoration: "none" }}>
                Our Services
              </a>
            )}
          </div>
        </div>
        {/* Issue/date bar */}
        <div style={{ maxWidth: "1400px", margin: "2rem auto 0", display: "flex", gap: "2rem", borderTop: "2px solid #fff", paddingTop: "1rem" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
            Professional Recording Studio
          </span>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent }}>
            Est. {new Date().getFullYear()}
          </span>
          {fullAddress && (
            <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              {studio.city ?? ""}{studio.state ? `, ${studio.state}` : ""}
            </span>
          )}
        </div>
      </section>

      {/* ── SERVICES — sticky scroll ──────────────────────────────────────── */}
      {services.length > 0 && <StickyServices services={services} slug={slug} accent={accent} />}

      {/* ── PORTFOLIO ────────────────────────────────────────────────────── */}
      {portfolioTracks.length > 0 && (
        <section style={{ backgroundColor: BG, padding: "7rem 2rem" }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <PortfolioSection tracks={portfolioTracks} accent={accent} dark />
          </div>
        </section>
      )}

      {/* ── CREDITS ──────────────────────────────────────────────────────── */}
      {credits.length > 0 && (
        <section style={{ backgroundColor: OFF, padding: "7rem 2rem" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <CreditsSection credits={credits} accent={accent} dark />
          </div>
        </section>
      )}

      {/* ── ENGINEERS ────────────────────────────────────────────────────── */}
      {engineers.length > 0 && (
        <section style={{ backgroundColor: BG, padding: "7rem 2rem" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <EngineersSection engineers={engineers} accent={accent} dark />
          </div>
        </section>
      )}

      {/* ── GALLERY — mosaic ─────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section style={{ backgroundColor: OFF, padding: "6rem 2rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem" }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent }}>
                The Space
              </p>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                {gallery.length} Photos
              </p>
            </div>
            <MosaicGallery images={gallery} />
          </div>
        </section>
      )}

      {/* ── ABOUT — large pull-quote ──────────────────────────────────────── */}
      {studio.bio && (
        <section id="about" style={{ backgroundColor: BG, padding: "8rem 2rem" }}>
          {/* Full-bleed label bar */}
          <div style={{ borderTop: "2px solid rgba(255,255,255,0.08)", borderBottom: "2px solid rgba(255,255,255,0.08)", padding: "0.6rem 2rem", marginBottom: "5rem" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent }}>About</span>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>Studio Profile</span>
            </div>
          </div>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            {/* Pull-quote style bio */}
            <p style={{
              fontFamily: SERIF, fontSize: "clamp(1.25rem, 2.75vw, 2rem)",
              fontStyle: "italic", lineHeight: 1.7, color: "rgba(255,255,255,0.85)",
              borderLeft: `4px solid ${accent}`, paddingLeft: "2.5rem", marginBottom: "3rem",
            }}>
              &ldquo;{studio.bio}&rdquo;
            </p>
            <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginLeft: "calc(2.5rem + 4px)" }}>
              — {studio.name}
            </p>
          </div>
          {hours && (
            <div style={{ maxWidth: "900px", margin: "4rem auto 0", paddingLeft: "calc(2.5rem + 4px)" }}>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: "1.25rem" }}>Hours</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem 3rem" }}>
                {DAYS.map(day => {
                  const d = (hours as Record<string, { open: boolean; openTime: string; closeTime: string }>)[day];
                  if (!d) return null;
                  return (
                    <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.4rem" }}>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>{DAY_LABELS[day]}</span>
                      <span style={{ color: d.open ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)" }}>
                        {d.open ? `${fmt12h(d.openTime)} – ${fmt12h(d.closeTime)}` : "Closed"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {studio.hoursNote && <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", marginTop: "1rem" }}>{studio.hoursNote}</p>}
            </div>
          )}
        </section>
      )}

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section style={{ backgroundColor: OFF, padding: "7rem 2rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "1rem", marginBottom: "4rem", display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent }}>Artist Reviews</p>
              <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>{testimonials.length} Reviews</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "3rem" }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{ borderTop: `2px solid ${accent}`, paddingTop: "1.5rem" }}>
                  <p style={{ fontFamily: SERIF, fontSize: "1rem", fontStyle: "italic", lineHeight: 1.75, color: "rgba(255,255,255,0.7)", marginBottom: "1.25rem" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>{t.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── EQUIPMENT ────────────────────────────────────────────────────── */}
      {equipment.length > 0 && (
        <section style={{ backgroundColor: OFF, padding: "7rem 2rem" }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <EquipmentSection equipment={equipment} accent={accent} dark />
          </div>
        </section>
      )}

      {/* ── BOOKING CTA — narrow centered ────────────────────────────────── */}
      <section style={{ padding: "9rem 2rem", textAlign: "center", backgroundColor: BG, position: "relative", overflow: "hidden" }}>
        {/* Large ghost text behind */}
        <p style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          fontFamily: SERIF, fontSize: "clamp(6rem, 20vw, 16rem)", fontWeight: 900,
          color: "rgba(255,255,255,0.02)", whiteSpace: "nowrap", pointerEvents: "none", userSelect: "none",
          lineHeight: 1,
        }}>
          Record
        </p>
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent, marginBottom: "1.5rem" }}>
            Reserve Your Time
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 6vw, 5rem)", fontWeight: 700, lineHeight: 1.1, marginBottom: "2.5rem" }}>
            Let's Start Creating
          </h2>
          <a href={`/${slug}/book`} style={{
            display: "inline-block", backgroundColor: accent, color: BG,
            padding: "1rem 3rem", fontFamily: SANS, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase",
            textDecoration: "none",
          }}>
            Book Your Session
          </a>
        </div>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" style={{ backgroundColor: OFF, padding: "7rem 2rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Header bar */}
          <div style={{ borderTop: "2px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0.75rem 0", marginBottom: "4rem", display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: accent }}>Contact</p>
            {studio.email && <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>{studio.email}</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem" }}>
            <ContactForm studioId={studio.id} accent={accent} />
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
                {fullAddress && <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>{fullAddress}</p>}
                {studio.phone && <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>{studio.phone}</p>}
              </div>
              {socials.length > 0 && (
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
                  {socials.map((s, i) => (
                    <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                      style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e=>(e.currentTarget.style.color=accent)}
                      onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.35)")}>
                      {socialIcons[s.label] ?? null}
                    </a>
                  ))}
                </div>
              )}
              {fullAddress && (
                <div style={{ height: "240px", overflow: "hidden" }}>
                  <iframe src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Map" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <FooterMinimal
        studio={studio}
        slug={studio.slug}
        fullAddress={fullAddress}
        socials={socials}
        content={{}}
        accent={accent}
        services={[]}
        testimonials={[]}
        featuredArtists={[]}
        mapQuery=""
        galleryImages={[]}
      />
    </div>
  );
}
