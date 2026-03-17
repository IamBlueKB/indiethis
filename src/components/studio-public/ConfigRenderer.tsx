import type { PageConfig } from "@/types/page-config";
import type React from "react";
import { SectionRenderer } from "./SectionRenderer";

// ── Shared props passed to every section component ────────────────────────────

export interface SectionSharedProps {
  content: Record<string, any>;
  studio: any;
  slug: string;
  accent: string;
  services: { name: string; description?: string; price?: string }[];
  testimonials: { quote: string; author: string; track?: string }[];
  featuredArtists: any[];
  fullAddress: string;
  mapQuery: string;
  socials: { label: string; href: string }[];
  galleryImages: string[];
}

// ── Font pairing → CSS font-family ───────────────────────────────────────────

const FONT_MAP: Record<string, string> = {
  "playfair-dm":   "'Playfair Display', Georgia, serif",
  "inter-serif":   "'Inter', system-ui, sans-serif",
  "space-grotesk": "'Space Grotesk', system-ui, sans-serif",
  "dm-sans-only":  "'DM Sans', system-ui, sans-serif",
};

// ── ConfigRenderer (main export) ─────────────────────────────────────────────

interface ConfigRendererProps {
  studio: any;
  config: PageConfig;
  services: SectionSharedProps["services"];
  testimonials: SectionSharedProps["testimonials"];
  featuredArtists: any[];
  fullAddress: string;
  mapQuery: string;
  socials: { label: string; href: string }[];
}

export function ConfigRenderer({
  studio,
  config,
  services,
  testimonials,
  featuredArtists,
  fullAddress,
  mapQuery,
  socials,
}: ConfigRendererProps) {
  const accent = config.accentColor || studio.accentColor || "#D4A843";
  const font = FONT_MAP[config.fontPairing] ?? FONT_MAP["dm-sans-only"];

  const galleryImages: string[] = Array.isArray(studio.galleryImages)
    ? (studio.galleryImages as string[])
    : [];

  const visibleSections = config.sections.filter((s) => s.visible);

  return (
    <div
      style={
        {
          "--studio-accent": accent,
          fontFamily: font,
          backgroundColor: "#0A0A0A",
          color: "#FAFAFA",
        } as React.CSSProperties
      }
    >
      {visibleSections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          studio={studio}
          accent={accent}
          services={services}
          testimonials={testimonials}
          featuredArtists={featuredArtists}
          fullAddress={fullAddress}
          mapQuery={mapQuery}
          socials={socials}
          galleryImages={galleryImages}
        />
      ))}
    </div>
  );
}
