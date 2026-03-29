"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SimilarArtist {
  id:         string;
  name:       string;
  slug:       string | null;
  avatarUrl:  string | null;
  genre:      string | null;
  trackCount: number;
  similarity: number;
}

interface SimilarArtistsProps {
  artistId: string;
  limit?:   number;
}

export default function SimilarArtists({ artistId, limit = 8 }: SimilarArtistsProps) {
  const [artists, setArtists] = useState<SimilarArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/audio-features/similar-artists?artistId=${artistId}&limit=${limit}`)
      .then(r => r.json())
      .then(d => setArtists(d.similar ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [artistId, limit]);

  if (loading || artists.length === 0) return null;

  return (
    <div>
      <p
        className="text-xs font-bold uppercase tracking-widest mb-3"
        style={{ color: "#D4A843", letterSpacing: "0.12em" }}
      >
        Similar Artists
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {artists.map(artist => {
          const initials = artist.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

          const card = (
            <div
              key={artist.id}
              className="shrink-0 rounded-xl border p-3 flex flex-col items-center gap-2 transition-all hover:border-[rgba(212,168,67,0.4)]"
              style={{ background: "#111111", borderColor: "#1A1A1A", width: 128 }}
            >
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843", flexShrink: 0 }}
              >
                {artist.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* Name */}
              <p className="text-xs font-semibold text-center truncate w-full" style={{ color: "#FFFFFF" }}>
                {artist.name}
              </p>

              {/* Genre pill */}
              {artist.genre && (
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#888888" }}
                >
                  {artist.genre}
                </span>
              )}

              {/* Match % */}
              <span
                className="text-[10px] font-bold"
                style={{ color: "#D4A843" }}
              >
                {Math.round(artist.similarity * 100)}% match
              </span>
            </div>
          );

          return artist.slug ? (
            <Link key={artist.id} href={`/${artist.slug}`} className="no-underline">
              {card}
            </Link>
          ) : (
            <div key={artist.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
