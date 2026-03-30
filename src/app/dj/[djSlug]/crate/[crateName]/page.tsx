import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PublicCrateClient from "./PublicCrateClient";

export async function generateMetadata({ params }: { params: Promise<{ djSlug: string; crateName: string }> }) {
  const { djSlug, crateName } = await params;
  const decodedName = decodeURIComponent(crateName);

  const djProfile = await db.dJProfile.findUnique({
    where: { slug: djSlug },
    select: { user: { select: { name: true, artistName: true } } },
  });

  if (!djProfile) return { title: "Crate — IndieThis" };

  const displayName = djProfile.user.artistName ?? djProfile.user.name;
  return {
    title: `${decodedName} by ${displayName} — IndieThis`,
    description: `A curated crate of tracks by ${displayName}`,
  };
}

export default async function PublicCratePage({ params }: { params: Promise<{ djSlug: string; crateName: string }> }) {
  const { djSlug, crateName } = await params;
  const decodedName = decodeURIComponent(crateName);

  const djProfile = await db.dJProfile.findUnique({
    where: { slug: djSlug },
    select: {
      id: true,
      slug: true,
      bio: true,
      profilePhotoUrl: true,
      user: {
        select: {
          name: true,
          artistName: true,
          photo: true,
          artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
    },
  });

  if (!djProfile) notFound();

  const crate = await db.crate.findFirst({
    where: {
      djProfileId: djProfile.id,
      name: { equals: decodedName, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      collaborators: {
        select: {
          djProfile: {
            select: {
              id: true,
              slug: true,
              bio: true,
              user: { select: { name: true, artistName: true, photo: true } },
            },
          },
        },
      },
      items: {
        orderBy: { addedAt: "asc" },
        select: {
          id: true,
          trackId: true,
          addedAt: true,
          track: {
            select: {
              id: true,
              title: true,
              coverArtUrl: true,
              fileUrl: true,
              genre: true,
              bpm: true,
              musicalKey: true,
              artist: {
                select: {
                  id: true,
                  name: true,
                  artistName: true,
                  artistSlug: true,
                  artistSite: { select: { isPublished: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!crate || !crate.isPublic) notFound();

  // Serialize dates for client component
  const serializedCrate = {
    ...crate,
    items: crate.items.map(item => ({
      ...item,
      addedAt: item.addedAt.toISOString(),
    })),
  };

  return (
    <PublicCrateClient
      djProfile={djProfile}
      crate={serializedCrate}
    />
  );
}
