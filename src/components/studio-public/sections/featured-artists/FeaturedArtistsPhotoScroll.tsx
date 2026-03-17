import Link from "next/link";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function FeaturedArtistsPhotoScroll({ content, studio, featuredArtists }: SectionSharedProps) {
  const { eyebrow = "Our Roster", headline = "Featured Artists" } = content;
  const A = "var(--studio-accent)";

  if (studio.studioTier !== "ELITE") return null;
  if (!featuredArtists.length) return null;

  return (
    <section className="py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto mb-12">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
        <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
      </div>
      <div className="flex gap-5 overflow-x-auto pb-4" style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        {featuredArtists.map((artist) => {
          const name = artist.artistName || artist.name;
          return (
            <Link
              key={artist.id}
              href={artist.artistSlug ? `/${artist.artistSlug}` : "#"}
              className="no-underline group shrink-0"
              style={{ scrollSnapAlign: "start", width: 200 }}
            >
              <div
                className="w-full rounded-2xl overflow-hidden border transition-all group-hover:-translate-y-1"
                style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#111" }}
              >
                <div
                  className="w-full flex items-center justify-center text-5xl font-bold"
                  style={{
                    height: 200,
                    backgroundColor: "#1a1a1a",
                    backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: A,
                  }}
                >
                  {!artist.photo && name[0]?.toUpperCase()}
                </div>
                <div className="p-4">
                  <p className="font-bold group-hover:text-[var(--studio-accent)] transition-colors">{name}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
