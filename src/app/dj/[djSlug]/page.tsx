import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import DJProfileClient from "./DJProfileClient";

export async function generateMetadata(
  { params }: { params: Promise<{ djSlug: string }> }
): Promise<Metadata> {
  const { djSlug } = await params;
  const dj = await db.dJProfile.findUnique({
    where:  { slug: djSlug },
    select: { user: { select: { name: true, artistName: true } }, bio: true, city: true },
  });
  if (!dj) return { title: "DJ — IndieThis" };

  const displayName = dj.user.artistName ?? dj.user.name ?? djSlug;
  const title       = `${displayName} | IndieThis`;
  const description = dj.bio ?? `Check out ${displayName} on IndieThis`;
  const ogImage     = `/api/og/dj/${djSlug}`;

  return {
    title,
    description,
    openGraph: {
      title, description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: displayName }],
      type: "profile",
    },
    twitter: { card: "summary_large_image", title, images: [ogImage] },
  };
}

export default async function DJProfilePage(
  { params }: { params: Promise<{ djSlug: string }> }
) {
  const { djSlug } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { slug: djSlug },
    select: {
      id: true,
      slug: true,
      bio: true,
      genres: true,
      city: true,
      profilePhotoUrl: true,
      socialLinks: true,
      isVerified: true,
      user: {
        select: {
          name: true,
          artistName: true,
          photo: true,
          artistSlug: true,
          merchProducts: {
            where:   { isActive: true },
            orderBy: { createdAt: "desc" },
            take:    8,
            select: {
              id: true, title: true, imageUrl: true,
              variants: {
                where:   { inStock: true },
                orderBy: { retailPrice: "asc" },
                take:    1,
                select:  { id: true, retailPrice: true },
              },
            },
          },
        },
      },
      crates: {
        where: { isPublic: true },
        select: {
          id: true,
          name: true,
          coverArtUrl: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      sets: {
        select: {
          id: true,
          title: true,
          videoUrl: true,
          thumbnailUrl: true,
          duration: true,
          venue: true,
          date: true,
        },
        orderBy: { createdAt: "desc" },
      },
      events: {
        where: { date: { gte: new Date() } },
        select: {
          id: true,
          name: true,
          venue: true,
          city: true,
          date: true,
          time: true,
          ticketUrl: true,
          description: true,
        },
        orderBy: { date: "asc" },
      },
      mixes: {
        select: {
          id: true,
          title: true,
          audioUrl: true,
          coverArtUrl: true,
          canvasVideoUrl: true,
          duration: true,
          description: true,
          tracklist: {
            include: {
              track: {
                include: {
                  artist: { select: { name: true, artistName: true, artistSlug: true } },
                },
              },
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!djProfile) notFound();

  // Sum of all public crate items
  const totalCrateItems = djProfile.crates.reduce((sum, c) => sum + c._count.items, 0);

  // Serialize dates
  const serialized = {
    ...djProfile,
    sets: djProfile.sets.map(s => ({
      ...s,
      date: s.date ? s.date.toISOString() : null,
    })),
    events: djProfile.events.map(e => ({
      ...e,
      date: e.date.toISOString(),
    })),
    totalCrateItems,
    socialLinks: djProfile.socialLinks as Record<string, string> | null,
    merch: djProfile.user.merchProducts,
    artistSlug: djProfile.user.artistSlug,
  };

  return <DJProfileClient djProfile={serialized} />;
}
