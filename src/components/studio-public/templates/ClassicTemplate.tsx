"use client";
import { MapPin, Phone, Mail, Clock, Quote } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "../shared/ContactForm";
import { FooterMinimal } from "../sections/FooterMinimal";

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

// Classic: clean, Squarespace-professional, cream/white tones, serif headings
export function ClassicTemplate({ studio, services, testimonials, featuredArtists, fullAddress, mapQuery, socials }: Props) {
  const accent = studio.accentColor ?? "#D4A843";
  const heroImg = studio.heroImage;
  const gallery = (studio.galleryImages as string[] | null) ?? studio.photos;
  const bio = studio.bio ?? studio.description;
  const logo = studio.logoUrl ?? studio.logo;
  const slug = studio.slug;

  const HOURS_LABELS: Record<string, string> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
    friday: "Fri", saturday: "Sat", sunday: "Sun",
  };

  function renderHours() {
    if (studio.studioHours && typeof studio.studioHours === "object") {
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
      return (
        <div className="space-y-1.5">
          {days.map((day) => {
            const h = (studio.studioHours as any)[day];
            if (!h) return null;
            return (
              <div key={day} className="flex justify-between text-sm">
                <span className="font-medium" style={{ color: "rgba(10,10,10,0.7)" }}>{HOURS_LABELS[day]}</span>
                {h.open
                  ? <span style={{ color: "rgba(10,10,10,0.55)" }}>{h.openTime} – {h.closeTime}</span>
                  : <span style={{ color: "rgba(10,10,10,0.35)" }}>Closed</span>
                }
              </div>
            );
          })}
          {studio.hoursNote && (
            <p className="text-xs pt-1" style={{ color: "rgba(10,10,10,0.4)" }}>{studio.hoursNote}</p>
          )}
        </div>
      );
    }
    if (studio.hours) {
      return <p className="text-sm whitespace-pre-line" style={{ color: "rgba(10,10,10,0.6)" }}>{studio.hours}</p>;
    }
    return null;
  }

  return (
    <div style={{ backgroundColor: "#FAFAF8", color: "#0A0A0A", fontFamily: "var(--font-dm-sans, sans-serif)" }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: "rgba(250,250,248,0.95)", borderColor: "rgba(10,10,10,0.08)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt={studio.name} className="w-8 h-8 object-contain rounded" />}
            <span className="font-bold text-lg" style={{ fontFamily: "var(--font-playfair, serif)" }}>{studio.name}</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "rgba(10,10,10,0.55)" }}>
            <a href="#services" className="hover:text-black transition-colors no-underline">Services</a>
            <a href="#about" className="hover:text-black transition-colors no-underline">About</a>
            {testimonials.length > 0 && <a href="#testimonials" className="hover:text-black transition-colors no-underline">Reviews</a>}
            <a href="#contact" className="hover:text-black transition-colors no-underline">Contact</a>
          </div>
          <a href={`/${slug}/intake`}
            className="px-5 py-2 rounded-lg font-bold text-sm no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: "#fff" }}>
            Book Now
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 py-32 min-h-[85vh]"
        style={{
          background: heroImg
            ? `linear-gradient(to bottom, rgba(250,250,248,0.15) 0%, rgba(250,250,248,0.6) 60%, #FAFAF8 100%), url(${heroImg}) center/cover no-repeat`
            : `linear-gradient(135deg, #f5f0e8 0%, #FAFAF8 100%)`,
        }}
      >
        {logo && <img src={logo} alt={studio.name} className="w-16 h-16 object-contain mb-8 opacity-90" />}
        <p className="text-xs font-bold uppercase tracking-[0.35em] mb-4"
          style={{ color: accent }}>Recording Studio</p>
        <h1 className="font-bold leading-none mb-6 text-black"
          style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(3rem, 8vw, 6rem)" }}>
          {studio.name}
        </h1>
        {studio.tagline && (
          <p className="max-w-lg mx-auto mb-10 text-lg leading-relaxed" style={{ color: "rgba(10,10,10,0.55)" }}>
            {studio.tagline}
          </p>
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          <a href={`/${slug}/intake`}
            className="px-9 py-4 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent, color: "#fff" }}>
            Book a Session →
          </a>
          {studio.phone && (
            <a href={`tel:${studio.phone}`}
              className="px-9 py-4 rounded-xl font-bold text-sm no-underline border hover:border-current transition-colors"
              style={{ borderColor: "rgba(10,10,10,0.18)", color: "#0A0A0A" }}>
              {studio.phone}
            </a>
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-24 px-6" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>What We Offer</p>
            <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>Services & Pricing</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.name}
                className="bg-white rounded-2xl p-8 border hover:shadow-md transition-shadow flex flex-col gap-3"
                style={{ borderColor: "rgba(10,10,10,0.08)" }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-lg" style={{ fontFamily: "var(--font-playfair, serif)" }}>{s.name}</p>
                  {s.price && <span className="text-sm font-bold shrink-0" style={{ color: accent }}>{s.price}</span>}
                </div>
                {s.description && <p className="text-sm leading-relaxed" style={{ color: "rgba(10,10,10,0.5)" }}>{s.description}</p>}
                <a href={`/${slug}/intake`}
                  className="mt-auto text-xs font-bold no-underline transition-colors hover:opacity-80"
                  style={{ color: accent }}>
                  Book this →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>Our Story</p>
            <h2 className="font-bold mb-6" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              {fullAddress ? fullAddress.split(",")[1]?.trim() || "Our Studio" : "Our Studio"}
            </h2>
            {bio && (
              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(10,10,10,0.6)", lineHeight: 1.8 }}>{bio}</p>
            )}
            {(studio.studioHours || studio.hours) && (
              <div className="rounded-2xl p-6 border" style={{ backgroundColor: "#F5F0E8", borderColor: "rgba(10,10,10,0.08)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} style={{ color: accent }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>Studio Hours</p>
                </div>
                {renderHours()}
              </div>
            )}
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {gallery.slice(0, 4).map((url: string, i: number) => (
                <img key={i} src={url} alt="Studio"
                  className={`rounded-2xl object-cover w-full ${i === 0 ? "col-span-2 h-56" : "h-36"}`} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl aspect-square flex items-center justify-center border"
              style={{ backgroundColor: "#F5F0E8", borderColor: "rgba(10,10,10,0.08)" }}>
              <p className="text-sm" style={{ color: "rgba(10,10,10,0.25)" }}>Studio photos coming soon</p>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-24 px-6" style={{ backgroundColor: "#F5F0E8" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>From Artists</p>
              <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>What They Say</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-2xl p-8 border flex flex-col gap-5"
                  style={{ borderColor: "rgba(10,10,10,0.08)" }}>
                  <Quote size={22} style={{ color: accent, opacity: 0.5 }} />
                  <p className="text-base leading-relaxed flex-1" style={{ color: "rgba(10,10,10,0.65)", fontStyle: "italic", fontFamily: "var(--font-playfair, serif)" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-bold">{t.author}</p>
                    {t.track && <p className="text-xs mt-0.5" style={{ color: "rgba(10,10,10,0.35)" }}>{t.track}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED ARTISTS */}
      {featuredArtists.length > 0 && (
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Our Roster</p>
              <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>Featured Artists</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {featuredArtists.map((artist: any) => {
                const name = artist.artistName || artist.name;
                return (
                  <Link key={artist.id} href={`/${artist.artistSlug}`} className="no-underline group">
                    <div className="rounded-2xl overflow-hidden border transition-shadow hover:shadow-md"
                      style={{ borderColor: "rgba(10,10,10,0.08)" }}>
                      <div className="aspect-square flex items-center justify-center text-3xl font-bold"
                        style={{
                          backgroundColor: "#F5F0E8",
                          backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
                          backgroundSize: "cover", backgroundPosition: "center", color: accent,
                        }}>
                        {!artist.photo && name[0].toUpperCase()}
                      </div>
                      <div className="p-4 bg-white">
                        <p className="font-bold text-sm">{name}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* BOOKING CTA */}
      <section className="py-28 px-6 text-center" style={{ backgroundColor: "#0A0A0A", color: "#FAFAF8" }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-5" style={{ color: accent }}>Ready to Record?</p>
          <h2 className="font-bold mb-6 text-white"
            style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}>
            Book Your Session
          </h2>
          <p className="text-lg mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>
            Fill out our quick intake form — we&apos;ll confirm within the hour.
          </p>
          <a href={`/${slug}/intake`}
            className="inline-block px-10 py-4 rounded-xl font-bold text-base no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent, color: "#fff" }}>
            Start Your Booking →
          </a>
        </div>
      </section>

      {/* CONTACT & MAP */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Reach Out</p>
            <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>Contact & Location</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div className="space-y-6">
              {fullAddress && (
                <div className="flex items-start gap-4">
                  <MapPin size={16} style={{ color: accent, marginTop: 3, flexShrink: 0 }} />
                  <p className="text-base">{fullAddress}</p>
                </div>
              )}
              {studio.phone && (
                <div className="flex items-center gap-4">
                  <Phone size={16} style={{ color: accent, flexShrink: 0 }} />
                  <a href={`tel:${studio.phone}`} className="no-underline hover:opacity-70">{studio.phone}</a>
                </div>
              )}
              {studio.email && (
                <div className="flex items-center gap-4">
                  <Mail size={16} style={{ color: accent, flexShrink: 0 }} />
                  <a href={`mailto:${studio.email}`} className="no-underline hover:opacity-70">{studio.email}</a>
                </div>
              )}
              {socials.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {socials.map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg text-sm font-semibold border no-underline transition-colors hover:border-black/20"
                      style={{ borderColor: "rgba(10,10,10,0.12)", color: "rgba(10,10,10,0.55)" }}>
                      {label}
                    </a>
                  ))}
                </div>
              )}
              {/* Contact form */}
              <div className="pt-4 border-t" style={{ borderColor: "rgba(10,10,10,0.08)" }}>
                <p className="text-sm font-bold mb-4">Send us a message</p>
                <div style={{ backgroundColor: "#0A0A0A", borderRadius: 20, padding: 24 }}>
                  <ContactForm studioId={studio.id} studioName={studio.name} accent={accent} />
                </div>
              </div>
            </div>
            {fullAddress && (
              <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(10,10,10,0.1)" }}>
                <iframe title="Studio location"
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  width="100%" height="420" style={{ border: 0 }}
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <FooterMinimal
        studio={studio}
        slug={slug}
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
