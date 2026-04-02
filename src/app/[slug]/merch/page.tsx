import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import MerchGrid from "../MerchGrid";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const artist = await db.user.findUnique({
    where:  { artistSlug: slug },
    select: { name: true, artistName: true },
  });
  const displayName = artist?.artistName || artist?.name || slug;
  const title       = `${displayName} Merch | IndieThis`;
  const description = `Shop official merch from ${displayName} on IndieThis`;
  const ogImage     = `/api/og/artist/${slug}`;
  return {
    title,
    description,
    openGraph: {
      title, description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${displayName} Merch` }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, images: [ogImage] },
  };
}

export default async function MerchStorefront({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { slug }    = await params;
  const { success } = await searchParams;

  const artist = await db.user.findUnique({
    where:  { artistSlug: slug },
    select: {
      id: true, name: true, artistName: true, photo: true,
      artistSite: { select: { isPublished: true } },
      merchProducts: {
        where:   { isActive: true },
        orderBy: { createdAt: "desc" },
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
    },
  });

  if (!artist || !artist.artistSite?.isPublished) notFound();

  const displayName  = artist.artistName || artist.name;
  const justPurchased = success === "true";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>

      {/* Back nav */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 no-underline transition-colors mb-6"
        >
          ← Back to {displayName}
        </Link>

        <h1
          className="text-2xl font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)" }}
        >
          {displayName} — Merch
        </h1>
        <p className="text-sm text-white/40 mb-8">
          {artist.merchProducts.length} item{artist.merchProducts.length !== 1 ? "s" : ""} available
        </p>

        {artist.merchProducts.length > 0 ? (
          <MerchGrid
            products={artist.merchProducts}
            artistSlug={slug}
            justPurchased={justPurchased}
            fullPage
          />
        ) : (
          <div className="py-20 text-center">
            <p className="text-white/30 text-sm">No merch available yet — check back soon.</p>
          </div>
        )}

        <p className="text-center text-xs text-white/20 py-12">
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
        </p>
      </div>
    </div>
  );
}
