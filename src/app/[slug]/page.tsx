import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import TrackList from "./TrackList";
import MerchGrid from "./MerchGrid";
import ArtistHero from "./ArtistHero";
import PinnedAnnouncement from "./PinnedAnnouncement";
import ActivityTicker from "./ActivityTicker";
import PreSaveCampaignCard from "./PreSaveCampaignCard";
import VideoSection from "./VideoSection";
import PhotoGallery from "./PhotoGallery";
import ShowsSection from "./ShowsSection";
import SupportSection from "./SupportSection";
import ReleaseCapture from "./ReleaseCapture";
import AboutSection from "./AboutSection";
import TestimonialsSection from "./TestimonialsSection";
import CollaboratorsSection from "./CollaboratorsSection";
import PressSection from "./PressSection";
import BookingSection from "./BookingSection";
import ArtistFooter from "./ArtistFooter";
import ArtistPageViewTracker from "./ArtistPageViewTracker";
import ArtistNav from "./ArtistNav";
import { CustomTemplate } from "@/components/studio-public/templates/CustomTemplate";
import { DefaultTemplate } from "@/components/studio-public/templates/DefaultTemplate";
import { CleanTemplate } from "@/components/studio-public/templates/CleanTemplate";
import { CinematicTemplate } from "@/components/studio-public/templates/CinematicTemplate";
import { GridTemplate } from "@/components/studio-public/templates/GridTemplate";
import type { PortfolioTrack } from "@/components/studio-public/sections/PortfolioSection";
import type { StudioCreditItem } from "@/components/studio-public/sections/CreditsSection";
import type { StudioEngineerItem } from "@/components/studio-public/sections/EngineersSection";
import type { EquipmentItem } from "@/components/studio-public/sections/EquipmentSection";
import { ConfigRenderer } from "@/components/studio-public/ConfigRenderer";
import type { PageConfig } from "@/types/page-config";
import PageViewTracker from "@/components/studio/PageViewTracker";

type ServiceItem  = { name: string; price: string; description: string };
type Testimonial  = { quote: string; author: string; track?: string };

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SITE
// ─────────────────────────────────────────────────────────────────────────────

