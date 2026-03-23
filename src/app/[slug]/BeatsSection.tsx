"use client";

import { useAudioStore, type AudioTrack } from "@/store";
import { Play, Pause, Music2, Radio } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicBeat = {
  id:           string;
  title:        string;
  fileUrl:      string;
  coverArtUrl:  string | null;
  price:        number | null;
  bpm:          number | null;
  musicalKey:   string | null;
  activeLeases: number;
  streamLeaseEnabled: boolean;
};

// ─── Glass card style (matches rest of public page) ───────────────────────────

const GLASS: React.CSSProperties = {
  backgroundColor:     "rgba(255,255,255,0.04)",
  backdropFilter:      "blur(8px)",
  WebkitBackdropFilter:"blur(8px)",
  border:              "1px solid rgba(255,255,255,0.08)",
};

// ─── Beat Card ────────────────────────────────────────────────────────────────

function BeatCard({ beat, artistSlug }: { beat: PublicBeat; artistSlug: string }) {
  const { play, pause, resume, currentTrack, isPlaying } = useAudioStore();

  const isThis        = currentTrack?.id === beat.id;
  const isThisPlaying = isThis && isPlaying;

  function handlePlay() {
    if (isThis) { isPlaying ? pause() : resume(); return; }
    const track: AudioTrack = {
      id:       beat.id,
      title:    beat.title,
      artist:   artistSlug,
      src:      beat.fileUrl,
      coverArt: beat.coverArtUrl ?? undefined,
    };
    play(track);
  }

  const meta = [beat.bpm && `${beat.bpm} BPM`, beat.musicalKey].filter(Boolean).join(" · ");

  return (
    <div
      id={`beat-${beat.id}`}
      className="shrink-0 w-[200px] rounded-2xl overflow-hidden flex flex-col"
      style={{ ...GLASS, scrollMarginTop: "80px" }}
    >
      {/* Cover art + play button */}
      <div className="relative w-full aspect-square bg-white/5 shrink-0">
        {beat.coverArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={beat.coverArtUrl}
            alt={beat.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
          </div>
        )}

        {/* Play overlay */}
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center transition-opacity"
          style={{
            backgroundColor: isThisPlaying ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
          }}
          onMouseEnter={(e) => { if (!isThisPlaying) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.35)"; }}
          onMouseLeave={(e) => { if (!isThisPlaying) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0)"; }}
          aria-label={isThisPlaying ? "Pause" : "Play"}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{
              backgroundColor: isThis ? "var(--accent)" : "rgba(255,255,255,0.9)",
              opacity: isThisPlaying ? 1 : 0.92,
            }}
          >
            {isThisPlaying
              ? <Pause size={16} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
              : <Play  size={16} fill="#0A0A0A" style={{ color: "#0A0A0A", marginLeft: 2 }} />
            }
          </div>
        </button>

        {/* Stream Lease badge */}
        {beat.streamLeaseEnabled && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ backgroundColor: "rgba(232,112,64,0.9)", color: "#fff" }}
          >
            <Radio size={8} />
            $1/mo
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-sm font-semibold text-white leading-tight truncate">{beat.title}</p>
        {meta && (
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{meta}</p>
        )}
        {beat.price != null && (
          <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>
            Lease from ${beat.price.toFixed(2)}
          </p>
        )}
        {beat.activeLeases > 0 && (
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {beat.activeLeases} artist{beat.activeLeases !== 1 ? "s" : ""} on this beat
          </p>
        )}

        {/* CTA buttons */}
        <div className="flex gap-1.5 mt-auto pt-1.5">
          <Link
            href="/beats"
            className="flex-1 text-center py-1.5 rounded-lg text-[11px] font-semibold no-underline transition-colors hover:brightness-110"
            style={{ backgroundColor: "rgba(212,168,67,0.2)", color: "#D4A843" }}
          >
            License
          </Link>
          {beat.streamLeaseEnabled && (
            <Link
              href="/beats"
              className="flex-1 text-center py-1.5 rounded-lg text-[11px] font-semibold no-underline transition-colors hover:brightness-110 flex items-center justify-center gap-1"
              style={{ backgroundColor: "rgba(232,112,64,0.2)", color: "#E87040" }}
            >
              <Radio size={9} />
              Lease
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Beats Section ────────────────────────────────────────────────────────────

export default function BeatsSection({
  beats,
  producerName,
  producerBio,
  artistSlug,
}: {
  beats:        PublicBeat[];
  producerName: string;
  producerBio:  string | null;
  artistSlug:   string;
}) {
  if (beats.length === 0) return null;

  return (
    <section id="beats">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            Beats
          </p>
          <h2 className="text-xl font-bold text-white">Beats by {producerName}</h2>
        </div>
        <Link
          href="/beats"
          className="text-xs font-medium no-underline hover:underline"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          View all →
        </Link>
      </div>

      {/* Producer bio */}
      {producerBio && (
        <p className="text-xs italic mb-4" style={{ color: "#999" }}>
          {producerBio}
        </p>
      )}

      {/* Horizontal scroll row */}
      <div className="flex gap-[10px] overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {beats.map((beat) => (
          <BeatCard key={beat.id} beat={beat} artistSlug={artistSlug} />
        ))}

        {/* View all card */}
        <Link
          href="/beats"
          className="shrink-0 w-[140px] rounded-2xl flex flex-col items-center justify-center gap-2 no-underline transition-colors hover:bg-white/8"
          style={{ ...GLASS, minHeight: 240 }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <span className="text-lg text-white/60">→</span>
          </div>
          <p className="text-xs font-medium text-center px-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            View all beats
          </p>
        </Link>
      </div>
    </section>
  );
}
