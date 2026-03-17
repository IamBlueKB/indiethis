import type { PageConfig, SectionConfig, SectionType, SectionVariant } from "@/types/page-config";
import { STYLE_DEFAULTS } from "@/types/page-config";
import { ConfigRenderer } from "../ConfigRenderer";
import type { SectionSharedProps } from "../ConfigRenderer";

type TemplateStyle = "CLASSIC" | "BOLD" | "EDITORIAL";

type DefaultTemplateProps = Omit<SectionSharedProps, "content" | "slug" | "accent"> & {
  templateStyle: TemplateStyle;
};

// Font pairing per style
const FONT_PAIRINGS: Record<TemplateStyle, PageConfig["fontPairing"]> = {
  CLASSIC:   "playfair-dm",
  BOLD:      "space-grotesk",
  EDITORIAL: "dm-sans-only",
};

// Section order — controls render order in the default layout
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
  "footer",
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
  services,
  testimonials,
  featuredArtists,
  fullAddress,
  mapQuery,
  socials,
  templateStyle,
}: DefaultTemplateProps) {
  const config = buildConfig(templateStyle, studio, services, testimonials, featuredArtists, fullAddress);

  return (
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
  );
}