async function ArtistSite({ slug }: { slug: string }) {
  const artist = await db.user.findUnique({
    where: { artistSlug: slug },
    select: {
      id: true, name: true, artistName: true, bio: true, photo: true,
      instagramHandle: true, tiktokHandle: true, youtubeChannel: true,
      spotifyUrl: true, appleMusicUrl: true,
      artistSite: {
        select: {
          isPublished: true, draftMode: true, bioContent: true, heroImage: true,
          followGateEnabled: true, showVideos: true, pwywEnabled: true,
          credentials: true, bookingRate: true,
          pinnedMessage: true, pinnedActionText: true, pinnedActionUrl: true,
          activityTickerEnabled: true,
          genre: true, role: true, city: true, soundcloudUrl: true,
        },
      },
      // Releases with published tracks
      artistReleases: {
        orderBy: { sortOrder: "asc" },
        include: {
          tracks: {
            where:   { status: "PUBLISHED" },
            orderBy: { createdAt: "asc" },
            take:    10,
            select:  { id: true, title: true, fileUrl: true, coverArtUrl: true, price: true, plays: true, releaseId: true },
          },
        },
      },
      // Loose published tracks (no release assigned)
      tracks: {
        where:   { status: "PUBLISHED", releaseId: null },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  { id: true, title: true, fileUrl: true, coverArtUrl: true, price: true, plays: true, releaseId: true },
      },
      merchProducts: {
        where:   { isActive: true },
        orderBy: { createdAt: "desc" },
        take:    6,
        select:  { id: true, title: true, imageUrl: true, basePrice: true, artistMarkup: true, productType: true },
      },
      studios: { take: 1, include: { studio: { select: { slug: true, name: true } } } },
      // New content
      artistPhotos:        { orderBy: { sortOrder: "asc" }, take: 9,
                             select: { id: true, imageUrl: true, caption: true } },
      artistTestimonials:  { orderBy: { sortOrder: "asc" },
                             select: { id: true, quote: true, attribution: true } },
      artistCollaborators: { orderBy: { sortOrder: "asc" },
                             select: { id: true, name: true, photoUrl: true, artistSlug: true } },
      artistPressItems:    { orderBy: { sortOrder: "asc" },
                             select: { id: true, source: true, title: true, url: true } },
    },
  });

  if (!artist || !artist.artistSite?.isPublished) return null;

  const site        = artist.artistSite;
  const displayName = artist.artistName || artist.name;
  const bio         = site.bioContent || artist.bio;
  const studioSlug  = artist.studios[0]?.studio?.slug;

  // Filter releases that actually have tracks
  const releases = artist.artistReleases.filter((r) => r.tracks.length > 0);

  // Artist videos
  const videos = site.showVideos !== false
    ? await db.artistVideo.findMany({
        where:   { artistId: artist.id },
        orderBy: { sortOrder: "asc" },
        take:    6,
        select:  { id: true, url: true, title: true },
      })
    : [];

  // Upcoming shows
  const shows = await db.artistShow.findMany({
    where:   { artistId: artist.id, date: { gte: new Date() } },
    orderBy: { date: "asc" },
    select:  { id: true, venueName: true, city: true, date: true, ticketUrl: true, isSoldOut: true },
  });

  // Active pre-save campaign
  const campaign = await db.preSaveCampaign.findFirst({
    where:   { artistId: artist.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select:  { id: true, title: true, artUrl: true, releaseDate: true, spotifyUrl: true, appleMusicUrl: true },
  });

  // Build audio tracks for the store queue (all published tracks across releases + loose)
  const allPublishedTracks = [
    ...releases.flatMap((r) => r.tracks),
    ...artist.tracks,
  ];
  const audioTracks = allPublishedTracks.map((t) => ({
    id:       t.id,
    title:    t.title,
    artist:   displayName,
    src:      t.fileUrl,
    coverArt: t.coverArtUrl ?? undefined,
  }));
  const firstTrack = audioTracks[0] ?? null;

  const hasMusic = releases.length > 0 || artist.tracks.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>

      {/* Page view tracker */}
      <ArtistPageViewTracker artistSlug={slug} />

      {/* Sticky nav */}
      <ArtistNav
        displayName={displayName}
        hasMusic={hasMusic}
        hasShows={shows.length > 0}
        hasMerch={artist.merchProducts.length > 0}
        hasAbout={!!bio}
      />

      {/* 1. Hero — full-bleed */}
      <ArtistHero
        displayName={displayName}
        photo={artist.photo ?? null}
        heroImage={site.heroImage ?? null}
        instagramHandle={artist.instagramHandle ?? null}
        tiktokHandle={artist.tiktokHandle ?? null}
        youtubeChannel={artist.youtubeChannel ?? null}
        spotifyUrl={artist.spotifyUrl ?? null}
        appleMusicUrl={artist.appleMusicUrl ?? null}
        soundcloudUrl={site.soundcloudUrl ?? null}
        followGateEnabled={site.followGateEnabled ?? false}
        firstTrack={firstTrack}
        allTracks={audioTracks}
        genre={site.genre ?? null}
        role={site.role ?? null}
        city={site.city ?? null}
      />

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* 2. Pinned Announcement */}
        {site.pinnedMessage && (
          <PinnedAnnouncement
            message={site.pinnedMessage}
            actionText={site.pinnedActionText ?? undefined}
            actionUrl={site.pinnedActionUrl ?? undefined}
          />
        )}

        {/* 3. Activity Ticker */}
        {site.activityTickerEnabled && (
          <ActivityTicker artistSlug={slug} />
        )}

        {/* 4. Pre-save Campaign */}
        {campaign && (
          <PreSaveCampaignCard
            campaignId={campaign.id}
            title={campaign.title}
            artUrl={campaign.artUrl ?? null}
            releaseDate={campaign.releaseDate.toISOString()}
            spotifyUrl={campaign.spotifyUrl ?? null}
            appleMusicUrl={campaign.appleMusicUrl ?? null}
          />
        )}

        {/* 5. Music */}
        {hasMusic && (
          <div id="music">
            <TrackList
              releases={releases.map((r) => ({
                id:          r.id,
                title:       r.title,
                coverUrl:    r.coverUrl ?? null,
                releaseDate: r.releaseDate ? r.releaseDate.toISOString() : null,
                type:        r.type,
                tracks:      r.tracks,
              }))}
              looseTracks={artist.tracks}
              artistName={displayName}
              artistSlug={slug}
              followGateEnabled={site.followGateEnabled ?? false}
              instagramHandle={artist.instagramHandle ?? null}
              spotifyUrl={artist.spotifyUrl ?? null}
              appleMusicUrl={artist.appleMusicUrl ?? null}
              youtubeChannel={artist.youtubeChannel ?? null}
            />
          </div>
        )}

        {/* 6. Videos */}
        {videos.length > 0 && <VideoSection videos={videos} />}

        {/* 7. Photos */}
        {artist.artistPhotos.length > 0 && (
          <PhotoGallery photos={artist.artistPhotos} />
        )}

        {/* 8. Shows */}
        {shows.length > 0 && (
          <div id="shows">
            <ShowsSection
              shows={shows.map((s) => ({ ...s, date: s.date.toISOString() }))}
              artistName={displayName}
              artistId={artist.id}
            />
          </div>
        )}

        {/* 9. Email/SMS Capture */}
        <ReleaseCapture artistSlug={slug} artistName={displayName} />

        {/* 10. Merch */}
        {artist.merchProducts.length > 0 && (
          <div id="merch">
            <MerchGrid products={artist.merchProducts} artistSlug={slug} justPurchased={false} />
          </div>
        )}

        {/* 11. Support */}
        {site.pwywEnabled && (
          <div id="support">
            <SupportSection artistSlug={slug} artistName={displayName} />
          </div>
        )}

        {/* 12. About */}
        {bio && (
          <div id="about">
            <AboutSection
              bio={bio}
              photo={artist.photo ?? null}
              displayName={displayName}
              credentials={site.credentials ?? []}
              studioSlug={studioSlug ?? null}
            />
          </div>
        )}

        {/* 13. Testimonials */}
        {artist.artistTestimonials.length > 0 && (
          <TestimonialsSection testimonials={artist.artistTestimonials} />
        )}

        {/* 14. Collaborators */}
        {artist.artistCollaborators.length > 0 && (
          <CollaboratorsSection collaborators={artist.artistCollaborators} />
        )}

        {/* 15. Press */}
        {artist.artistPressItems.length > 0 && (
          <PressSection items={artist.artistPressItems} />
        )}

        {/* 16. Booking */}
        <div id="booking">
          <BookingSection
            artistSlug={slug}
            artistName={displayName}
            bookingRate={site.bookingRate ?? null}
          />
        </div>

        {/* 17. Footer */}
        <ArtistFooter
          artistSlug={slug}
          instagramHandle={artist.instagramHandle ?? null}
          tiktokHandle={artist.tiktokHandle ?? null}
          youtubeChannel={artist.youtubeChannel ?? null}
          spotifyUrl={artist.spotifyUrl ?? null}
          appleMusicUrl={artist.appleMusicUrl ?? null}
        />

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
      portfolioTracks: { orderBy: { sortOrder: "asc" }, take: 6 },
      credits:         { orderBy: { sortOrder: "asc" }, take: 12 },
      engineers:       { orderBy: { sortOrder: "asc" }, take: 6 },
      equipment:       { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
    },
  });

  if (studio) {
    if (!studio.isPublished) notFound();

    const services: ServiceItem[] = studio.servicesJson
      ? JSON.parse(studio.servicesJson)
      : studio.services.length > 0
        ? studio.services.map((s) => ({ name: s, price: "", description: "" }))
        : [
            { name: "Recording",        price: "", description: "" },
            { name: "Mixing",           price: "", description: "" },
            { name: "Mastering",        price: "", description: "" },
            { name: "Vocal Production", price: "", description: "" },
            { name: "Beat Making",      price: "", description: "" },
            { name: "Podcast",          price: "", description: "" },
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

    const portfolioTracks: PortfolioTrack[] = studio.portfolioTracks;
    const credits: StudioCreditItem[]       = studio.credits;
    const engineers: StudioEngineerItem[]   = studio.engineers.map((e) => ({
      ...e,
      specialties: e.specialties as string[],
    }));
    const equipment: EquipmentItem[]        = studio.equipment.map((e) => ({
      id: e.id,
      category: e.category as string,
      name: e.name,
    }));

    const templateProps = {
      studio, services, testimonials, featuredArtists, fullAddress, mapQuery, socials, galleryImages,
      portfolioTracks, credits, engineers, equipment,
    };

    const template = studio.template ?? "CLASSIC";

    if (preview === "CLEAN")      return <CleanTemplate     {...templateProps} />;
    if (preview === "CINEMATIC")  return <CinematicTemplate {...templateProps} />;
    if (preview === "GRID")       return <GridTemplate      {...templateProps} />;
    if (preview === "BOLD" || preview === "EDITORIAL" || preview === "CLASSIC") {
      return <DefaultTemplate {...templateProps} templateStyle={preview} />;
    }

    if (template === "CLEAN")     return <><PageViewTracker studioId={studio.id} /><CleanTemplate     {...templateProps} /></>;
    if (template === "CINEMATIC") return <><PageViewTracker studioId={studio.id} /><CinematicTemplate {...templateProps} /></>;
    if (template === "GRID")      return <><PageViewTracker studioId={studio.id} /><GridTemplate      {...templateProps} /></>;
    if (template === "CUSTOM")    return <><PageViewTracker studioId={studio.id} /><CustomTemplate    {...templateProps} /></>;

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
