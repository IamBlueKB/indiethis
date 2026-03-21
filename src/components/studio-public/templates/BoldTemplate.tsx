"use client";
import type React from "react";
import { MapPin, Phone, Mail, Clock, Instagram, Twitter, Facebook, Youtube, Music2 } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "../shared/ContactForm";
import { GalleryGrid } from "../shared/GalleryGrid";
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

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  "Instagram":  Instagram,
  "Twitter / X": Twitter,
  "Facebook":   Facebook,
  "TikTok":     Music2,
  "YouTube":    Youtube,
};

// Bold: high-impact, full-bleed, dark + neon accent, Supreme x Studio energy
export function BoldTemplate({ studio, services, featuredArtists, fullAddress, mapQuery, socials }: Props) {
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

  function fmt12h(time: string) {
    const [hStr, mStr] = time.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${mStr} ${ampm}`;
  }

  function renderHours() {
    if (studio.studioHours && typeof studio.studioHours === "object") {
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
      return (
        <div className="space-y-2">
          {days.map((day) => {
            const h = (studio.studioHours as any)[day];
            if (!h) return null;
            return (
              <div key={day} className="flex justify-between text-sm">
                <span className="font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{HOURS_LABELS[day]}</span>
                {h.open
                  ? <span style={{ color: "rgba(255,255,255,0.75)" }}>{fmt12h(h.openTime)} – {fmt12h(h.closeTime)}</span>
                  : <span style={{ color: "rgba(255,255,255,0.25)" }}>Closed</span>
                }
              </div>
            );
          })}
          {studio.hoursNote && (
            <p className="text-xs pt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{studio.hoursNote}</p>
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
    <div style={{ backgroundColor: "#080808", color: "#FAFAFA", fontFamily: "var(--font-dm-sans, sans-serif)" }}>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: "rgba(8,8,8,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {logo
              ? <img src={logo} alt={studio.name} style={{ height: "88px", width: "auto", filter: "invert(1)" }} className="object-contain" />
              : <span className="font-bold text-xl tracking-tight" style={{ fontFamily: "var(--font-playfair, serif)" }}>{studio.name}</span>
            }
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
            <a href="#services" className="hover:text-white transition-colors no-underline">Services</a>
            <a href="#about" className="hover:text-white transition-colors no-underline">About</a>
            <a href="#contact" className="hover:text-white transition-colors no-underline">Contact</a>
          </div>
          <a href={`/${slug}/book`}
            className="px-6 py-2.5 rounded-lg font-bold text-sm no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: "#080808" }}>
            Book Now
          </a>
        </div>
      </nav>

      {/* HERO — full viewport, cinematic */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 overflow-hidden"
        style={{
          minHeight: "100svh",
          paddingTop: "5rem",
          background: heroImg
            ? `linear-gradient(to bottom, rgba(8,8,8,0.25) 0%, rgba(8,8,8,0.55) 50%, #080808 100%), url(${heroImg}) center/cover no-repeat fixed`
            : `linear-gradient(160deg, #0f0f0f 0%, #080808 40%, #130d00 100%)`,
        }}
      >
        {/* radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${accent}0F 0%, transparent 70%)` }} />

        <p className="relative z-10 text-xs font-bold uppercase tracking-[0.4em] mb-6"
          style={{ color: accent }}>
          Professional Recording Studio
        </p>

        <h1 className="relative z-10 font-bold leading-none mb-6"
          style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "clamp(3.5rem, 10vw, 8rem)",
            textShadow: "0 4px 40px rgba(0,0,0,0.7)",
          }}>
          {studio.name}
        </h1>

        <p className="relative z-10 max-w-lg mx-auto mb-12 text-xl leading-relaxed"
          style={{ color: "rgba(255,255,255,0.55)" }}>
          {studio.tagline ?? "Premium Recording, Mixing & Mastering"}
        </p>

        <div className="relative z-10 flex flex-wrap gap-4 justify-center">
          <a href={`/${slug}/book`}
            className="px-10 py-4 rounded-xl font-bold text-base no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent, color: "#080808" }}>
            Book a Session →
          </a>
          {studio.phone && (
            <a href={`tel:${studio.phone}`}
              className="px-10 py-4 rounded-xl font-bold text-base no-underline border transition-colors hover:border-white/30"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA", backdropFilter: "blur(8px)" }}>
              {studio.phone}
            </a>
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Services</p>
            <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>What We Do</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {services.map((s) => (
              <div key={s.name}
                className="rounded-2xl p-7 border flex flex-col gap-4 group transition-all hover:border-[#D4A843]/30"
                style={{ backgroundColor: "#0f0f0f", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <p className="font-bold text-lg" style={{ fontFamily: "var(--font-playfair, serif)" }}>{s.name}</p>
                {s.description && <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.description}</p>}
                <a href={`/${slug}/book`}
                  className="mt-auto text-xs font-bold no-underline opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: accent }}>
                  Book this service →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY — asymmetric grid */}
      {gallery.length > 0 && (
        <section className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Inside the Studio</p>
              <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>The Space</h2>
            </div>
            <GalleryGrid images={gallery} accent={accent} />
          </div>
        </section>
      )}

      {/* ABOUT + HOURS */}
      {bio && (
        <section id="about" className="py-28 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>Our Story</p>
              <h2 className="font-bold mb-8" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                About the Studio
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
                {bio}
              </p>
            </div>
            {(studio.studioHours || studio.hours) && (
              <div className="rounded-2xl p-8 border" style={{ backgroundColor: "#0f0f0f", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 mb-6">
                  <Clock size={15} style={{ color: accent }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>Studio Hours</p>
                </div>
                {renderHours()}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FEATURED ARTISTS */}
      {featuredArtists.length > 0 && (
        <section className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Our Roster</p>
              <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>Featured Artists</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {featuredArtists.map((artist: any) => {
                const name = artist.artistName || artist.name;
                return (
                  <Link key={artist.id} href={`/${artist.artistSlug}`} className="no-underline group">
                    <div className="rounded-2xl overflow-hidden border transition-all group-hover:-translate-y-1 group-hover:border-[#D4A843]/30"
                      style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#0f0f0f" }}
                    >
                      <div className="aspect-square flex items-center justify-center text-4xl font-bold"
                        style={{
                          backgroundColor: "#1a1a1a",
                          backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
                          backgroundSize: "cover", backgroundPosition: "center", color: accent,
                        }}>
                        {!artist.photo && name[0].toUpperCase()}
                      </div>
                      <div className="p-4">
                        <p className="font-bold text-sm">{name}</p>
                        {artist.instagramHandle && (
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                            @{artist.instagramHandle.replace(/^@/, "")}
                          </p>
                        )}
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
      <section className="relative py-40 px-6 text-center overflow-hidden"
        style={{ background: `linear-gradient(160deg, #130d00 0%, #080808 50%, #0d0d0d 100%)` }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${accent}14 0%, transparent 70%)` }} />
        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-5" style={{ color: accent }}>Ready to Record?</p>
          <h2 className="font-bold mb-6"
            style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2.5rem, 7vw, 5rem)", lineHeight: 1.1 }}>
            Book Your Session<br />Today
          </h2>
          <p className="text-lg mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>
            Submit a request and we&apos;ll check availability, then reach out to confirm.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href={`/${slug}/book`}
              className="px-10 py-4 rounded-xl font-bold text-base no-underline hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent, color: "#080808" }}>
              Request a Session →
            </a>
            {studio.phone && (
              <a href={`tel:${studio.phone}`}
                className="px-10 py-4 rounded-xl font-bold text-base no-underline border transition-colors hover:border-white/30"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA" }}>
                Call {studio.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* GET IN TOUCH — contact form, standalone section */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Send a Message</p>
            <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>Get in Touch</h2>
          </div>
          <ContactForm studioId={studio.id} studioName={studio.name} accent={accent} />
        </div>
      </section>

      {/* CONTACT & MAP */}
      <section id="contact" className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Find Us</p>
            <h2 className="font-bold" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>Contact & Location</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              {fullAddress && (
                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}15` }}>
                    <MapPin size={18} style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Address</p>
                    <p className="font-medium">{fullAddress}</p>
                  </div>
                </div>
              )}
              {studio.phone && (
                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}15` }}>
                    <Phone size={18} style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Phone</p>
                    <a href={`tel:${studio.phone}`} className="font-medium no-underline hover:opacity-80">{studio.phone}</a>
                  </div>
                </div>
              )}
              {studio.email && (
                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}15` }}>
                    <Mail size={18} style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Email</p>
                    <a href={`mailto:${studio.email}`} className="font-medium no-underline hover:opacity-80">{studio.email}</a>
                  </div>
                </div>
              )}
              {socials.length > 0 && (
                <div className="flex gap-2">
                  {socials.map(({ label, href }) => {
                    const Icon = SOCIAL_ICONS[label];
                    if (!Icon) return null;
                    return (
                      <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                        className="w-10 h-10 rounded-xl flex items-center justify-center border no-underline transition-colors hover:border-[#D4A843]/50"
                        style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}>
                        <Icon size={17} />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
            {fullAddress && (
              <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
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
      />
    </div>
  );
}
