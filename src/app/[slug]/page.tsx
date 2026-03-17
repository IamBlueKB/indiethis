import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Instagram, Youtube, Music2, ExternalLink } from "lucide-react";
import Link from "next/link";
import TrackList from "./TrackList";
import MerchGrid from "./MerchGrid";
import { CustomTemplate } from "@/components/studio-public/templates/CustomTemplate";
import { DefaultTemplate } from "@/components/studio-public/templates/DefaultTemplate";
import { CleanTemplate } from "@/components/studio-public/templates/CleanTemplate";
import { CinematicTemplate } from "@/components/studio-public/templates/CinematicTemplate";
import { GridTemplate } from "@/components/studio-public/templates/GridTemplate";
import { ConfigRenderer } from "@/components/studio-public/ConfigRenderer";
import type { PageConfig } from "@/types/page-config";

type ServiceItem  = { name: string; price: string; description: string };
type Testimonial  = { quote: string; author: string; track?: string };

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SITE  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function ArtistSite({ slug }: { slug: string }) {
  const artist = await db.user.findUnique({
    where: { artistSlug: slug },
    select: {
      id: true, name: true, artistName: true, bio: true, photo: true,
      instagramHandle: true, tiktokHandle: true, youtubeChannel: true,
      spotifyUrl: true, appleMusicUrl: true,
      artistSite: { select: { isPublished: true, draftMode: true, bioContent: true, heroImage: true, followGateEnabled: true } },
      tracks: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, title: true, fileUrl: true, coverArtUrl: true, price: true, plays: true } },
      merchProducts: { where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 6,
        select: { id: true, title: true, imageUrl: true, basePrice: true, artistMarkup: true, productType: true } },
      studios: { take: 1, include: { studio: { select: { slug: true, name: true } } } },
    },
  });

  if (!artist || !artist.artistSite?.isPublished) return null;

  const site = artist.artistSite;
  const displayName = artist.artistName || artist.name;
  const bio = site.bioContent || artist.bio;
  const studioSlug = artist.studios[0]?.studio?.slug;

  const socials = [
    { label: "Instagram", href: artist.instagramHandle ? `https://instagram.com/${artist.instagramHandle}` : null, icon: Instagram },
    { label: "YouTube", href: artist.youtubeChannel, icon: Youtube },
    { label: "Spotify", href: artist.spotifyUrl, icon: Music2 },
    { label: "Apple Music", href: artist.appleMusicUrl, icon: ExternalLink },
  ].filter((s) => s.href);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <div className="relative h-64 flex items-end"
        style={{ background: site.heroImage
          ? `linear-gradient(to bottom, transparent 40%, var(--background)), url(${site.heroImage}) center/cover`
          : "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)" }}>
        <div className="max-w-3xl mx-auto w-full px-6 pb-6 flex items-end gap-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0 border-2"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--accent)", color: "var(--accent)",
              backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
              backgroundSize: "cover", backgroundPosition: "center" }}>
            {!artist.photo && displayName[0].toUpperCase()}
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            {artist.artistName && artist.name !== displayName && <p className="text-sm text-white/60">{artist.name}</p>}
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        <div className="space-y-4">
          {bio && <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>}
          <div className="flex flex-wrap gap-3">
            {socials.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border no-underline hover:border-accent/60 transition-colors text-muted-foreground hover:text-foreground"
                style={{ borderColor: "var(--border)" }}>
                <Icon size={13} /> {label}
              </a>
            ))}
            {studioSlug && (
              <Link href={`/${studioSlug}/intake`}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold no-underline"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                Book a Session
              </Link>
            )}
          </div>
        </div>
        {artist.tracks.length > 0 && (
          <TrackList tracks={artist.tracks} followGateEnabled={site.followGateEnabled ?? false}
            instagramHandle={artist.instagramHandle ?? null} />
        )}
        {artist.merchProducts.length > 0 && (
          <MerchGrid products={artist.merchProducts} artistSlug={slug} justPurchased={false} />
        )}
        <p className="text-center text-xs text-muted-foreground pb-8">
          Powered by <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;

  // ── Studio? ───────────────────────────────────────────────────────────────
  const studio = await db.studio.findUnique({
    where: { slug },
    include: {
      artists: {
        take: 12,
        include: {
          artist: {
            select: {
              id: true, name: true, artistName: true, photo: true,
              instagramHandle: true, artistSlug: true,
              artistSite: { select: { isPublished: true } },
            },
          },
        },
      },
    },
  });

  if (studio) {
    // Not published → 404 (public page not live)
    if (!studio.isPublished) notFound();

    const services: ServiceItem[] = studio.servicesJson
      ? JSON.parse(studio.servicesJson)
      : studio.services.length > 0
        ? studio.services.map((s) => ({ name: s, price: "", description: "" }))
        : [
            { name: "Recording",        price: "",  description: "" },
            { name: "Mixing",           price: "",  description: "" },
            { name: "Mastering",        price: "",  description: "" },
            { name: "Vocal Production", price: "",  description: "" },
            { name: "Beat Making",      price: "",  description: "" },
            { name: "Podcast",          price: "",  description: "" },
          ];

    const testimonials: Testimonial[] = studio.testimonials ? JSON.parse(studio.testimonials) : [];

    const featuredArtists = studio.artists
      .map((a) => a.artist)
      .filter((a) => a.artistSite?.isPublished && a.artistSlug);

    const fullAddress = [studio.streetAddress, studio.city, studio.state, studio.zipCode]
      .filter(Boolean).join(", ");

    const mapQuery = encodeURIComponent(fullAddress || studio.name);

    const socials = [
      studio.instagram && { label: "Instagram", href: `https://instagram.com/${studio.instagram.replace(/^@/, "")}` },
      studio.twitter   && { label: "Twitter / X", href: `https://twitter.com/${studio.twitter.replace(/^@/, "")}` },
      studio.facebook  && { label: "Facebook", href: studio.facebook?.startsWith("http") ? studio.facebook : `https://facebook.com/${studio.facebook}` },
      studio.tiktok    && { label: "TikTok", href: `https://tiktok.com/@${studio.tiktok.replace(/^@/, "")}` },
      studio.youtube   && { label: "YouTube", href: studio.youtube },
    ].filter(Boolean) as { label: string; href: string }[];

    const templateProps = { studio, services, testimonials, featuredArtists, fullAddress, mapQuery, socials };

    // Template dispatch
    const template = studio.template ?? "CLASSIC";

    // ?preview=CLASSIC|BOLD|EDITORIAL — bypass stored config, show that template style live
    const previewStyle = (preview === "BOLD" || preview === "EDITORIAL" || preview === "CLASSIC")
      ? preview
      : null;

    if (previewStyle) {
      return <DefaultTemplate {...templateProps} templateStyle={previewStyle} />;
    }

    // CLEAN / CINEMATIC / GRID — always use their own renderer, never pageConfig
    if (template === "CLEAN")      return <CleanTemplate     {...templateProps} />;
    if (template === "CINEMATIC")  return <CinematicTemplate {...templateProps} />;
    if (template === "GRID")       return <GridTemplate      {...templateProps} />;

    // CUSTOM — always use CustomTemplate
    if (template === "CUSTOM")     return <CustomTemplate    {...templateProps} />;

    // CLASSIC / BOLD / EDITORIAL — use generated pageConfig if available, else DefaultTemplate fallback
    const pageConfig = studio.pageConfig as PageConfig | null;
    if (pageConfig?.sections?.length) {
      return (
        <ConfigRenderer
          studio={studio}
          config={pageConfig}
          services={services}
          testimonials={testimonials}
          featuredArtists={featuredArtists}
          fullAddress={fullAddress}
          mapQuery={mapQuery}
          socials={socials}
        />
      );
    }

    const style = (template === "BOLD" || template === "EDITORIAL") ? template : "CLASSIC";
    return <DefaultTemplate {...templateProps} templateStyle={style} />;
  }

  // ── Artist? ───────────────────────────────────────────────────────────────
  const artistPage = await ArtistSite({ slug });
  if (!artistPage) notFound();
  return artistPage;
}
