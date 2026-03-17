"use client";
import { MapPin, Phone, Mail, Clock, Quote, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "../shared/ContactForm";

type ServiceItem  = { name: string; price: string; description: string };
type Testimonial  = { quote: string; author: string; track?: string };

type StudioData = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  bio: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  heroImage: string | null;
  logoUrl: string | null;
  logo: string | null;
  hours: string | null;
  studioHours: any;
  hoursNote: string | null;
  photos: string[];
  galleryImages: any;
  accentColor: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
};

type Props = {
  studio: StudioData;
  services: ServiceItem[];
  testimonials: Testimonial[];
  featuredArtists: any[];
  fullAddress: string;
  mapQuery: string;
  socials: { label: string; href: string }[];
};

// Editorial: magazine-style, grid-based, asymmetric, strong type contrast — think Rolling Stone
export function EditorialTemplate({ studio, services, testimonials, featuredArtists, fullAddress, mapQuery, socials }: Props) {
  const accent = studio.accentColor ?? "#D4A843";
  const heroImg = studio.heroImage;
  const gallery = (studio.galleryImages as string[] | null) ?? studio.photos;
  const bio = studio.bio ?? studio.description;
  const logo = studio.logoUrl ?? studio.logo;
  const slug = studio.slug;

  const HOURS_LABELS: Record<string, string> = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
    friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  };

  function renderHours() {
    if (studio.studioHours && typeof studio.studioHours === "object") {
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
      return (
        <div className="space-y-3">
          {days.map((day) => {
            const h = (studio.studioHours as any)[day];
            if (!h) return null;
            return (
              <div key={day} className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>{HOURS_LABELS[day]}</span>
                {h.open
                  ? <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>{h.openTime} – {h.closeTime}</span>
                  : <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>Closed</span>
                }
              </div>
            );
          })}
          {studio.hoursNote && (
            <p className="text-xs pt-2 italic" style={{ color: "rgba(255,255,255,0.3)" }}>{studio.hoursNote}</p>
          )}
        </div>
      );
    }
    if (studio.hours) {
      return <p className="text-sm whitespace-pre-line" style={{ color: "rgba(255,255,255,0.6)" }}>{studio.hours}</p>;
    }
    return null;
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#FAFAFA", fontFamily: "var(--font-dm-sans, sans-serif)" }}>

      {/* NAV — minimal top bar, editorial style */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt={studio.name} className="w-7 h-7 object-contain" />}
            <span className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: "rgba(255,255,255,0.7)" }}>{studio.name}</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>
            <a href="#services" className="hover:text-white transition-colors no-underline">Services</a>
            <a href="#about" className="hover:text-white transition-colors no-underline">About</a>
            <a href="#contact" className="hover:text-white transition-colors no-underline">Contact</a>
          </div>
          <a href={`/${slug}/intake`}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] no-underline transition-opacity hover:opacity-70"
            style={{ color: accent }}>
            Book Now <ArrowRight size={12} />
          </a>
        </div>
      </nav>

      {/* HERO — editorial split layout */}
      <section className="relative min-h-[90vh] grid md:grid-cols-2">
        {/* Left: text */}
        <div className="flex flex-col justify-center px-8 md:px-16 py-24 order-2 md:order-1">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-8" style={{ color: accent }}>
            {fullAddress ? `${fullAddress.split(",").slice(-2, -1)[0]?.trim() ?? "Studio"} · Est. 2018` : "Recording Studio"}
          </p>
          <h1 className="font-bold leading-none mb-8"
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: "clamp(3rem, 8vw, 6.5rem)",
              lineHeight: 0.95,
            }}>
            {studio.name}
          </h1>
          {studio.tagline && (
            <p className="text-xl leading-relaxed mb-10 max-w-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {studio.tagline}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <a href={`/${slug}/intake`}
              className="flex items-center gap-2 px-8 py-3.5 rounded-lg font-bold text-sm no-underline hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent, color: "#080808" }}>
              Book a Session <ArrowRight size={14} />
            </a>
            {studio.phone && (
              <a href={`tel:${studio.phone}`}
                className="flex items-center gap-2 px-8 py-3.5 rounded-lg font-bold text-sm no-underline"
                style={{ color: "rgba(255,255,255,0.5)", borderBottom: `1px solid rgba(255,255,255,0.15)` }}>
                {studio.phone}
              </a>
            )}
          </div>
        </div>

        {/* Right: hero image */}
        <div className="relative min-h-64 order-1 md:order-2"
          style={{
            backgroundImage: heroImg ? `url(${heroImg})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: heroImg ? undefined : "#111",
          }}>
          {!heroImg && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)" }}>Studio Photo</span>
            </div>
          )}
          {/* editorial dividing line */}
          <div className="absolute left-0 top-0 bottom-0 w-px hidden md:block"
            style={{ background: `linear-gradient(to bottom, transparent, ${accent}, transparent)` }} />
        </div>
      </section>

      {/* EDITORIAL DIVIDER */}
      <div className="max-w-7xl mx-auto px-8 py-8 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-6">
          <div className="h-px flex-1" style={{ backgroundColor: `${accent}30` }} />
          <p className="text-xs font-bold uppercase tracking-[0.4em]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Services · Artists · Booking
          </p>
          <div className="h-px flex-1" style={{ backgroundColor: `${accent}30` }} />
        </div>
      </div>

      {/* SERVICES — editorial list style */}
      <section id="services" className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[280px_1fr] gap-16">
            <div className="sticky top-24 h-fit">
              <p className="text-xs font-bold uppercase tracking-[0.4em] mb-3" style={{ color: accent }}>Services</p>
              <h2 className="font-bold text-4xl mb-6" style={{ fontFamily: "var(--font-playfair, serif)", lineHeight: 1.1 }}>
                What We<br />Do
              </h2>
              <a href={`/${slug}/intake`}
                className="inline-flex items-center gap-2 text-sm font-bold no-underline transition-opacity hover:opacity-70"
                style={{ color: accent }}>
                Book a session <ArrowRight size={13} />
              </a>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {services.map((s, i) => (
                <div key={s.name}
                  className="flex items-start justify-between gap-8 py-7 group"
                >
                  <div className="flex items-start gap-6 flex-1">
                    <span className="text-xs font-bold w-6 shrink-0 mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-bold text-xl mb-2" style={{ fontFamily: "var(--font-playfair, serif)" }}>{s.name}</p>
                      {s.description && <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.description}</p>}
                    </div>
                  </div>
                  {s.price && (
                    <span className="text-lg font-bold shrink-0" style={{ color: accent }}>{s.price}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY — masonry-style grid */}
      {gallery.length > 0 && (
        <section className="py-24" style={{ backgroundColor: "#111" }}>
          <div className="max-w-7xl mx-auto px-8 mb-12">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.4em] mb-2" style={{ color: accent }}>Gallery</p>
                <h2 className="font-bold text-4xl" style={{ fontFamily: "var(--font-playfair, serif)" }}>The Space</h2>
              </div>
            </div>
          </div>
          <div className="px-8 grid grid-cols-12 gap-3">
            {gallery[0] && (
              <img src={gallery[0]} alt="Studio 1"
                className="col-span-7 h-96 object-cover rounded-2xl" />
            )}
            <div className="col-span-5 grid gap-3">
              {gallery[1] && (
                <img src={gallery[1]} alt="Studio 2"
                  className="h-[186px] object-cover rounded-2xl w-full" />
              )}
              {gallery[2] && (
                <img src={gallery[2]} alt="Studio 3"
                  className="h-[186px] object-cover rounded-2xl w-full" />
              )}
            </div>
            {gallery.slice(3).map((url, i) => (
              <img key={i} src={url} alt={`Studio ${i + 4}`}
                className="col-span-4 h-56 object-cover rounded-2xl" />
            ))}
          </div>
        </section>
      )}

      {/* ABOUT — editorial column layout */}
      {bio && (
        <section id="about" className="py-24 px-8">
          <div className="max-w-7xl mx-auto grid md:grid-cols-[1fr_320px] gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: accent }}>About</p>
              <p className="leading-relaxed mb-0"
                style={{ color: "rgba(255,255,255,0.65)", fontSize: "1.125rem", lineHeight: 1.8, maxWidth: "60ch" }}>
                {bio}
              </p>
            </div>
            {(studio.studioHours || studio.hours) && (
              <div className="border-l pl-8" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 mb-6">
                  <Clock size={13} style={{ color: accent }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>Hours</p>
                </div>
                {renderHours()}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TESTIMONIALS — editorial pull-quote style */}
      {testimonials.length > 0 && (
        <section className="py-24 px-8 border-y" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#111" }}>
          <div className="max-w-7xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-12" style={{ color: accent }}>Artist Reviews</p>
            <div className="grid md:grid-cols-3 gap-1">
              {testimonials.map((t, i) => (
                <div key={i} className={`p-8 ${i < testimonials.length - 1 ? "border-r" : ""}`}
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="text-2xl font-bold mb-6 leading-snug"
                    style={{ fontFamily: "var(--font-playfair, serif)", color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-bold text-sm">{t.author}</p>
                    {t.track && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{t.track}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED ARTISTS */}
      {featuredArtists.length > 0 && (
        <section className="py-24 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.4em] mb-2" style={{ color: accent }}>Roster</p>
                <h2 className="font-bold text-4xl" style={{ fontFamily: "var(--font-playfair, serif)" }}>Featured Artists</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
              {featuredArtists.map((artist: any) => {
                const name = artist.artistName || artist.name;
                return (
                  <Link key={artist.id} href={`/${artist.artistSlug}`} className="no-underline group"
                    style={{ backgroundColor: "#0A0A0A" }}>
                    <div className="p-6 transition-colors group-hover:bg-white/3">
                      <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center text-xl font-bold"
                        style={{
                          backgroundColor: "#1a1a1a",
                          backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
                          backgroundSize: "cover", backgroundPosition: "center", color: accent,
                        }}>
                        {!artist.photo && name[0].toUpperCase()}
                      </div>
                      <p className="font-bold text-sm mb-0.5">{name}</p>
                      {artist.instagramHandle && (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          @{artist.instagramHandle.replace(/^@/, "")}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* BOOKING CTA — editorial full-bleed */}
      <section className="relative overflow-hidden"
        style={{
          background: heroImg
            ? `linear-gradient(to right, #0A0A0A 40%, rgba(10,10,10,0.3)), url(${heroImg}) right center/cover no-repeat`
            : `linear-gradient(135deg, #111 0%, #0A0A0A 100%)`,
          minHeight: 480,
        }}>
        <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 py-28 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: accent }}>Ready to Record?</p>
          <h2 className="font-bold mb-6"
            style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05 }}>
            Your Sound.<br />Your Session.
          </h2>
          <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "40ch" }}>
            Submit your intake form and we&apos;ll have your booking confirmed within the hour.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href={`/${slug}/intake`}
              className="flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base no-underline hover:opacity-90"
              style={{ backgroundColor: accent, color: "#080808" }}>
              Start Booking <ArrowRight size={16} />
            </a>
            <a href="#contact"
              className="flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base no-underline border"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA" }}>
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT — two-column editorial */}
      <section id="contact" className="py-24 px-8 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: accent }}>Get in Touch</p>
            <h2 className="font-bold text-4xl mb-10" style={{ fontFamily: "var(--font-playfair, serif)" }}>Contact</h2>
            <div className="space-y-6">
              {fullAddress && (
                <div className="flex items-start gap-4">
                  <MapPin size={14} style={{ color: accent, marginTop: 4, flexShrink: 0 }} />
                  <p style={{ color: "rgba(255,255,255,0.65)" }}>{fullAddress}</p>
                </div>
              )}
              {studio.phone && (
                <div className="flex items-center gap-4">
                  <Phone size={14} style={{ color: accent, flexShrink: 0 }} />
                  <a href={`tel:${studio.phone}`} className="no-underline hover:opacity-80" style={{ color: "rgba(255,255,255,0.65)" }}>{studio.phone}</a>
                </div>
              )}
              {studio.email && (
                <div className="flex items-center gap-4">
                  <Mail size={14} style={{ color: accent, flexShrink: 0 }} />
                  <a href={`mailto:${studio.email}`} className="no-underline hover:opacity-80" style={{ color: "rgba(255,255,255,0.65)" }}>{studio.email}</a>
                </div>
              )}
              {socials.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {socials.map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-[0.2em] no-underline hover:opacity-60 transition-opacity"
                      style={{ color: accent }}>
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {fullAddress && (
              <div className="mt-10 rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <iframe title="Studio location"
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  width="100%" height="280" style={{ border: 0 }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>Send a Message</p>
            <ContactForm studioId={studio.id} studioName={studio.name} accent={accent} />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-8 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.3)" }}>
            {studio.name}
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Powered by <span style={{ color: accent, fontWeight: 600 }}>IndieThis</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
