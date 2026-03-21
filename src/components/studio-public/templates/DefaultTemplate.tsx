"use client";
import type { PageConfig, SectionConfig, SectionType, SectionVariant } from "@/types/page-config";
import { STYLE_DEFAULTS } from "@/types/page-config";
import { ConfigRenderer } from "../ConfigRenderer";
import type { SectionSharedProps } from "../ConfigRenderer";
import { PortfolioSection, type PortfolioTrack } from "../sections/PortfolioSection";
import { CreditsSection, type StudioCreditItem } from "../sections/CreditsSection";
import { EngineersSection, type StudioEngineerItem } from "../sections/EngineersSection";
import { StudioNav } from "../sections/StudioNav";
import { FooterMinimal } from "../sections/FooterMinimal";

type TemplateStyle = "CLASSIC" | "BOLD" | "EDITORIAL";

type DefaultTemplateProps = Omit<SectionSharedProps, "content" | "accent"> & {
  templateStyle: TemplateStyle;
  portfolioTracks?: PortfolioTrack[];
  credits?: StudioCreditItem[];
  engineers?: StudioEngineerItem[];
};

// Font pairing per style
const FONT_PAIRINGS: Record<TemplateStyle, PageConfig["fontPairing"]> = {
  CLASSIC:   "playfair-dm",
  BOLD:      "space-grotesk",
  EDITORIAL: "dm-sans-only",
};

// Section order — footer excluded so it can be rendered after portfolio/credits/engineers
const SECTION_ORDER: SectionType[] = [
  "hero",
  "services",
  "gallery",
  "about",
  "testimonials",
  "featured_artists",
  "booking_cta",
  "contact_form",
  "contact_location",
];

function makeSection(type: SectionType, variant: SectionVariant): SectionConfig {
  return { id: type, type, variant, visible: true, content: {} };
}

function buildConfig(
  templateStyle: TemplateStyle,
  studio: any,
  services: SectionSharedProps["services"],
  testimonials: SectionSharedProps["testimonials"],
  featuredArtists: any[],
  fullAddress: string,
): PageConfig {
  const defaults = STYLE_DEFAULTS[templateStyle];
  const galleryImages: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages : [];
  const hasAddress = Boolean(fullAddress);

  // Decide which contact section to use: prefer two-column-map if address exists
  const useLocationContact = hasAddress && defaults.contact_location;

  const sections: SectionConfig[] = SECTION_ORDER
    .filter((type) => {
      if (type === "services")          return services.length > 0;
      if (type === "gallery")           return galleryImages.length > 0;
      if (type === "testimonials")      return testimonials.length > 0;
      if (type === "featured_artists")  return featuredArtists.length > 0;
      if (type === "contact_form")      return !useLocationContact;
      if (type === "contact_location")  return Boolean(useLocationContact);
      return true; // hero, about, booking_cta, footer always included
    })
    .map((type) => {
      const variant = (defaults[type] ?? "standard") as SectionVariant;
      return makeSection(type, variant);
    });

  return {
    accentColor: studio.accentColor ?? "#D4A843",
    fontPairing: FONT_PAIRINGS[templateStyle],
    sections,
  };
}

export function DefaultTemplate({
  studio,
  slug,
  services,
  testimonials,
  featuredArtists,
  fullAddress,
  mapQuery,
  socials,
  templateStyle,
  portfolioTracks = [],
  credits = [],
  engineers = [],
}: DefaultTemplateProps) {
  const config = buildConfig(templateStyle, studio, services, testimonials, featuredArtists, fullAddress);
  const accent = studio.accentColor ?? "#D4A843";

  return (
    <>
      <StudioNav studio={studio} slug={slug} />
      <ConfigRenderer
        studio={studio}
        config={config}
        services={services}
        testimonials={testimonials}
        featuredArtists={featuredArtists}
        fullAddress={fullAddress}
        mapQuery={mapQuery}
        socials={socials}
      />

      {portfolioTracks.length > 0 && (
        <section style={{ padding: "6rem 2rem", backgroundColor: "#111" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <PortfolioSection tracks={portfolioTracks} accent={accent} dark />
          </div>
        </section>
      )}

      {credits.length > 0 && (
        <section style={{ padding: "6rem 2rem", backgroundColor: "#0A0A0A" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <CreditsSection credits={credits} accent={accent} dark />
          </div>
        </section>
      )}

      {engineers.length > 0 && (
        <section style={{ padding: "6rem 2rem", backgroundColor: "#111" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <EngineersSection engineers={engineers} accent={accent} dark />
          </div>
        </section>
      )}

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
    </>
  );
}
