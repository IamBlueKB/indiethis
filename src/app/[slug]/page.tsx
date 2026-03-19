import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import TrackList from "./TrackList";
import MerchGrid from "./MerchGrid";
import ArtistHero from "./ArtistHero";
import PreSaveCampaignCard from "./PreSaveCampaignCard";
import VideoSection from "./VideoSection";
import ShowsSection from "./ShowsSection";
import SupportSection from "./SupportSection";
import { CustomTemplate } from "@/components/studio-public/templates/CustomTemplate";
import { DefaultTemplate } from "@/components/studio-public/templates/DefaultTemplate";
import { CleanTemplate } from "@/components/studio-public/templates/CleanTemplate";
import { CinematicTemplate } from "@/components/studio-public/templates/CinematicTemplate";
import { GridTemplate } from "@/components/studio-public/templates/GridTemplate";
import { ConfigRenderer } from "@/components/studio-public/ConfigRenderer";
import type { PageConfig } from "@/types/page-config";
import PageViewTracker from "@/components/studio/PageViewTracker";

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
      artistSite: { select: { isPublished: true, draftMode: true, bioContent: true, heroImage: true, followGateEnabled: true, showVideos: true, pwywEnabled: true } },
      tracks: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, title: true, fileUrl: true, coverArtUrl: true, price: true, plays: true } },
      merchProducts: { where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 6,
        select: { id: true, title: true, imageUrl: true, basePrice: true, artistMarkup: true, productType: true } },
      studios: { take: 1, include: { studio: { select: { slug: true, name: true } } } },
    },
  });

  if (!artist || !artist.artistSite?.isPublished) return null;

  const site        = artist.artistSite;
  const displayName = artist.artistName || artist.name;
  const bio         = site.bioContent || artist.bio;
  const studioSlug  = artist.studios[0]?.studio?.slug;

  // Artist videos (for public page)
  const videos = site.showVideos !== false
    ? await db.artistVideo.findMany({
        where:   { artistId: artist.id },
        orderBy: { sortOrder: "asc" },
        take:    6,
        select:  { id: true, url: true, title: true },
      })
    : [];

  // Upcoming shows — sorted ascending, only future dates
  const shows = await db.artistShow.findMany({
    where:   { artistId: artist.id, date: { gte: new Date() } },
    orderBy: { date: "asc" },
    select:  { id: true, venueName: true, city: true, date: true, ticketUrl: true, isSoldOut: true },
  });

  // Active pre-save campaign (most recently created one)
  const campaign = await db.preSaveCampaign.findFirst({
    where:   { artistId: artist.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select:  { title: true, artUrl: true, releaseDate: true, spotifyUrl: true, appleMusicUrl: true },
  });

  // Build AudioTrack objects for the store queue
  const audioTracks = artist.tracks.map((t) => ({
    id:       t.id,
    title:    t.title,
    artist:   displayName,
    src:      t.fileUrl,
    coverArt: t.coverArtUrl ?? undefined,
  }));
  const firstTrack = audioTracks[0] ?? null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>

      {/* ── Full-bleed hero (client component — handles auto-load + Listen CTA) */}
      <ArtistHero
        displayName={displayName}
        photo={artist.photo ?? null}
        heroImage={site.heroImage ?? null}
        identityLine={null}
        instagramHandle={artist.instagramHandle ?? null}
        tiktokHandle={artist.tiktokHandle ?? null}
        youtubeChannel={artist.youtubeChannel ?? null}
        spotifyUrl={artist.spotifyUrl ?? null}
        appleMusicUrl={artist.appleMusicUrl ?? null}
        followGateEnabled={site.followGateEnabled ?? false}
        firstTrack={firstTrack}
        allTracks={audioTracks}
      />

      {/* ── Body content ─────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Bio + Book a Session */}
        {(bio || studioSlug) && (
          <div className="space-y-4">
            {bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>
            )}
            {studioSlug && (
              <Link
                href={`/${studioSlug}/intake`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold no-underline"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Book a Session
              </Link>
            )}
          </div>
        )}

        {/* Pre-save / release card */}
        {campaign && (
          <PreSaveCampaignCard
            title={campaign.title}
            artUrl={campaign.artUrl ?? null}
            releaseDate={campaign.releaseDate.toISOString()}
            spotifyUrl={campaign.spotifyUrl ?? null}
            appleMusicUrl={campaign.appleMusicUrl ?? null}
          />
        )}

        {/* Music */}
        {artist.tracks.length > 0 && (
          <TrackList
            tracks={artist.tracks}
            artistName={displayName}
            followGateEnabled={site.followGateEnabled ?? false}
            instagramHandle={artist.instagramHandle ?? null}
            spotifyUrl={artist.spotifyUrl ?? null}
            appleMusicUrl={artist.appleMusicUrl ?? null}
            youtubeChannel={artist.youtubeChannel ?? null}
          />
        )}

        {/* Videos */}
        {videos.length > 0 && <VideoSection videos={videos} />}

        {/* Shows */}
        <ShowsSection
          shows={shows.map((s) => ({ ...s, date: s.date.toISOString() }))}
          artistName={displayName}
          artistId={artist.id}
        />

        {/* Merch */}
        {artist.merchProducts.length > 0 && (
          <MerchGrid products={artist.merchProducts} artistSlug={slug} justPurchased={false} />
        )}

        {/* Support / Tip Jar */}
        {site.pwywEnabled && (
          <SupportSection artistSlug={slug} artistName={displayName} />
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
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

    const galleryImages: string[] = Array.isArray(studio.galleryImages) ? studio.galleryImages as string[] : [];
    const templateProps = { studio, services, testimonials, featuredArtists, fullAddress, mapQuery, socials, galleryImages };

    // Template dispatch
    const template = studio.template ?? "CLASSIC";

    // ?preview=TEMPLATE — bypass stored template/config, show any template live
    if (preview === "CLEAN")      return <CleanTemplate     {...templateProps} />;
    if (preview === "CINEMATIC")  return <CinematicTemplate {...templateProps} />;
    if (preview === "GRID")       return <GridTemplate      {...templateProps} />;
    if (preview === "BOLD" || preview === "EDITORIAL" || preview === "CLASSIC") {
      return <DefaultTemplate {...templateProps} templateStyle={preview} />;
    }

    // CLEAN / CINEMATIC / GRID — always use their own renderer, never pageConfig
    if (template === "CLEAN")      return <><PageViewTracker studioId={studio.id} /><CleanTemplate     {...templateProps} /></>;
    if (template === "CINEMATIC")  return <><PageViewTracker studioId={studio.id} /><CinematicTemplate {...templateProps} /></>;
    if (template === "GRID")       return <><PageViewTracker studioId={studio.id} /><GridTemplate      {...templateProps} /></>;

    // CUSTOM — always use CustomTemplate
    if (template === "CUSTOM")     return <><PageViewTracker studioId={studio.id} /><CustomTemplate    {...templateProps} /></>;

    // CLASSIC / BOLD / EDITORIAL — use generated pageConfig if available, else DefaultTemplate fallback
    const pageConfig = studio.pageConfig as PageConfig | null;
    if (pageConfig?.sections?.length) {
      return (
        <>
          <PageViewTracker studioId={studio.id} />
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
        </>
      );
    }

    const style = (template === "BOLD" || template === "EDITORIAL") ? template : "CLASSIC";
    return (
      <>
        <PageViewTracker studioId={studio.id} />
        <DefaultTemplate {...templateProps} templateStyle={style} />
      </>
    );
  }

  // ── Artist? ───────────────────────────────────────────────────────────────
  const artistPage = await ArtistSite({ slug });
  if (!artistPage) notFound();
  return artistPage;
}
