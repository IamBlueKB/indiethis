"use client";

import { useEffect, useState } from "react";
import { CleanTemplate } from "@/components/studio-public/templates/CleanTemplate";
import { CinematicTemplate } from "@/components/studio-public/templates/CinematicTemplate";
import { GridTemplate } from "@/components/studio-public/templates/GridTemplate";
import { CustomTemplate } from "@/components/studio-public/templates/CustomTemplate";
import { DefaultTemplate } from "@/components/studio-public/templates/DefaultTemplate";
import type { PageConfig } from "@/types/page-config";

type ServiceItem = { name: string; price?: string; description?: string };
type Testimonial = { quote: string; author: string; track?: string };

interface Props {
  initialStudio: Record<string, unknown>;
  initialTemplate: string;
  initialPageConfig: unknown;
  initialServices: ServiceItem[];
  initialTestimonials: Testimonial[];
}

function buildTemplateProps(studio: Record<string, unknown>, services: ServiceItem[], testimonials: Testimonial[]) {
  const fullAddress = [studio.streetAddress, studio.city, studio.state, studio.zipCode]
    .filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent((fullAddress || studio.name) as string);
  const socials = [
    studio.instagram && { label: "Instagram", href: `https://instagram.com/${String(studio.instagram).replace(/^@/, "")}` },
    studio.tiktok    && { label: "TikTok",    href: `https://tiktok.com/@${String(studio.tiktok).replace(/^@/, "")}` },
    studio.facebook  && { label: "Facebook",  href: String(studio.facebook).startsWith("http") ? String(studio.facebook) : `https://facebook.com/${studio.facebook}` },
    studio.youtube   && { label: "YouTube",   href: String(studio.youtube) },
    studio.twitter   && { label: "Twitter / X", href: `https://twitter.com/${String(studio.twitter).replace(/^@/, "")}` },
  ].filter(Boolean) as { label: string; href: string }[];
  const galleryImages: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages as string[] : [];
  return { studio, services, testimonials, featuredArtists: [], fullAddress, mapQuery, socials, galleryImages };
}

export function FrameClient({ initialStudio, initialTemplate, initialPageConfig, initialServices, initialTestimonials }: Props) {
  const [studio, setStudio] = useState(initialStudio);
  const [template, setTemplate] = useState(initialTemplate);
  const [pageConfig, setPageConfig] = useState<PageConfig | null>(initialPageConfig as PageConfig | null);
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "DRAFT_UPDATE") return;
      const p = e.data.payload;
      if (p.studio)      setStudio(p.studio);
      if (p.template)    setTemplate(p.template);
      if (p.pageConfig !== undefined) setPageConfig(p.pageConfig);
      if (p.services)    setServices(p.services);
      if (p.testimonials) setTestimonials(p.testimonials);
    }
    window.addEventListener("message", onMessage);
    // Signal ready to parent
    window.parent.postMessage({ type: "FRAME_READY" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const studioWithPageConfig = { ...studio, pageConfig, template };
  const props = buildTemplateProps(studioWithPageConfig, services, testimonials);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyProps = props as any;
  if (template === "CLEAN")      return <CleanTemplate     {...anyProps} />;
  if (template === "CINEMATIC")  return <CinematicTemplate {...anyProps} />;
  if (template === "GRID")       return <GridTemplate      {...anyProps} />;
  if (template === "CUSTOM")     return <CustomTemplate    {...anyProps} />;

  const style = (template === "BOLD" || template === "EDITORIAL") ? template : "CLASSIC";
  return <DefaultTemplate {...anyProps} templateStyle={style} />;
}
