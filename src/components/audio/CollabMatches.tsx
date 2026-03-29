"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";

interface CollabMatch {
  id:         string;
  name:       string;
  slug:       string | null;
  avatarUrl:  string | null;
  genre:      string | null;
  trackCount: number;
  score:      number;
  reason:     string;
  strengths:  string[];
}

interface CollabMatchesProps {
  limit?: number;
}

export default function CollabMatches({ limit = 8 }: CollabMatchesProps) {
  const [matches, setMatches] = useState<CollabMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/audio-features/collab-matches?limit=${limit}`)
      .then(r => r.json())
      .then(d => setMatches(d.matches ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading || matches.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Handshake size={14} style={{ color: "#D4A843" }} />
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#D4A843", letterSpacing: "0.12em" }}
        >
          Collab Matches
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {matches.map(match => {
          const initials = match.name
            .split(" ")
            .map(w => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          const scoreLabel = Math.round(match.score * 100);

          const card = (
            <div
              key={match.id}
              className="shrink-0 rounded-xl border p-3 flex flex-col gap-2 transition-all hover:border-[rgba(212,168,67,0.4)]"
              style={{ background: "#111111", borderColor: "#1A1A1A", width: 180 }}
            >
              {/* Header: avatar + name */}
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                >
                  {match.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={match.avatarUrl} alt={match.name} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#FFFFFF" }}>
                    {match.name}
                  </p>
                  {match.genre && (
                    <p className="text-[10px] truncate" style={{ color: "#666" }}>
                      {match.genre}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <p className="text-[10px] leading-relaxed" style={{ color: "#888888" }}>
                {match.reason}
              </p>

              {/* Strengths */}
              {match.strengths.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {match.strengths.map(s => (
                    <span
                      key={s}
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#888888" }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Score bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px]" style={{ color: "#555" }}>Collab fit</span>
                  <span className="text-[10px] font-bold" style={{ color: "#D4A843" }}>
                    {scoreLabel}%
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${scoreLabel}%`,
                      background: "linear-gradient(90deg, rgba(212,168,67,0.6), #D4A843)",
                    }}
                  />
                </div>
              </div>
            </div>
          );

          return match.slug ? (
            <Link key={match.id} href={`/${match.slug}`} className="no-underline">
              {card}
            </Link>
          ) : (
            <div key={match.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
