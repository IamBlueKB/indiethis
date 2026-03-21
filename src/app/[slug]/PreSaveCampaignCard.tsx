"use client";

import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";

// ─── Icons ────────────────────────────────────────────────────────────────────

function SpotifyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  );
}

function AppleMusicIcon({ size = 14 }: { size?: number }) {
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
  if (diff <= 0) return null;
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PreSaveCampaignCardProps {
  campaignId:    string;
  title:         string;
  artUrl:        string | null;
  releaseDate:   string; // ISO string
  spotifyUrl:    string | null;
  appleMusicUrl: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreSaveCampaignCard({
  campaignId,
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

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(release)), 1000);
    return () => clearInterval(id);
  }, [releaseDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function trackClick(platform: "SPOTIFY" | "APPLE_MUSIC") {
    void fetch("/api/public/presave-click", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId, platform }),
    });
  }

  const isReleased = timeLeft === null;

  return (
    <div>
      {/* Section label */}
      <p
        className="text-[10px] font-bold uppercase mb-[5px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        UPCOMING RELEASE
      </p>

      {/* Card */}
      <div
        className="flex gap-[14px] rounded-[10px] p-[14px]"
        style={{ backgroundColor: "#111" }}
      >
        {/* Album art 80×80 */}
        <div
          className="shrink-0 rounded-[8px] overflow-hidden flex items-center justify-center"
          style={{
            width:              80,
            height:             80,
            backgroundImage:    artUrl ? `url(${artUrl})` : undefined,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            backgroundColor:    "rgba(212,168,67,0.06)",
          }}
        >
          {!artUrl && <Music2 size={24} style={{ color: "rgba(212,168,67,0.3)" }} />}
        </div>

        {/* Right: info */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Title + date */}
          <div>
            <h3
              className="font-semibold leading-tight text-white truncate"
              style={{ fontSize: 13 }}
            >
              {title}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>
              {release.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* Countdown */}
          {!isReleased && timeLeft ? (
            <div className="flex items-center gap-[6px] mt-[6px]">
              {[
                { v: timeLeft.days,    l: "d" },
                { v: timeLeft.hours,   l: "h" },
                { v: timeLeft.minutes, l: "m" },
                { v: timeLeft.seconds, l: "s" },
              ].map(({ v, l }, i) => (
                <div key={l} className="flex items-center gap-[4px]">
                  {i > 0 && <span style={{ color: "#444", fontSize: 10 }}>:</span>}
                  <span
                    className="font-bold tabular-nums leading-none"
                    style={{ fontSize: 13, color: "#D4A843" }}
                  >
                    {pad(v)}
                  </span>
                  <span style={{ fontSize: 9, color: "#666" }}>{l}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 10, color: "#999", marginTop: 4 }}>The wait is over — stream it now.</p>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-[6px] mt-[8px]">
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick("SPOTIFY")}
                className="inline-flex items-center gap-[5px] no-underline transition-all hover:brightness-110"
                style={{
                  border:       "1px solid rgba(212,168,67,0.30)",
                  color:        "#D4A843",
                  fontSize:     10,
                  padding:      "4px 10px",
                  borderRadius: 99,
                }}
              >
                <SpotifyIcon size={10} />
                {isReleased ? "Spotify" : "Pre-save"}
              </a>
            )}
            {appleMusicUrl && (
              <a
                href={appleMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick("APPLE_MUSIC")}
                className="inline-flex items-center gap-[5px] no-underline transition-all hover:brightness-110"
                style={{
                  border:       "1px solid rgba(212,168,67,0.30)",
                  color:        "#D4A843",
                  fontSize:     10,
                  padding:      "4px 10px",
                  borderRadius: 99,
                }}
              >
                <AppleMusicIcon size={10} />
                {isReleased ? "Apple Music" : "Pre-save"}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
