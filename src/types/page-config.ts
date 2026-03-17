// ─── Page Config Types ────────────────────────────────────────────────────────
// The AI generates a PageConfig JSON object. The renderer reads it and builds
// the page using existing section components. Never stores raw HTML.

export type SectionType =
  | "hero"
  | "services"
  | "gallery"
  | "testimonials"
  | "featured_artists"
  | "about"
  | "booking_cta"
  | "contact_form"
  | "contact_location"
  | "footer";

export type FontPairing =
  | "playfair-dm"
  | "inter-serif"
  | "space-grotesk"
  | "dm-sans-only";

// ── Per-section variant sets by base style ────────────────────────────────────

export type HeroVariant       = "centered" | "full-bleed" | "split";
export type ServicesVariant   = "vertical-list" | "card-grid" | "minimal-list";
export type GalleryVariant    = "even-grid" | "asymmetric-grid" | "alternating-masonry";
export type AboutVariant      = "single-column" | "two-column" | "full-width-large";
export type TestimonialsVariant = "carousel" | "large-quote" | "staggered";
export type BookingCtaVariant = "simple" | "dramatic";
export type ContactFormVariant    = "standard";
export type ContactLocationVariant = "two-column-map";
export type FooterVariant     = "minimal" | "full";

export type SectionVariant =
  | HeroVariant
  | ServicesVariant
  | GalleryVariant
  | AboutVariant
  | TestimonialsVariant
  | BookingCtaVariant
  | ContactFormVariant
  | ContactLocationVariant
  | FooterVariant;

// ── Section-specific content shapes ──────────────────────────────────────────

export interface HeroContent {
  eyebrow?: string;
  headline?: string;
  tagline?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  showScrollIndicator?: boolean;
}

export interface ServicesContent {
  eyebrow?: string;
  headline?: string;
  showDescriptions?: boolean;
  showPricing?: boolean;
}

export interface GalleryContent {
  eyebrow?: string;
  headline?: string;
}

export interface AboutContent {
  eyebrow?: string;
  headline?: string;
  bio?: string;
  showHours?: boolean;
}

export interface TestimonialsContent {
  eyebrow?: string;
  headline?: string;
}

export interface FeaturedArtistsContent {
  eyebrow?: string;
  headline?: string;
}

export interface BookingCtaContent {
  eyebrow?: string;
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
}

export interface ContactFormContent {
  headline?: string;
  eyebrow?: string;
}

export interface ContactLocationContent {
  headline?: string;
  eyebrow?: string;
}

export interface FooterContent {
  showPoweredBy?: boolean;
}

// ── Core section config ───────────────────────────────────────────────────────

export interface SectionConfig {
  id: string;
  type: SectionType;
  visible: boolean;
  variant: SectionVariant;
  content: Record<string, any>;
}

// ── Top-level page config (what the AI generates and we store in pageConfig) ──

export interface PageConfig {
  accentColor: string;
  fontPairing: FontPairing;
  sections: SectionConfig[];
}

// ── Default variant sets per base style ──────────────────────────────────────

export const STYLE_DEFAULTS: Record<"CLASSIC" | "BOLD" | "EDITORIAL", Partial<Record<SectionType, SectionVariant>>> = {
  CLASSIC: {
    hero:          "centered",
    services:      "vertical-list",
    gallery:       "even-grid",
    about:         "single-column",
    testimonials:  "carousel",
    booking_cta:   "simple",
    contact_form:  "standard",
    contact_location: "two-column-map",
    footer:        "minimal",
  },
  BOLD: {
    hero:          "full-bleed",
    services:      "card-grid",
    gallery:       "asymmetric-grid",
    about:         "two-column",
    testimonials:  "large-quote",
    booking_cta:   "dramatic",
    contact_form:  "standard",
    contact_location: "two-column-map",
    footer:        "minimal",
  },
  EDITORIAL: {
    hero:          "split",
    services:      "minimal-list",
    gallery:       "alternating-masonry",
    about:         "full-width-large",
    testimonials:  "staggered",
    booking_cta:   "simple",
    contact_form:  "standard",
    contact_location: "two-column-map",
    footer:        "minimal",
  },
};
