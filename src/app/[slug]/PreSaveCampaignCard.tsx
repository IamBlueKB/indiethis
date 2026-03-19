"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Music2 } from "lucide-react";

// ─── Spotify icon ─────────────────────────────────────────────────────────────

function SpotifyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  );
}

// ─── Apple Music icon ─────────────────────────────────────────────────────────

function AppleMusicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A4.86 4.86 0 00.09 4.88c-.014.277-.021.554-.022.832V18.3c.003.28.012.56.03.838.051.824.227 1.626.62 2.372.684 1.296 1.768 2.15 3.19 2.545.525.145 1.062.208 1.608.225.293.01.586.015.878.015H18.56c.293 0 .586-.005.878-.015.546-.017 1.083-.08 1.608-.225 1.422-.395 2.506-1.249 3.19-2.545.393-.746.57-1.548.62-2.372.018-.278.027-.558.03-.838V5.71c0-.007-.003-.013-.003-.02l.003-.07c0-.007.003-.013.003-.02v-.496c-.001-.295-.018-.59-.037-.88zM12 18.83c-3.757 0-6.8-3.042-6.8-6.8S8.243 5.23 12 5.23s6.8 3.042 6.8 6.8-3.043 6.8-6.8 6.8zm0-11.09c-2.37 0-4.29 1.92-4.29 4.29S9.63 16.32 12 16.32s4.29-1.92 4.29-4.29S14.37 7.74 12 7.74zm6.96-2.95a1.59 1.59 0 110-3.18 1.59 1.59 0 010 3.18z" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getTimeLeft(releaseDate: Date) {
  const diff = releaseDate.getTime() - Date.now();
  if (diff <= 0) return null; // released
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

// ─── Countdown unit ───────────────────────────────────────────────────────────

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-3xl font-bold tabular-nums leading-none"
        style={{
          fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
          color:      "#D4A843",
        }}
      >
        {pad(value)}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
        {label}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PreSaveCampaignCardProps {
  title:        string;
  artUrl:       string | null;
  releaseDate:  string; // ISO string — safe to pass from server to client
  spotifyUrl:   string | null;
  appleMusicUrl: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreSaveCampaignCard({
  title,
  artUrl,
  releaseDate,
  spotifyUrl,
  appleMusicUrl,
}: PreSaveCampaignCardProps) {
  const release = new Date(releaseDate);

  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(
    () => getTimeLeft(release)
  );

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(release));
    }, 1000);
    return () => clearInterval(id);
  }, [releaseDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const isReleased = timeLeft === null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.03)" }}
    >
      <div className="flex flex-col sm:flex-row gap-0">

        {/* ── Album art ───────────────────────────────────────────────────── */}
        <div
          className="sm:w-36 sm:h-36 w-full aspect-square sm:aspect-auto shrink-0 flex items-center justify-center"
          style={{
            backgroundImage:    artUrl ? `url(${artUrl})` : undefined,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            backgroundColor:    "rgba(212,168,67,0.06)",
          }}
        >
          {!artUrl && (
            <Music2 size={28} style={{ color: "rgba(212,168,67,0.3)" }} />
          )}
        </div>

        {/* ── Right content ───────────────────────────────────────────────── */}
        <div className="flex-1 px-5 py-5 flex flex-col justify-between gap-4">

          {/* Label + title */}
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: isReleased ? "#34C759" : "#D4A843" }}
            >
              {isReleased ? "Out Now" : "Coming Soon"}
            </p>
            <h3 className="text-base font-bold text-white leading-tight">{title}</h3>

            {/* Release date */}
            <p className="text-xs text-white/40 mt-0.5">
              {release.toLocaleDateString("en-US", {
                month: "long",
                day:   "numeric",
                year:  "numeric",
              })}
            </p>
          </div>

          {/* Countdown or "listen now" tagline */}
          {!isReleased && timeLeft ? (
            <div className="flex items-start gap-4">
              <CountUnit value={timeLeft.days}    label="Days"    />
              <div className="text-white/25 text-2xl font-thin leading-none pt-1">:</div>
              <CountUnit value={timeLeft.hours}   label="Hours"   />
              <div className="text-white/25 text-2xl font-thin leading-none pt-1">:</div>
              <CountUnit value={timeLeft.minutes} label="Min"     />
              <div className="text-white/25 text-2xl font-thin leading-none pt-1">:</div>
              <CountUnit value={timeLeft.seconds} label="Sec"     />
            </div>
          ) : (
            <p className="text-sm text-white/50">
              The wait is over — stream it now.
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2">
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold
                           no-underline transition-all hover:brightness-110 hover:scale-[1.02]"
                style={{ backgroundColor: "#1DB954", color: "#000" }}
              >
                <SpotifyIcon size={13} />
                {isReleased ? "Listen on Spotify" : "Pre-save on Spotify"}
              </a>
            )}
            {appleMusicUrl && (
              <a
                href={appleMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold
                           no-underline transition-all hover:brightness-110 hover:scale-[1.02]"
                style={{ backgroundColor: "#FA243C", color: "#fff" }}
              >
                <AppleMusicIcon size={13} />
                {isReleased ? "Listen on Apple Music" : "Pre-save on Apple Music"}
              </a>
            )}
            {/* Fallback if no platform links */}
            {!spotifyUrl && !appleMusicUrl && isReleased && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
                <ExternalLink size={11} />
                Streaming links coming soon
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
