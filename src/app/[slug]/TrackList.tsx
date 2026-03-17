"use client";

import { useState, useRef, useEffect } from "react";
import { Music2, Play, Pause, Loader2, Download, Instagram, ExternalLink, X, Check } from "lucide-react";

type Track = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  price: number | null;
  plays: number;
  fileUrl: string;
};

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div
        className="w-full max-w-sm rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
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
            Follow <span className="font-semibold text-foreground">@{instagramHandle}</span> on Instagram to download{" "}
            <span className="font-semibold text-foreground">{track.title}</span> for free.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {/* Step 1: Follow button */}
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

          {/* Step 2: Confirm + download */}
          <button
            onClick={handleDownload}
            disabled={!followed}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {followed ? <><Check size={15} /> I Followed — Download Now</> : <><Download size={15} /> I Followed — Download Now</>}
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

// ─── TrackList ────────────────────────────────────────────────────────────────

export default function TrackList({
  tracks,
  followGateEnabled = false,
  instagramHandle = null,
}: {
  tracks: Track[];
  followGateEnabled?: boolean;
  instagramHandle?: string | null;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [gateTrack, setGateTrack] = useState<Track | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  function handleTrackClick(track: Track) {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    setLoadingId(track.id);
    setProgress(0);

    const audio = new Audio(track.fileUrl);
    audioRef.current = audio;

    audio.addEventListener("canplay", () => {
      setLoadingId(null);
      setPlayingId(track.id);
      audio.play().catch(() => { setLoadingId(null); setPlayingId(null); });
    });
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener("ended", () => { setPlayingId(null); setProgress(0); });
    audio.addEventListener("error", () => { setLoadingId(null); setPlayingId(null); });
  }

  function handleDownload(track: Track) {
    if (followGateEnabled && instagramHandle && track.price === null) {
      setGateTrack(track);
    } else {
      // Direct download for paid tracks or when gate is off
      const a = document.createElement("a");
      a.href = track.fileUrl;
      a.download = track.title;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  const showDownloadButtons = followGateEnabled && instagramHandle;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Music</h2>

      {/* Mini waveform bar when playing */}
      {playingId && (
        <div className="h-1 rounded-full overflow-hidden transition-all" style={{ backgroundColor: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: "var(--accent)" }}
          />
        </div>
      )}

      <div className="space-y-2">
        {tracks.map((track, i) => {
          const isPlaying = playingId === track.id;
          const isLoading = loadingId === track.id;
          const isFree    = track.price === null;

          return (
            <div
              key={track.id}
              className="flex items-center gap-4 rounded-xl border px-4 py-3 group transition-colors"
              style={{
                backgroundColor: isPlaying ? "rgba(212,168,67,0.06)" : "var(--card)",
                borderColor: isPlaying ? "rgba(212,168,67,0.3)" : "var(--border)",
              }}
            >
              {/* Play button / number */}
              <div
                className="w-8 flex items-center justify-center shrink-0 cursor-pointer"
                onClick={() => handleTrackClick(track)}
              >
                {isLoading ? (
                  <Loader2 size={14} className="text-accent animate-spin" />
                ) : isPlaying ? (
                  <Pause size={14} className="text-accent" />
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground group-hover:hidden">{i + 1}</span>
                    <Play size={14} className="text-muted-foreground hidden group-hover:block" />
                  </>
                )}
              </div>

              {/* Cover art */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                style={{
                  backgroundImage: track.coverArtUrl ? `url(${track.coverArtUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundColor: "var(--border)",
                }}
                onClick={() => handleTrackClick(track)}
              >
                {!track.coverArtUrl && <Music2 size={14} className="text-muted-foreground" />}
              </div>

              {/* Title */}
              <p
                className="flex-1 text-sm font-medium text-foreground truncate cursor-pointer"
                onClick={() => handleTrackClick(track)}
              >
                {track.title}
              </p>

              {/* Meta + actions */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {track.plays.toLocaleString()} plays
                </span>
                {track.price != null && (
                  <span className="text-xs font-bold" style={{ color: "#D4A843" }}>
                    ${track.price.toFixed(2)}
                  </span>
                )}
                {showDownloadButtons && isFree && (
                  <button
                    onClick={() => handleDownload(track)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5 border"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                    title="Free download — follow to unlock"
                  >
                    <Download size={11} />
                    Free
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
