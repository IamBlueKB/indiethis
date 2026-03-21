"use client";

import InlinePlayer from "@/components/audio/InlinePlayer";
import type { AudioTrack } from "@/store";

export type PortfolioTrack = {
  id: string;
  title: string;
  artistName: string;
  audioUrl: string;
  coverUrl?: string | null;
  description?: string | null;
  artistSlug?: string | null;
};

interface Props {
  tracks: PortfolioTrack[];
  accent?: string;
  /** Dark template = white text; light template = dark text */
  dark?: boolean;
}

export function PortfolioSection({ tracks, accent = "#D4A843", dark = true }: Props) {
  if (!tracks.length) return null;

  const visible = tracks.slice(0, 6);

  const audioTracks: AudioTrack[] = visible.map((t) => ({
    id:       t.id,
    title:    t.title,
    artist:   t.artistName,
    src:      t.audioUrl,
    coverArt: t.coverUrl ?? undefined,
  }));

  const textColor  = dark ? "#ffffff" : "#0A0A0A";
  const subColor   = dark ? "rgba(255,255,255,0.5)" : "#888888";
  const trackBg    = dark ? "rgba(255,255,255,0.04)" : "#F5F5F5";
  const trackBorder = dark ? "rgba(255,255,255,0.08)" : "#E5E5E5";

  return (
    <section id="portfolio">
      {/* Section label */}
      <p style={{
        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em",
        textTransform: "uppercase", color: accent, marginBottom: "1.25rem",
      }}>
        PORTFOLIO
      </p>
      <h2 style={{
        fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
        letterSpacing: "-0.02em", color: textColor, marginBottom: "2.5rem", lineHeight: 1.1,
      }}>
        Hear Our Work
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {visible.map((track, i) => (
          <div key={track.id} style={{
            backgroundColor: trackBg,
            border: `1px solid ${trackBorder}`,
            borderRadius: "10px",
            padding: "1rem 1.25rem",
            display: "grid",
            gridTemplateColumns: track.coverUrl ? "40px 1fr" : "1fr",
            gap: "0.875rem",
            alignItems: "center",
          }}>
            {/* Cover art */}
            {track.coverUrl && (
              <img src={track.coverUrl} alt={track.title}
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            )}

            <div style={{ minWidth: 0 }}>
              {/* Title + artist */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {track.title}
                </span>
                {track.artistSlug ? (
                  <a href={`/${track.artistSlug}`} style={{ fontSize: "0.78rem", color: accent, textDecoration: "none", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                    {track.artistName}
                  </a>
                ) : (
                  <span style={{ fontSize: "0.78rem", color: subColor, whiteSpace: "nowrap" }}>{track.artistName}</span>
                )}
              </div>

              {/* Waveform player */}
              <InlinePlayer
                track={audioTracks[i]}
                context={audioTracks}
              />

              {track.description && (
                <p style={{ fontSize: "0.78rem", color: subColor, marginTop: "0.5rem", lineHeight: 1.5 }}>
                  {track.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
