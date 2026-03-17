import Link from "next/link";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function FeaturedArtistsAvatarRow({ content, studio, featuredArtists }: SectionSharedProps) {
  const { eyebrow = "Our Roster", headline = "Featured Artists" } = content;
  const A = "var(--studio-accent)";

  if (studio.studioTier !== "ELITE") return null;
  if (!featuredArtists.length) return null;

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {featuredArtists.map((artist) => {
            const name = artist.artistName || artist.name;
            return (
              <Link key={artist.id} href={artist.artistSlug ? `/${artist.artistSlug}` : "#"} className="no-underline group flex flex-col items-center gap-3">
                <div
                  className="w-20 h-20 rounded-full overflow-hidden border-2 transition-all group-hover:scale-105"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    backgroundColor: "#1a1a1a",
                    backgroundImage: artist.photo ? `url(${artist.photo})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!artist.photo && (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color: A }}>
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-center group-hover:text-[var(--studio-accent)] transition-colors max-w-[80px]">
                  {name}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
