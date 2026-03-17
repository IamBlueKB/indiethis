import type React from "react";
import type { SectionConfig, SectionType } from "@/types/page-config";
import type { SectionSharedProps } from "./ConfigRenderer";

import { HeroCentered } from "./sections/hero/HeroCentered";
import { HeroFullBleed } from "./sections/hero/HeroFullBleed";
import { HeroSplit } from "./sections/hero/HeroSplit";

import { ServicesVerticalList } from "./sections/services/ServicesVerticalList";
import { ServicesCardGrid } from "./sections/services/ServicesCardGrid";
import { ServicesMinimalList } from "./sections/services/ServicesMinimalList";

import { GalleryEvenGrid } from "./sections/gallery/GalleryEvenGrid";
import { GalleryAsymmetricGrid } from "./sections/gallery/GalleryAsymmetricGrid";
import { GalleryAlternatingMasonry } from "./sections/gallery/GalleryAlternatingMasonry";

import { TestimonialsCarousel } from "./sections/testimonials/TestimonialsCarousel";
import { TestimonialsLargeQuote } from "./sections/testimonials/TestimonialsLargeQuote";
import { TestimonialsStaggered } from "./sections/testimonials/TestimonialsStaggered";

import { FeaturedArtistsCardGrid } from "./sections/featured-artists/FeaturedArtistsCardGrid";
import { FeaturedArtistsAvatarRow } from "./sections/featured-artists/FeaturedArtistsAvatarRow";
import { FeaturedArtistsPhotoScroll } from "./sections/featured-artists/FeaturedArtistsPhotoScroll";

import { AboutSingleColumn } from "./sections/about/AboutSingleColumn";
import { AboutTwoColumn } from "./sections/about/AboutTwoColumn";
import { AboutFullWidthLarge } from "./sections/about/AboutFullWidthLarge";

import { BookingCtaSimple } from "./sections/booking-cta/BookingCtaSimple";
import { BookingCtaDramatic } from "./sections/booking-cta/BookingCtaDramatic";

import { ContactFormStandard } from "./sections/ContactFormStandard";
import { ContactLocationTwoColumnMap } from "./sections/ContactLocationTwoColumnMap";
import { FooterMinimal } from "./sections/FooterMinimal";

// ── Component lookup: type → variant → component ─────────────────────────────

const SECTION_MAP: Record<SectionType, Record<string, React.ComponentType<SectionSharedProps>>> = {
  hero: {
    "centered":   HeroCentered,
    "full-bleed": HeroFullBleed,
    "split":      HeroSplit,
  },
  services: {
    "vertical-list": ServicesVerticalList,
    "card-grid":     ServicesCardGrid,
    "minimal-list":  ServicesMinimalList,
  },
  gallery: {
    "even-grid":           GalleryEvenGrid,
    "asymmetric-grid":     GalleryAsymmetricGrid,
    "alternating-masonry": GalleryAlternatingMasonry,
  },
  testimonials: {
    "carousel":    TestimonialsCarousel,
    "large-quote": TestimonialsLargeQuote,
    "staggered":   TestimonialsStaggered,
  },
  featured_artists: {
    "card-grid":    FeaturedArtistsCardGrid,
    "avatar-row":   FeaturedArtistsAvatarRow,
    "photo-scroll": FeaturedArtistsPhotoScroll,
  },
  about: {
    "single-column":    AboutSingleColumn,
    "two-column":       AboutTwoColumn,
    "full-width-large": AboutFullWidthLarge,
  },
  booking_cta: {
    "simple":   BookingCtaSimple,
    "dramatic": BookingCtaDramatic,
  },
  contact_form: {
    "standard": ContactFormStandard,
  },
  contact_location: {
    "two-column-map": ContactLocationTwoColumnMap,
  },
  footer: {
    "minimal": FooterMinimal,
    "full":    FooterMinimal,
  },
};

export function getSectionComponent(type: SectionType, variant: string): React.ComponentType<SectionSharedProps> | null {
  const typeMap = SECTION_MAP[type];
  if (!typeMap) return null;
  return typeMap[variant] ?? Object.values(typeMap)[0] ?? null;
}

// ── SectionRenderer ───────────────────────────────────────────────────────────

export function SectionRenderer({
  section,
  studio,
  accent,
  services,
  testimonials,
  featuredArtists,
  fullAddress,
  mapQuery,
  socials,
  galleryImages,
}: {
  section: SectionConfig;
  studio: any;
  accent: string;
  services: SectionSharedProps["services"];
  testimonials: SectionSharedProps["testimonials"];
  featuredArtists: any[];
  fullAddress: string;
  mapQuery: string;
  socials: { label: string; href: string }[];
  galleryImages: string[];
}) {
  const Component = getSectionComponent(section.type, section.variant);
  if (!Component) return null;

  const props: SectionSharedProps = {
    content: section.content,
    studio,
    slug: studio.slug,
    accent,
    services,
    testimonials,
    featuredArtists,
    fullAddress,
    mapQuery,
    socials,
    galleryImages,
  };

  return <Component {...props} />;
}
