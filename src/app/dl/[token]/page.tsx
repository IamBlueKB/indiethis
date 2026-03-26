"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Download, Music2, AlertTriangle, CheckCircle2, Clock,
  Sparkles, ArrowRight, Play, Pause, FileAudio, File as FileIcon,
} from "lucide-react";

type DownloadData = {
  senderName:   string;
  message:      string | null;
  fileUrls:     string[];
  expiresAt:    string;
  downloadedAt: string | null;
  studioSlug:   string;
  hasAccount:   boolean;
};

function FileRowIcon({ url }: { url: string }) {
  // UploadThing URLs have no extension — default to audio icon since most deliveries are audio
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  const isAudio = ["mp3", "wav", "aiff", "flac", "ogg", "m4a"].includes(ext);
  const Icon = isAudio ? FileAudio : FileIcon;
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
    >
      <Icon size={14} style={{ color: "#D4A843" }} />
    </div>
  );
}

export default function DownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData]               = useState<DownloadData | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [playing, setPlaying]         = useState(false);
  const [showPlayer, setShowPlayer]   = useState(true);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch(`/api/dl/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load files."));
  }, [token]);

  const isExpired = data ? new Date(data.expiresAt) < new Date() : false;

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().catch(() => {}); setPlaying(true); }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="mx-auto text-red-400" />
          <p className="text-foreground font-semibold">{error}</p>
          <p className="text-sm text-muted-foreground">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#D4A843", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-lg mx-auto space-y-5">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <Music2 size={24} style={{ color: "#D4A843" }} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Files from {data.senderName}</h1>
          {data.message && (
            <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{data.message}&rdquo;</p>
          )}
        </div>

        {/* ── Expiry notice ─────────────────────────────────────────────────── */}
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-2.5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {isExpired ? (
            <>
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">This link has expired.</p>
            </>
          ) : data.downloadedAt ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Downloaded on{" "}
                {new Date(data.downloadedAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </>
          ) : (
            <>
              <Clock size={14} className="text-yellow-400 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Expires{" "}
                {new Date(data.expiresAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </>
          )}
        </div>

        {!isExpired && (
          <>
            {/* ── Audio player ─────────────────────────────────────────────── */}
            {showPlayer && data.fileUrls.length > 0 && (
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Hidden audio element */}
                <audio
                  ref={audioRef}
                  src={data.fileUrls[currentTrack]}
                  onEnded={() => setPlaying(false)}
                  onError={() => setShowPlayer(false)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />

                {/* Player UI */}
                <div className="px-5 py-5 flex items-center gap-4">
                  {/* Play/pause button */}
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "#D4A843" }}
                  >
                    {playing
                      ? <Pause size={18} style={{ color: "#0A0A0A" }} fill="#0A0A0A" />
                      : <Play  size={18} style={{ color: "#0A0A0A" }} fill="#0A0A0A" className="ml-0.5" />
                    }
                  </button>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {playing ? "Now playing…" : "Tap to preview"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {data.senderName}
                      {data.fileUrls.length > 1 && ` · Track ${currentTrack + 1} of ${data.fileUrls.length}`}
                    </p>
                  </div>

                  {/* Download this track */}
                  <a
                    href={`/api/dl/${token}/download?index=${currentTrack}`}
                    download
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 shrink-0"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    <Download size={13} />
                    Download
                  </a>
                </div>

                {/* Track switcher (only if multiple files) */}
                {data.fileUrls.length > 1 && (
                  <div
                    className="border-t px-5 py-3 flex gap-2 overflow-x-auto"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {data.fileUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            setPlaying(false);
                          }
                          setCurrentTrack(i);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors shrink-0"
                        style={{
                          backgroundColor: currentTrack === i ? "rgba(212,168,67,0.15)" : "transparent",
                          color: currentTrack === i ? "#D4A843" : "var(--muted-foreground)",
                          border: `1px solid ${currentTrack === i ? "rgba(212,168,67,0.4)" : "var(--border)"}`,
                        }}
                      >
                        <Music2 size={10} />
                        Track {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Files list ───────────────────────────────────────────────── */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {data.fileUrls.length} File{data.fileUrls.length !== 1 ? "s" : ""}
                </p>
              </div>
              {data.fileUrls.map((url, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-4 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <FileRowIcon url={url} />
                  <p className="flex-1 text-sm text-foreground truncate min-w-0">
                    Track {i + 1}
                  </p>
                  <a
                    href={`/api/dl/${token}/download?index=${i}`}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 shrink-0"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    <Download size={12} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Join IndieThis CTA — only for non-members on non-expired links ── */}
        {!isExpired && !data.hasAccount && (
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
              >
                <Sparkles size={16} style={{ color: "#D4A843" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-snug">
                  Powered by IndieThis
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  This studio uses IndieThis to manage sessions, deliver files,
                  and power AI tools for their artists.
                </p>
              </div>
            </div>

            <div className="space-y-2 pl-12">
              {[
                "AI music video, lyric video & cover art generation",
                "A&R reports and press kit builder",
                "Session booking and file delivery tools",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#D4A843" }} />
                  <p className="text-xs text-muted-foreground">{feat}</p>
                </div>
              ))}
            </div>

            <a
              href={`/signup?ref=${encodeURIComponent(data.studioSlug)}&source=file_delivery`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Join IndieThis — Free to explore
              <ArrowRight size={14} />
            </a>

            <p className="text-center text-xs text-muted-foreground">
              No credit card required · Free plan available
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
        </p>
      </div>
    </div>
  );
}
