import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import TrackList from "./TrackList";
import type { StreamLeaseTrackData } from "./TrackList";
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
import StoreSection, { type DigitalProductPublic } from "./StoreSection";
import BeatsSection, { type PublicBeat } from "./BeatsSection";
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
import { calculateAverageFeatures } from "@/lib/audio-features";
import type { AudioFeatureScores } from "@/lib/audio-features";
import SimilarArtists from "@/components/audio/SimilarArtists";

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
            select:  { id: true, title: true, fileUrl: true, coverArtUrl: true, canvasVideoUrl: true, price: true, plays: true, releaseId: true, audioFeatures: { select: { loudness: true, energy: true, danceability: true, acousticness: true, instrumentalness: true, speechiness: true, liveness: true, valence: true, genre: true, mood: true, isVocal: true } } },
          },
        },
      },
      // Loose published tracks (no release assigned)
      tracks: {
        where:   { status: "PUBLISHED", releaseId: null },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  { id: true, title: true, fileUrl: true, coverArtUrl: true, canvasVideoUrl: true, price: true, plays: true, releaseId: true, audioFeatures: { select: { loudness: true, energy: true, danceability: true, acousticness: true, instrumentalness: true, speechiness: true, liveness: true, valence: true, genre: true, mood: true, isVocal: true } } },
      },
      merchProducts: {
        where:   { isActive: true },
        orderBy: { createdAt: "desc" },
        take:    8,
        select:  {
          id: true, title: true, imageUrl: true, imageUrls: true,
          description: true, markup: true, fulfillmentType: true, returnPolicy: true,
          variants: {
            where:   { inStock: true },
            orderBy: { retailPrice: "asc" },
            select:  { id: true, size: true, color: true, colorCode: true, retailPrice: true, stockQuantity: true },
          },
        },
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

  // Compute sound DNA — average audio features across all published tracks (need 3+)
  const allPublishedFeatures = [
    ...artist.tracks.map(t => t.audioFeatures).filter(Boolean),
    ...artist.artistReleases.flatMap(r => r.tracks.map(t => t.audioFeatures).filter(Boolean)),
  ] as AudioFeatureScores[];
  const soundDNA = allPublishedFeatures.length >= 3
    ? calculateAverageFeatures(allPublishedFeatures)
    : null;

  // Artist videos — uploads and embeds, with linked product data for CTAs
  const artistVideos = site.showVideos !== false
    ? await db.artistVideo.findMany({
        where:   { artistId: artist.id, isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take:    20,
        select:  {
          id: true, title: true, videoUrl: true, thumbnailUrl: true,
          category: true, type: true, embedUrl: true, syncedFromYouTube: true,
          linkedTrack: {
            select: {
              id: true, title: true, coverArtUrl: true,
              price: true, fileUrl: true,
              beatLeaseSettings: { select: { streamLeaseEnabled: true } },
            },
          },
          linkedBeat: {
            select: {
              id: true, title: true, coverArtUrl: true,
              price: true, bpm: true, musicalKey: true, fileUrl: true,
              beatLeaseSettings: { select: { streamLeaseEnabled: true } },
              artist: {
                select: {
                  name: true, artistName: true, artistSlug: true,
                  producerProfile: {
                    select: {
                      defaultNonExclusivePrice: true,
                      defaultExclusivePrice:    true,
                    },
                  },
                },
              },
            },
          },
          linkedMerch: {
            select: {
              id: true, title: true, imageUrl: true, markup: true,
              variants: {
                where:   { inStock: true },
                orderBy: { retailPrice: "asc" },
                select:  { id: true, retailPrice: true },
                take:    1,
              },
            },
          },
        },
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

  // Digital products for sale
  const digitalProducts: DigitalProductPublic[] = await db.digitalProduct.findMany({
    where:   { userId: artist.id, published: true },
    orderBy: { createdAt: "desc" },
    take:    12,
    select: {
      id: true, title: true, type: true, price: true,
      coverArtUrl: true, description: true,
      _count: { select: { tracks: true } },
    },
  });

  // Marketplace beats by this producer (published tracks with BeatLeaseSettings)
  const [rawBeats, producerProfile] = await Promise.all([
    db.track.findMany({
      where:   { artistId: artist.id, status: "PUBLISHED", beatLeaseSettings: { isNot: null } },
      select: {
        id: true, title: true, fileUrl: true, coverArtUrl: true,
        price: true, bpm: true, musicalKey: true,
        beatLeaseSettings: { select: { streamLeaseEnabled: true } },
        _count: { select: { streamLeases: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.producerProfile.findUnique({
      where:  { userId: artist.id },
      select: { displayName: true, bio: true },
    }),
  ]);

  const publicBeats: PublicBeat[] = rawBeats.map((b) => ({
    id:                 b.id,
    title:              b.title,
    fileUrl:            b.fileUrl,
    coverArtUrl:        b.coverArtUrl,
    price:              b.price,
    bpm:                b.bpm,
    musicalKey:         b.musicalKey,
    activeLeases:       b._count.streamLeases,
    streamLeaseEnabled: b.beatLeaseSettings?.streamLeaseEnabled ?? true,
  }));

  const producerDisplayName = producerProfile?.displayName || displayName;
  const producerBio         = producerProfile?.bio ?? null;

  // Stream-leased tracks (active, with audio uploaded)
  const rawStreamLeases = await db.streamLease.findMany({
    where: { artistId: artist.id, isActive: true, audioUrl: { not: "" } },
    orderBy: { activatedAt: "desc" },
    select: {
      id:         true,
      trackTitle: true,
      coverUrl:   true,
      audioUrl:   true,
      producer:   { select: { name: true, artistName: true, artistSlug: true } },
      agreement:  { select: { producerTerms: true } },
      _count:     { select: { plays: true } },
    },
  });

  const streamLeaseTracks: StreamLeaseTrackData[] = rawStreamLeases.map((lease) => {
    const producerName = lease.producer.artistName ?? lease.producer.name;
    let producerCredit = `prod. ${producerName}`;
    if (lease.agreement?.producerTerms) {
      const terms = lease.agreement.producerTerms as { creditFormat?: string };
      if (terms.creditFormat) {
        producerCredit = terms.creditFormat.replace("{producerName}", producerName);
      }
    }
    return {
      leaseId:        lease.id,
      title:          lease.trackTitle,
      coverUrl:       lease.coverUrl ?? null,
      audioUrl:       lease.audioUrl,
      playCount:      lease._count.plays,
      producerCredit,
      producerSlug:   lease.producer.artistSlug ?? null,
    };
  });

  // Build audio tracks for the store queue (all published tracks across releases + loose + stream leases)
  const allPublishedTracks = [
    ...releases.flatMap((r) => r.tracks),
    ...artist.tracks,
  ];
  const audioTracks = [
    ...allPublishedTracks.map((t) => ({
      id:       t.id,
      title:    t.title,
      artist:   displayName,
      src:      t.fileUrl,
      coverArt: t.coverArtUrl ?? undefined,
    })),
    ...streamLeaseTracks.map((sl) => ({
      id:       sl.leaseId,
      title:    sl.title,
      artist:   displayName,
      src:      sl.audioUrl,
      coverArt: sl.coverUrl ?? undefined,
    })),
  ];
  const firstTrack = audioTracks[0] ?? null;

  const hasMusic = releases.length > 0 || artist.tracks.length > 0 || streamLeaseTracks.length > 0;

  // Count distinct DJs who have this artist's tracks in their crates
  const allArtistTrackIds = [
    ...releases.flatMap((r) => r.tracks.map((t) => t.id)),
    ...artist.tracks.map((t) => t.id),
  ];
  let djPickedCount = 0;
  if (allArtistTrackIds.length > 0) {
    const crateItemRows = await db.crateItem.findMany({
      where:  { trackId: { in: allArtistTrackIds } },
      select: { crate: { select: { djProfileId: true } } },
    });
    const uniqueDJIds = new Set(crateItemRows.map((r) => r.crate.djProfileId));
    djPickedCount = uniqueDJIds.size;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>

      {/* Page view tracker */}
      <ArtistPageViewTracker artistSlug={slug} />

      {/* Sticky nav */}
      <ArtistNav
        displayName={displayName}
        hasMusic={hasMusic}
        hasVideos={artistVideos.length > 0}
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
        djPickedCount={djPickedCount}
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
              streamLeaseTracks={streamLeaseTracks}
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

        {/* 6. Beats (producer section) */}
        {publicBeats.length > 0 && (
          <BeatsSection
            beats={publicBeats}
            producerName={producerDisplayName}
            producerBio={producerBio}
            artistSlug={slug}
          />
        )}

        {/* 7. Videos */}
        {artistVideos.length > 0 && (
          <div id="videos">
            <VideoSection artistVideos={artistVideos} artistSlug={slug} artistName={displayName} />
          </div>
        )}

        {/* 8. Photos */}
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

        {/* 10b. Digital Store */}
        {digitalProducts.length > 0 && (
          <StoreSection products={digitalProducts} artistName={displayName} />
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
              soundDNA={soundDNA}
            />
          </div>
        )}

        {/* 12b. Similar Artists */}
        {allPublishedFeatures.length >= 3 && (
          <div>
            <SimilarArtists artistId={artist.id} limit={8} />
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
  let studio;
  try {
    studio = await db.studio.findUnique({
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
  } catch (err) {
    console.error("[slug/page] studio query failed:", err);
    // DB connection spike — return a retryable error page rather than a crash
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
        <p style={{ color: "#666", fontSize: "1rem" }}>Something went wrong loading this page. Please try again in a moment.</p>
        <a href={`/${slug}`} style={{ color: "#D4A843", marginTop: "1rem", fontSize: "0.9rem" }}>Retry →</a>
      </div>
    );
  }

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

    // Fetch averaged audio features of artist tracks linked to this studio
    const studioSoundRes = await db.audioFeatures.findMany({
      where: {
        track: {
          artistId: { in: studio.artists.map(a => a.artistId) },
          status:   "PUBLISHED",
        },
      },
      select: {
        loudness: true, energy: true, danceability: true, acousticness: true,
        instrumentalness: true, speechiness: true, liveness: true, valence: true,
        genre: true, mood: true, isVocal: true,
      },
      take: 50,
    });
    const studioSoundProfile = studioSoundRes.length >= 3
      ? calculateAverageFeatures(studioSoundRes as AudioFeatureScores[])
      : null;

    const templateProps = {
      studio, slug, services, testimonials, featuredArtists, fullAddress, mapQuery, socials, galleryImages,
      portfolioTracks, credits, engineers, equipment, studioSoundProfile,
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
  if (!artistPage) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: "#0A0A0A" }}
      >
        {/* IndieThis logo mark */}
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden style={{ marginBottom: "2rem" }}>
          <rect width="48" height="48" rx="12" fill="#D4A843" />
          <rect x="20" y="18" width="6" height="22" rx="3" fill="#0A0A0A" />
          <polygon points="18,5 18,16 28,10.5" fill="#E85D4A" />
        </svg>

        <p style={{ color: "#333", fontSize: "6rem", fontWeight: 700, lineHeight: 1, margin: 0 }}>
          404
        </p>
        <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 600, marginTop: "1rem", marginBottom: 0 }}>
          This page doesn&apos;t exist
        </h1>
        <p style={{ color: "#666", marginTop: "0.5rem", fontSize: "1rem" }}>
          The artist, studio, or DJ you&apos;re looking for isn&apos;t here.
        </p>
        <a
          href="/explore"
          style={{
            marginTop: "2rem",
            color: "#D4A843",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
          }}
        >
          Explore IndieThis →
        </a>
      </div>
    );
  }
  return artistPage;
}
