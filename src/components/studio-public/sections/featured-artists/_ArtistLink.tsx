import Link from "next/link";

export function ArtistLink({ artist }: { artist: any }) {
  const name = artist.artistName || artist.name;
  const photo = artist.photo;
  const href = artist.artistSlug ? `/${artist.artistSlug}` : "#";
  const A = "var(--studio-accent)";

  return (
    <Link href={href} className="no-underline group">
      <div
        className="rounded-2xl overflow-hidden border transition-all group-hover:border-opacity-40 group-hover:-translate-y-1"
        style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#111" }}
      >
        <div
          className="aspect-square flex items-center justify-center text-4xl font-bold"
          style={{
            backgroundColor: "#1a1a1a",
            backgroundImage: photo ? `url(${photo})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: A,
          }}
        >
          {!photo && name[0]?.toUpperCase()}
        </div>
        <div className="p-4">
          <p className="font-bold text-sm group-hover:text-[var(--studio-accent)] transition-colors">{name}</p>
          {artist.instagramHandle && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              @{artist.instagramHandle.replace(/^@/, "")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
