"use client";

import { useState } from "react";
import { Instagram, Twitter, Facebook, Youtube, Music2 } from "lucide-react";
import { PortfolioSection, type PortfolioTrack } from "@/components/studio-public/sections/PortfolioSection";
import { CreditsSection, type StudioCreditItem } from "@/components/studio-public/sections/CreditsSection";
import { EngineersSection, type StudioEngineerItem } from "@/components/studio-public/sections/EngineersSection";
import { EquipmentSection, type EquipmentItem } from "@/components/studio-public/sections/EquipmentSection";
import { FooterMinimal } from "../sections/FooterMinimal";

// ── Constants ──────────────────────────────────────────────────────────────────
const BG   = "#FFFFFF";
const DARK = "#0A0A0A";
const MID  = "#F5F5F5";
const SANS = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

// ── Types ──────────────────────────────────────────────────────────────────────
type ServiceItem  = { name: string; price?: string; description?: string };
type Testimonial  = { quote: string; author: string; track?: string };
type Social       = { label: string; href: string };
type Studio = {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  heroImage?: string | null;
  logoUrl?: string | null;
  logo?: string | null;
  galleryImages?: unknown;
  studioHours?: unknown;
  hoursNote?: string | null;
  accentColor?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

interface Props {
  studio: Studio;
  services: ServiceItem[];
  testimonials: Testimonial[];
  fullAddress: string;
  mapQuery: string;
  socials: Social[];
  portfolioTracks?: PortfolioTrack[];
  credits?: StudioCreditItem[];
  engineers?: StudioEngineerItem[];
  equipment?: EquipmentItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt12h(t: string) {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr} ${suffix}`;
}

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABELS: Record<string, string> = {
  monday:"Mon", tuesday:"Tue", wednesday:"Wed",
  thursday:"Thu", friday:"Fri", saturday:"Sat", sunday:"Sun",
};

// ── Contact form ───────────────────────────────────────────────────────────────
function ContactForm({ studioId }: { studioId: string }) {
  const [form, setForm] = useState({ name:"", email:"", phone:"", message:"", website:"" });
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.website) return;
    setStatus("sending");
    try {
      const res = await fetch(`/api/studio/${studioId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch { setStatus("error"); }
  }

  const field = "block w-full border-b py-3 text-sm bg-transparent outline-none placeholder:text-gray-400 transition-colors focus:border-gray-900";

  if (status === "sent") return (
    <p className="text-sm font-medium" style={{ color: DARK }}>Message sent. We'll be in touch.</p>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <input type="text" name="website" value={form.website} onChange={e => setForm(p=>({...p,website:e.target.value}))} style={{ display:"none" }} tabIndex={-1} />
      <div className="grid sm:grid-cols-2 gap-6">
        <input className={field} style={{ borderColor: "#E5E5E5", color: DARK }} placeholder="Your name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
        <input className={field} style={{ borderColor: "#E5E5E5", color: DARK }} placeholder="Email" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required />
      </div>
      <input className={field} style={{ borderColor: "#E5E5E5", color: DARK }} placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} />
      <textarea className={field + " resize-none"} style={{ borderColor: "#E5E5E5", color: DARK }} rows={4} placeholder="Tell us about your project" value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} required />
      <button type="submit" disabled={status==="sending"}
        className="px-8 py-3 text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity"
        style={{ backgroundColor: DARK, color: BG, fontFamily: SANS }}>
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
      {status === "error" && <p className="text-sm text-red-500">Something went wrong. Please try again.</p>}
    </form>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────────
export function CleanTemplate({ studio, services, testimonials, fullAddress, mapQuery, socials, portfolioTracks = [], credits = [], engineers = [], equipment = [] }: Props) {
  const { slug } = studio;
  const accent = studio.accentColor ?? "#D4A843";
  const gallery: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages as string[] : [];
  const hours = studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }> | null;

  const socialIcons: Record<string, React.ReactNode> = {
    Instagram: <Instagram size={16} />, Twitter: <Twitter size={16} />,
    Facebook: <Facebook size={16} />, YouTube: <Youtube size={16} />,
    TikTok: <Music2 size={16} />,
  };

  return (
    <div style={{ backgroundColor: BG, color: DARK, fontFamily: SANS }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: BG, borderBottom: "1px solid #F0F0F0" }}>
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between" style={{ height: "64px" }}>
          {studio.logoUrl || studio.logo
            ? <img src={(studio.logoUrl ?? studio.logo)!} alt={studio.name} style={{ height: "32px", width: "auto", objectFit: "contain" }} />
            : <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>{studio.name}</span>
          }
          <nav className="hidden md:flex items-center gap-8">
            {services.length > 0 && <a href="#services" className="no-underline text-sm hover:opacity-60 transition-opacity" style={{ color: DARK }}>Services</a>}
            {studio.bio && <a href="#about" className="no-underline text-sm hover:opacity-60 transition-opacity" style={{ color: DARK }}>About</a>}
            <a href="#contact" className="no-underline text-sm hover:opacity-60 transition-opacity" style={{ color: DARK }}>Contact</a>
            <a href={`/${slug}/book`} className="no-underline text-sm font-semibold px-5 py-2 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: DARK, color: BG }}>
              Book Now
            </a>
          </nav>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        height: "70vh",
        backgroundImage: studio.heroImage
          ? `linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 100%), url(${studio.heroImage})`
          : `linear-gradient(160deg, #1a1a1a 0%, ${DARK} 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 2rem",
        color: BG,
      }}>
        <h1 style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "1.25rem" }}>
          {studio.name}
        </h1>
        {studio.tagline && (
          <p style={{ fontSize: "1.1rem", opacity: 0.75, maxWidth: "500px", marginBottom: "2.5rem", lineHeight: 1.6 }}>
            {studio.tagline}
          </p>
        )}
        <a href={`/${slug}/book`} className="no-underline"
          style={{ backgroundColor: BG, color: DARK, padding: "0.85rem 2.5rem", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Book a Session
        </a>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      {services.length > 0 && (
        <section id="services" style={{ padding: "7rem 2rem", backgroundColor: BG }}>
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "2.5rem" }}>
              Services
            </p>
            <div>
              {services.map((s, i) => (
                <div key={i} style={{ borderTop: `1px solid #F0F0F0`, padding: "1.75rem 0", display: "flex", alignItems: "flex-start", gap: "2rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#BDBDBD", minWidth: "2rem", paddingTop: "0.2rem" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <p style={{ fontWeight: 600, fontSize: "1rem" }}>{s.name}</p>
                      {s.price && <p style={{ fontSize: "0.875rem", color: "#888" }}>{s.price}</p>}
                    </div>
                    {s.description && (
                      <p style={{ fontSize: "0.875rem", color: "#888", marginTop: "0.4rem", lineHeight: 1.6 }}>{s.description}</p>
                    )}
                  </div>
                  <a href={`/${slug}/book`} style={{ fontSize: "0.75rem", fontWeight: 600, color: accent, textDecoration: "none", whiteSpace: "nowrap", paddingTop: "0.2rem" }}>
                    Book →
                  </a>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #F0F0F0" }} />
            </div>
          </div>
        </section>
      )}

      {/* ── PORTFOLIO ────────────────────────────────────────────────────── */}
      {portfolioTracks.length > 0 && (
        <section style={{ padding: "7rem 2rem", backgroundColor: MID }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <PortfolioSection tracks={portfolioTracks} accent={accent} dark={false} />
          </div>
        </section>
      )}

      {/* ── CREDITS ──────────────────────────────────────────────────────── */}
      {credits.length > 0 && (
        <section style={{ padding: "7rem 2rem", backgroundColor: BG }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <CreditsSection credits={credits} accent={accent} dark={false} />
          </div>
        </section>
      )}

      {/* ── ENGINEERS ────────────────────────────────────────────────────── */}
      {engineers.length > 0 && (
        <section style={{ padding: "7rem 2rem", backgroundColor: MID }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <EngineersSection engineers={engineers} accent={accent} dark={false} />
          </div>
        </section>
      )}

      {/* ── GALLERY ──────────────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section style={{ padding: "0 2rem 7rem", backgroundColor: BG }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "2rem" }}>
              The Space
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {gallery.slice(0, 6).map((src, i) => (
                <div key={i} style={{ overflow: "hidden", backgroundColor: MID, aspectRatio: "4/3" }}>
                  <img src={src} alt={`${studio.name} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ────────────────────────────────────────────────────────── */}
      {studio.bio && (
        <section id="about" style={{ padding: "7rem 2rem", backgroundColor: MID }}>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "2rem" }}>
              About
            </p>
            <p style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "#444" }}>{studio.bio}</p>
            {hours && (
              <div style={{ marginTop: "3.5rem", textAlign: "left", borderTop: "1px solid #E5E5E5", paddingTop: "2rem" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1.25rem", color: "#888" }}>Hours</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {DAYS.map(day => {
                    const d = (hours as Record<string, { open: boolean; openTime: string; closeTime: string }>)[day];
                    if (!d) return null;
                    return (
                      <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                        <span style={{ color: "#888" }}>{DAY_LABELS[day]}</span>
                        <span style={{ color: d.open ? DARK : "#BDBDBD" }}>{d.open ? `${fmt12h(d.openTime)} – ${fmt12h(d.closeTime)}` : "Closed"}</span>
                      </div>
                    );
                  })}
                </div>
                {studio.hoursNote && <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "1rem" }}>{studio.hoursNote}</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section style={{ padding: "6rem 2rem", backgroundColor: BG }}>
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "2.5rem" }}>
              What Artists Say
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
              {testimonials.map((t, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${accent}`, paddingLeft: "1.5rem" }}>
                  <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "#555", fontStyle: "italic" }}>&ldquo;{t.quote}&rdquo;</p>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, marginTop: "0.75rem", color: DARK }}>{t.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── EQUIPMENT ────────────────────────────────────────────────────── */}
      {equipment.length > 0 && (
        <section style={{ padding: "7rem 2rem", backgroundColor: BG }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <EquipmentSection equipment={equipment} accent={accent} dark={false} />
          </div>
        </section>
      )}

      {/* ── BOOKING CTA ──────────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 2rem", backgroundColor: DARK, textAlign: "center", color: BG }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "1.5rem" }}>
          Ready to Record?
        </p>
        <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "2rem", lineHeight: 1.1 }}>
          Let's Make Something Great
        </h2>
        <a href={`/${slug}/book`} style={{ display: "inline-block", backgroundColor: accent, color: DARK, padding: "1rem 2.5rem", fontWeight: 700, fontSize: "0.875rem", letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none" }}>
          Book a Session
        </a>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: "7rem 2rem", backgroundColor: BG }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem" }}>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "2rem" }}>
              Get in Touch
            </p>
            <ContactForm studioId={studio.id} />
          </div>
          <div>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#BDBDBD", marginBottom: "2rem" }}>
              Find Us
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem", fontSize: "0.9rem", color: "#555" }}>
              {fullAddress && <p>{fullAddress}</p>}
              {studio.phone && <p>{studio.phone}</p>}
              {studio.email && <p>{studio.email}</p>}
            </div>
            {socials.length > 0 && (
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
                {socials.map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#888", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", transition: "color 0.2s" }}
                    onMouseEnter={e=>(e.currentTarget.style.color=DARK)}
                    onMouseLeave={e=>(e.currentTarget.style.color="#888")}>
                    {socialIcons[s.label] ?? null}{s.label}
                  </a>
                ))}
              </div>
            )}
            {fullAddress && (
              <div style={{ height: "240px", backgroundColor: MID, overflow: "hidden" }}>
                <iframe
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Map" />
              </div>
            )}
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
      />
    </div>
  );
}
