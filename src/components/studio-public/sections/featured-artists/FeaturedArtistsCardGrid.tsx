import { ArtistLink } from "./_ArtistLink";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function FeaturedArtistsCardGrid({ content, studio, featuredArtists }: SectionSharedProps) {
  const { eyebrow = "Our Roster", headline = "Featured Artists" } = content;
  const A = "var(--studio-accent)";

  if (studio.studioTier !== "ELITE") return null;
  if (!featuredArtists.length) return null;

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {featuredArtists.map((artist) => (
            <ArtistLink key={artist.id} artist={artist} />
          ))}
        </div>
      </div>
    </section>
  );
}
