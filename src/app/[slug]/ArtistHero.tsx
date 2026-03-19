"use client";

import { useEffect } from "react";
import { Instagram } from "lucide-react";
import { useAudioStore } from "@/store";
import type { AudioTrack } from "@/store";

// ─── Platform SVG icons ────────────────────────────────────────────────────────
// Lucide doesn't include Spotify, Apple Music, or TikTok — inline SVGs instead.

function SpotifyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  );
}

function AppleMusicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A4.86 4.86 0 00.09 4.88c-.014.277-.021.554-.022.832V18.3c.003.28.012.56.03.838.051.824.227 1.626.62 2.372.684 1.296 1.768 2.15 3.19 2.545.525.145 1.062.208 1.608.225.293.01.586.015.878.015H18.56c.293 0 .586-.005.878-.015.546-.017 1.083-.08 1.608-.225 1.422-.395 2.506-1.249 3.19-2.545.393-.746.57-1.548.62-2.372.018-.278.027-.558.03-.838V5.71c0-.007-.003-.013-.003-.02l.003-.07c0-.007.003-.013.003-.02v-.496c-.001-.295-.018-.59-.037-.88zM12 18.83c-3.757 0-6.8-3.042-6.8-6.8S8.243 5.23 12 5.23s6.8 3.042 6.8 6.8-3.043 6.8-6.8 6.8zm0-11.09c-2.37 0-4.29 1.92-4.29 4.29S9.63 16.32 12 16.32s4.29-1.92 4.29-4.29S14.37 7.74 12 7.74zm6.96-2.95a1.59 1.59 0 110-3.18 1.59 1.59 0 010 3.18z" />
    </svg>
  );
}

function YoutubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtistHeroProps {
  displayName:      string;
  /** Artist profile/promo photo — used as full-bleed background */
  photo:            string | null;
  /** Uploaded banner/header image — fallback if no photo */
  heroImage:        string | null;
  /** Genre + role line e.g. "Hip-Hop · Producer". Null until we have the field. */
  identityLine:     string | null;
  instagramHandle:  string | null;
  tiktokHandle:     string | null;
  youtubeChannel:   string | null;
  spotifyUrl:       string | null;
  appleMusicUrl:    string | null;
  followGateEnabled: boolean;
  /** First (latest) published track — auto-loaded on mount */
  firstTrack:       AudioTrack | null;
  /** All published tracks — used as queue context */
  allTracks:        AudioTrack[];
  /** Hex accent for gradient fallback. Defaults to IndieThis gold. */
  accentColor?:     string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArtistHero({
  displayName,
  photo,
  heroImage,
  identityLine,
  instagramHandle,
  tiktokHandle,
  youtubeChannel,
  spotifyUrl,
  appleMusicUrl,
  followGateEnabled,
  firstTrack,
  allTracks,
  accentColor = "#D4A843",
}: ArtistHeroProps) {
  const loadTrack      = useAudioStore((s) => s.load);
  const playInContext  = useAudioStore((s) => s.playInContext);
  const setMuted       = useAudioStore((s) => s.setMuted);
  const isPlaying      = useAudioStore((s) => s.isPlaying);
  const currentTrackId = useAudioStore((s) => s.currentTrack?.id);

  // ── Auto-load first track (muted, paused) on mount ──────────────────────
  useEffect(() => {
    if (!firstTrack) return;
    loadTrack(firstTrack, allTracks);
    setMuted(true);
  }, []); // intentionally runs once on mount

  // ── Listen CTA ───────────────────────────────────────────────────────────
  function handleListen() {
    if (!firstTrack) return;
    setMuted(false);
    // If this track is already loaded, just resume; otherwise start fresh
    if (currentTrackId === firstTrack.id && !isPlaying) {
      useAudioStore.getState().resume();
    } else {
      playInContext(firstTrack, allTracks);
    }
  }

  // ── Background ───────────────────────────────────────────────────────────
  const bgSrc = photo || heroImage;

  // ── Social links (only platforms with saved handles) ────────────────────
  const socials = [
    {
      key:   "spotify",
      href:  spotifyUrl,
      label: "Spotify",
      Icon:  SpotifyIcon,
    },
    {
      key:   "apple",
      href:  appleMusicUrl,
      label: "Apple Music",
      Icon:  AppleMusicIcon,
    },
    {
      key:   "youtube",
      href:  youtubeChannel,
      label: "YouTube",
      Icon:  YoutubeIcon,
    },
    {
      key:   "instagram",
      href:  instagramHandle ? `https://instagram.com/${instagramHandle.replace(/^@/, "")}` : null,
      label: "Instagram",
      Icon:  InstagramIcon,
    },
    {
      key:   "tiktok",
      href:  tiktokHandle ? `https://tiktok.com/@${tiktokHandle.replace(/^@/, "")}` : null,
      label: "TikTok",
      Icon:  TikTokIcon,
    },
  ].filter((s): s is typeof s & { href: string } => !!s.href);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ minHeight: "clamp(480px, 60vh, 700px)" }}
    >
      {/* ── Background ───────────────────────────────────────────────────── */}
      {bgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, #0A0A0A 0%, ${accentColor}14 100%)`,
          }}
        />
      )}

      {/* ── Gradient overlay ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.8) 70%, #0A0A0A 100%)",
        }}
      />

      {/* ── Content anchored to bottom-left ──────────────────────────────── */}
      <div className="relative z-10 flex flex-col justify-end h-full min-h-[inherit] px-6 pb-10 sm:px-10 sm:pb-14 max-w-5xl">

        {/* Artist name */}
        <h1
          className="font-bold text-white leading-[1.05] tracking-tight"
          style={{
            fontSize:   "clamp(2.5rem, 6vw, 4rem)",
            fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
          }}
        >
          {displayName}
        </h1>

        {/* Identity line — genre / role (empty until DB field exists) */}
        {identityLine && (
          <p
            className="mt-2 text-sm tracking-wide"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {identityLine}
          </p>
        )}

        {/* Social icons + Follow + Listen CTA */}
        <div className="flex flex-wrap items-center gap-2 mt-5">

          {/* Social platform links */}
          {socials.map(({ key, href, label, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all
                         hover:scale-110 hover:brightness-125"
              style={{
                backgroundColor: "rgba(255,255,255,0.10)",
                color:            "rgba(255,255,255,0.80)",
                backdropFilter:   "blur(4px)",
              }}
            >
              <Icon size={15} />
            </a>
          ))}

          {/* Instagram follow gate button */}
          {followGateEnabled && instagramHandle && (
            <a
              href={`https://instagram.com/${instagramHandle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                         transition-all hover:brightness-110 no-underline"
              style={{
                background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)",
                color:      "#fff",
              }}
            >
              <Instagram size={12} />
              Follow
            </a>
          )}

          {/* Listen CTA */}
          {firstTrack && (
            <button
              onClick={handleListen}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold
                         transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <path d="M2 1.5v9l8-4.5L2 1.5z" />
              </svg>
              Listen
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
