"use client";

import { useState, useEffect } from "react";
import { Music2, Download, Instagram, ExternalLink, X, Check, Play, ChevronDown, ChevronUp } from "lucide-react";
import { useAudioStore } from "@/store";
import InlinePlayer from "@/components/audio/InlinePlayer";
import type { AudioTrack } from "@/store";
import { detectDevice, buildStreamingLinks } from "@/lib/smart-links";
import type { DeviceType } from "@/lib/smart-links";

// ─── Types ────────────────────────────────────────────────────────────────────

type Track = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  price: number | null;
  plays: number;
  fileUrl: string;
};

// ─── Platform SVG icons ───────────────────────────────────────────────────────
// Keyed to match StreamingLink["key"] from smart-links.ts

const PLATFORM_ICONS: Record<string, (props: { size: number }) => React.ReactElement> = {
  spotify: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  ),
  apple: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A4.86 4.86 0 00.09 4.88c-.014.277-.021.554-.022.832V18.3c.003.28.012.56.03.838.051.824.227 1.626.62 2.372.684 1.296 1.768 2.15 3.19 2.545.525.145 1.062.208 1.608.225.293.01.586.015.878.015H18.56c.293 0 .586-.005.878-.015.546-.017 1.083-.08 1.608-.225 1.422-.395 2.506-1.249 3.19-2.545.393-.746.57-1.548.62-2.372.018-.278.027-.558.03-.838V5.71c0-.007-.003-.013-.003-.02l.003-.07c0-.007.003-.013.003-.02v-.496c-.001-.295-.018-.59-.037-.88zM12 18.83c-3.757 0-6.8-3.042-6.8-6.8S8.243 5.23 12 5.23s6.8 3.042 6.8 6.8-3.043 6.8-6.8 6.8zm0-11.09c-2.37 0-4.29 1.92-4.29 4.29S9.63 16.32 12 16.32s4.29-1.92 4.29-4.29S14.37 7.74 12 7.74zm6.96-2.95a1.59 1.59 0 110-3.18 1.59 1.59 0 010 3.18z" />
    </svg>
  ),
  youtube: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  soundcloud: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M1.175 12.225c-.017 0-.034.002-.05.006-.007-.068-.01-.137-.01-.206C1.115 9.5 3.1 7.5 5.6 7.5c.27 0 .536.024.792.07a5.8 5.8 0 015.208-3.25 5.8 5.8 0 015.8 5.8c0 .163-.008.325-.023.484A3.2 3.2 0 0119.2 16.5H1.175a1.175 1.175 0 010-2.35z" />
    </svg>
  ),
};

// ─── Streaming link row (device-aware, with click tracking) ──────────────────

function StreamingLinks({
  spotifyUrl,
  appleMusicUrl,
  youtubeChannel,
  soundcloudUrl,
  device,
  artistSlug,
  trackId,
}: {
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  youtubeChannel?: string | null;
  soundcloudUrl?: string | null;
  device: DeviceType;
  artistSlug?: string;
  trackId?: string;
}) {
  const links = buildStreamingLinks(
    { spotifyUrl, appleMusicUrl, youtubeChannel, soundcloudUrl },
    device,
  );

  if (!links.length) return null;

  function handleClick(platform: string) {
    if (!artistSlug) return;
    fetch("/api/public/artist-linkclick", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ artistSlug, platform, trackId: trackId ?? null }),
    }).catch(() => {});
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ key, label, href, bg, color }) => {
        const Icon = PLATFORM_ICONS[key];
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(key)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold no-underline
                       transition-all hover:brightness-110 hover:scale-[1.02]"
            style={{ backgroundColor: bg, color }}
          >
            {Icon && <Icon size={11} />}
            {label}
          </a>
        );
      })}
    </div>
  );
}

// ─── Now-playing bars (duplicated from InlinePlayer to avoid import coupling) ──

