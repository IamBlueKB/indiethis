"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music } from "lucide-react";
import LazyAudioRadar from "./LazyAudioRadar";

interface SimilarTrack {
  id:         string;
  title:      string;
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  similarity: number;
}

interface SimilarTracksProps {
  sourceId:   string;
  /** "track" or "beat" — affects label only; both use trackId under the hood */
  sourceType?: "track" | "beat";
  limit?:     number;
}

export default function SimilarTracks({
  sourceId,
  sourceType = "track",
  limit      = 6,
}: SimilarTracksProps) {
  const [tracks,  setTracks]  = useState<SimilarTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/audio-features/similar-tracks?trackId=${sourceId}&limit=${limit}`)
      .then(r => r.json())
      .then(d => setTracks(d.similar ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceId, limit]);

  if (loading || tracks.length === 0) return null;

  const label = sourceType === "beat" ? "Similar Beats" : "More Like This";

  return (
    <div>
      <p
        className="text-xs font-bold uppercase tracking-widest mb-3"
        style={{ color: "#D4A843", letterSpacing: "0.12em" }}
      >
        {label}
      </p>

      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {tracks.map(track => {
          const card = (
            <div
              key={track.id}
              className="shrink-0 rounded-xl border p-3 flex flex-col gap-2 w-44 transition-all hover:border-[rgba(212,168,67,0.4)]"
              style={{ background: "#111111", borderColor: "#1A1A1A", width: 176 }}
            >
              {/* Cover art */}
              <div
                className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: "#1A1A1A" }}
              >
                {track.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.artworkUrl} alt={track.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music size={20} style={{ color: "#444" }} />
                )}
              </div>

              {/* sm radar */}
              <div className="flex justify-center">
                <LazyAudioRadar trackId={track.id} size="sm" animated={false} />
              </div>

              {/* Title + artist */}
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#FFFFFF" }}>
                  {track.title}
                </p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: "#888888" }}>
                  {track.artistName}
                </p>
              </div>

              {/* Similarity badge */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                >
                  {Math.round(track.similarity * 100)}% match
                </span>
              </div>
            </div>
          );

          return track.artistSlug ? (
            <Link key={track.id} href={`/${track.artistSlug}`} className="no-underline">
              {card}
            </Link>
          ) : (
            <div key={track.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