function NowPlayingBars() {
  return (
    <div className="flex items-end gap-[2px]" style={{ width: 13, height: 13 }} aria-hidden>
      <style>{`
        @keyframes trackNpBar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 3, height: "100%", borderRadius: 2,
            backgroundColor: "currentColor", transformOrigin: "bottom",
            animation: "trackNpBar 0.75s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Follow Gate Modal ────────────────────────────────────────────────────────

function FollowGateModal({
  track,
  instagramHandle,
  onClose,
}: {
  track: Track;
  instagramHandle: string;
  onClose: () => void;
}) {
  const [followed, setFollowed] = useState(false);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = track.fileUrl;
    a.download = track.title;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <X size={14} />
          </button>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)" }}
          >
            <Instagram size={22} className="text-white" />
          </div>
          <h2 className="text-base font-bold text-foreground">Free Download</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Follow{" "}
            <span className="font-semibold text-foreground">@{instagramHandle}</span>{" "}
            on Instagram to download{" "}
            <span className="font-semibold text-foreground">{track.title}</span>{" "}
            for free.
          </p>
        </div>
        <div className="px-6 pb-6 space-y-3">
          <a
            href={`https://instagram.com/${instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setFollowed(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold no-underline"
            style={{ background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)", color: "white" }}
          >
            <Instagram size={16} />
            Follow @{instagramHandle}
            <ExternalLink size={12} className="opacity-70" />
          </a>
          <button
            onClick={handleDownload}
            disabled={!followed}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {followed ? <Check size={15} /> : <Download size={15} />}
            I Followed — Download Now
          </button>
          {!followed && (
            <p className="text-center text-xs text-muted-foreground">
              Click &ldquo;Follow&rdquo; first, then download will unlock.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cover art tile ────────────────────────────────────────────────────────────

function CoverArt({
  url,
  size,
  className = "",
}: {
  url: string | null;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-xl overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "rgba(212,168,67,0.06)",
      }}
    >
      {!url && <Music2 size={size * 0.25} style={{ color: "rgba(212,168,67,0.3)" }} />}
    </div>
  );
}

// ─── TrackList ────────────────────────────────────────────────────────────────

export default function TrackList({
  tracks,
  artistName,
  artistSlug,
  followGateEnabled = false,
  instagramHandle = null,
  spotifyUrl = null,
  appleMusicUrl = null,
  youtubeChannel = null,
  soundcloudUrl = null,
}: {
  tracks: Track[];
  artistName?: string;
  artistSlug?: string;
  followGateEnabled?: boolean;
  instagramHandle?: string | null;
  /** Artist-level streaming links shown on each track */
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  youtubeChannel?: string | null;
  soundcloudUrl?: string | null;
}) {
  const currentTrackId = useAudioStore((s) => s.currentTrack?.id);
  const isPlaying      = useAudioStore((s) => s.isPlaying);
  const playInContext  = useAudioStore((s) => s.playInContext);

  const [gateTrack,  setGateTrack]  = useState<Track | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Device detection — starts as "desktop" (safe SSR default), updates after hydration
  const [device, setDevice] = useState<DeviceType>("desktop");
  useEffect(() => { setDevice(detectDevice()); }, []);

  // Build full queue context once — used for all InlinePlayers
  const audioContext: AudioTrack[] = tracks.map((t) => ({
    id:       t.id,
    title:    t.title,
    artist:   artistName ?? "",
    src:      t.fileUrl,
    coverArt: t.coverArtUrl ?? undefined,
  }));

  const featured   = tracks[0]  ?? null;
  const rest       = tracks.slice(1);       // up to 9 more (page.tsx already caps at 10)

  const streamingProps = { spotifyUrl, appleMusicUrl, youtubeChannel, soundcloudUrl, device, artistSlug };

  function fireTrackPlay(trackId: string) {
    if (!artistSlug) return;
    fetch("/api/public/artist-trackplay", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ trackId, artistSlug }),
    }).catch(() => {});
  }

  function handleDownload(track: Track) {
    if (followGateEnabled && instagramHandle && track.price === null) {
      setGateTrack(track);
    } else {
      const a = document.createElement("a");
      a.href = track.fileUrl;
      a.download = track.title;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function handleSmallCardPlay(track: Track) {
    playInContext(
      { id: track.id, title: track.title, artist: artistName ?? "", src: track.fileUrl, coverArt: track.coverArtUrl ?? undefined },
      audioContext,
    );
    fireTrackPlay(track.id);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (!featured) return null;

  // ── Featured track audio object ──────────────────────────────────────────
  const featuredAudio: AudioTrack = {
    id:       featured.id,
    title:    featured.title,
    artist:   artistName ?? "",
    src:      featured.fileUrl,
    coverArt: featured.coverArtUrl ?? undefined,
  };

  return (
    <section className="space-y-5">

      {/* ── Section label ──────────────────────────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Music</h2>

      {/* ── Featured release card ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.03)" }}
      >
        <div className="flex flex-col sm:flex-row">

          {/* Cover art */}
          <div
            className="sm:w-48 sm:h-48 w-full aspect-square sm:aspect-auto shrink-0 flex items-center justify-center"
            style={{
              backgroundImage:    featured.coverArtUrl ? `url(${featured.coverArtUrl})` : undefined,
              backgroundSize:     "cover",
              backgroundPosition: "center",
              backgroundColor:    "rgba(212,168,67,0.06)",
            }}
          >
            {!featured.coverArtUrl && (
              <Music2 size={40} style={{ color: "rgba(212,168,67,0.3)" }} />
            )}
          </div>

          {/* Right: title + player + links */}
          <div className="flex-1 px-5 py-5 flex flex-col justify-between gap-4">

            {/* Label + title + plays */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/40">
                Latest Release
              </p>
              <h3
                className="font-bold text-white leading-tight"
                style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)" }}
              >
                {featured.title}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {featured.plays.toLocaleString()} plays
              </p>
            </div>

            {/* Waveform player */}
            <InlinePlayer
              track={featuredAudio}
              context={audioContext}
              onPlay={() => fireTrackPlay(featured.id)}
            />

            {/* Streaming + download row */}
            <div className="flex flex-wrap items-center gap-2">
              <StreamingLinks {...streamingProps} trackId={featured.id} />
              {followGateEnabled && instagramHandle && featured.price === null && (
                <button
                  onClick={() => handleDownload(featured)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
                >
                  <Download size={11} />
                  Free DL
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Horizontal scroll row (remaining tracks) ────────────────────────── */}
      {rest.length > 0 && (
        <div className="space-y-3">

          {/* Scroll container */}
          <div
            className="flex gap-3 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {rest.map((track) => {
              const isActive   = currentTrackId === track.id;
              const isThisPlaying = isActive && isPlaying;
              const isExpanded = expandedId === track.id;

              return (
                <div key={track.id} className="shrink-0" style={{ width: 120 }}>

                  {/* Card */}
                  <div
                    className="relative rounded-xl overflow-hidden cursor-pointer group transition-transform hover:scale-[1.02]"
                    style={{ width: 120, height: 120 }}
                    onClick={() => toggleExpand(track.id)}
                  >
                    {/* Cover art */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:    track.coverArtUrl ? `url(${track.coverArtUrl})` : undefined,
                        backgroundSize:     "cover",
                        backgroundPosition: "center",
                        backgroundColor:    "rgba(212,168,67,0.06)",
                      }}
                    />
                    {!track.coverArtUrl && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Music2 size={28} style={{ color: "rgba(212,168,67,0.3)" }} />
                      </div>
                    )}

                    {/* Dark overlay */}
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: isExpanded ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)" }}
                    />

                    {/* Play button (center) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSmallCardPlay(track); }}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                        style={{
                          backgroundColor: isActive ? "#D4A843" : "rgba(212,168,67,0.85)",
                          color: "#0A0A0A",
                        }}
                        aria-label={isThisPlaying ? "Pause" : `Play ${track.title}`}
                      >
                        {isThisPlaying ? <NowPlayingBars /> : <Play size={14} style={{ marginLeft: 2 }} />}
                      </button>
                    </div>

                    {/* Expand indicator (bottom-right) */}
                    <div className="absolute bottom-2 right-2 opacity-60">
                      {isExpanded
                        ? <ChevronUp size={12} style={{ color: "#D4A843" }} />
                        : <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.6)" }} />
                      }
                    </div>

                    {/* Active border */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ border: "2px solid rgba(212,168,67,0.6)" }}
                      />
                    )}
                  </div>

                  {/* Title */}
                  <p
                    className="text-xs font-medium mt-2 truncate"
                    style={{ color: isActive ? "#D4A843" : "rgba(255,255,255,0.7)" }}
                    title={track.title}
                  >
                    {track.title}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Expanded panel ────────────────────────────────────────────────── */}
          {expandedId && (() => {
            const track = rest.find((t) => t.id === expandedId);
            if (!track) return null;
            const trackAudio: AudioTrack = {
              id:       track.id,
              title:    track.title,
              artist:   artistName ?? "",
              src:      track.fileUrl,
              coverArt: track.coverArtUrl ?? undefined,
            };
            return (
              <div
                className="rounded-2xl border px-4 py-4 space-y-3 transition-all"
                style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.03)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CoverArt url={track.coverArtUrl} size={40} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{track.title}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {track.plays.toLocaleString()} plays
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Waveform player */}
                <InlinePlayer track={trackAudio} context={audioContext} />

                {/* Streaming + download */}
                <div className="flex flex-wrap items-center gap-2">
                  <StreamingLinks {...streamingProps} />
                  {followGateEnabled && instagramHandle && track.price === null && (
                    <button
                      onClick={() => handleDownload(track)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
                    >
                      <Download size={11} />
                      Free DL
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Follow gate modal */}
      {gateTrack && instagramHandle && (
        <FollowGateModal
          track={gateTrack}
          instagramHandle={instagramHandle}
          onClose={() => setGateTrack(null)}
        />
      )}
    </section>
  );
}
