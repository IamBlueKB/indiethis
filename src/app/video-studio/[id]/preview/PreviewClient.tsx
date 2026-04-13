"use client";

/**
 * PreviewClient — final video preview, format tabs, download button, guest CTA.
 * Director Mode: also shows per-scene regeneration panel (one free redo).
 */

import { useState }                        from "react";
import {
  Film, Download, Music2, Activity, Zap, ChevronRight,
  Share2, Check, RefreshCw, Loader2, Clapperboard,
  ThumbsUp, ThumbsDown,
} from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  "16:9":            "YouTube",
  "9:16":            "TikTok / Reels",
  "1:1":             "Instagram Feed",
  "spotify-canvas":  "Spotify Canvas",
};

interface SceneRef {
  sceneIndex: number;
  videoUrl:   string;
  model:      string;
  prompt:     string;
  startTime:  number;
  endTime:    number;
}

interface TrendingTrack {
  id:          string;
  title:       string;
  coverArtUrl: string | null;
  artist:      { artistName: string | null; name: string | null; artistSlug: string | null };
}

interface Props {
  id:             string;
  trackTitle:     string;
  finalVideoUrl:  string;
  finalVideoUrls: Record<string, string> | null;
  aspectRatio:    string;
  style:          string | null;
  mode:           string;
  bpm:            number | null;
  musicalKey:     string | null;
  energy:         number | null;
  amount:         number;
  isOwner:        boolean;
  isGuest:        boolean;
  trendingTracks?: TrendingTrack[];
}

export default function PreviewClient({
  id, trackTitle, finalVideoUrl, finalVideoUrls,
  aspectRatio, style, mode, bpm, musicalKey, energy,
  amount, isOwner, isGuest, trendingTracks = [],
}: Props) {
  const [activeFormat, setActiveFormat] = useState<string>(aspectRatio);
  const [copied,       setCopied]       = useState(false);
  const [regenIdx,     setRegenIdx]     = useState<number | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError,   setRegenError]   = useState<string | null>(null);
  const [regenDone,    setRegenDone]    = useState(false);

  // Feedback state
  const [feedbackLiked,     setFeedbackLiked]     = useState<boolean | null>(null);
  const [feedbackNote,      setFeedbackNote]      = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading,   setFeedbackLoading]   = useState(false);

  const isDirector = mode === "DIRECTOR";

  async function handleRegen(sceneIndex: number) {
    if (regenLoading || regenDone) return;
    setRegenIdx(sceneIndex);
    setRegenLoading(true);
    setRegenError(null);
    try {
      const res  = await fetch(`/api/video-studio/director/${id}/scene-regen`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sceneIndex }),
      });
      const data = await res.json();
      if (!res.ok) { setRegenError(data.error ?? "Regen failed"); return; }
      setRegenDone(true);
      // Refresh page to show new scene
      window.location.reload();
    } catch {
      setRegenError("Connection error. Please try again.");
    } finally {
      setRegenLoading(false);
    }
  }

  async function handleFeedback(liked: boolean) {
    if (feedbackLoading || feedbackSubmitted) return;
    setFeedbackLiked(liked);
    setFeedbackLoading(true);
    try {
      await fetch(`/api/video-studio/${id}/feedback`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ liked, notes: feedbackNote || undefined }),
      });
      setFeedbackSubmitted(true);
    } catch {
      // Silent — feedback is best-effort
    } finally {
      setFeedbackLoading(false);
    }
  }

  // Available formats from finalVideoUrls + primary
  const availableFormats = finalVideoUrls ? Object.keys(finalVideoUrls) : [aspectRatio];
  const currentUrl = finalVideoUrls?.[activeFormat] ?? finalVideoUrl;

  function handleCopy() {
    const url = `${window.location.origin}/video-studio/${id}/preview`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between" style={{ backgroundColor: "#0A0A0A", borderColor: "#1E1E1E" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Film size={16} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Music Video Studio</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: "#888" }}>by IndieThis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border"
            style={{ borderColor: "#2A2A2A", color: copied ? "#34C759" : "#888" }}
          >
            {copied ? <Check size={12} /> : <Share2 size={12} />}
            {copied ? "Copied!" : "Share"}
          </button>
          <a
            href="/video-studio"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
          >
            <Film size={12} /> New Video
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Track title + badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(52,199,89,0.1)", color: "#34C759" }}>
            <Check size={11} /> Video Complete
          </div>
          <h1 className="text-2xl font-black text-white">{trackTitle}</h1>
          {style && <p className="text-sm" style={{ color: "#888" }}>{style} style</p>}
        </div>

        {/* Format tabs (only show if multiple formats available) */}
        {availableFormats.length > 1 && (
          <div className="flex gap-2">
            {availableFormats.map(f => (
              <button
                key={f}
                onClick={() => setActiveFormat(f)}
                className="px-4 py-2 rounded-full text-xs font-semibold transition-all border"
                style={{
                  borderColor:     activeFormat === f ? "#D4A843" : "#2A2A2A",
                  backgroundColor: activeFormat === f ? "rgba(212,168,67,0.1)" : "transparent",
                  color:           activeFormat === f ? "#D4A843" : "#888",
                }}
              >
                {FORMAT_LABELS[f] ?? f}
              </button>
            ))}
          </div>
        )}

        {/* Video player */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            aspectRatio:     activeFormat === "9:16" ? "9/16" : activeFormat === "1:1" ? "1/1" : "16/9",
            backgroundColor: "#111",
            maxHeight:       activeFormat === "9:16" ? "80vh" : undefined,
            maxWidth:        activeFormat === "9:16" ? "360px" : undefined,
            margin:          activeFormat === "9:16" ? "0 auto" : undefined,
          }}
        >
          {currentUrl ? (
            <video
              key={currentUrl}
              src={currentUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
              style={{ backgroundColor: "#000" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: "#666" }}>Video processing…</p>
            </div>
          )}
        </div>

        {/* Download + share */}
        <div className="flex flex-wrap gap-3">
          {currentUrl && (
            <a
              href={currentUrl}
              download={`${trackTitle.replace(/\s+/g, "-").toLowerCase()}-music-video.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Download size={15} /> Download {FORMAT_LABELS[activeFormat] ?? activeFormat} MP4
            </a>
          )}
        </div>

        {/* Stats row */}
        {(bpm !== null || musicalKey !== null || energy !== null) && (
          <div className="grid grid-cols-3 gap-3">
            {bpm !== null && (
              <div className="rounded-xl border px-4 py-3 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
                <Activity size={14} style={{ color: "#D4A843" }} className="mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>BPM</p>
                <p className="text-lg font-black" style={{ color: "#D4A843" }}>{bpm}</p>
              </div>
            )}
            {musicalKey && (
              <div className="rounded-xl border px-4 py-3 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
                <Music2 size={14} style={{ color: "#D4A843" }} className="mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>Key</p>
                <p className="text-lg font-black" style={{ color: "#D4A843" }}>{musicalKey}</p>
              </div>
            )}
            {energy !== null && (
              <div className="rounded-xl border px-4 py-3 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
                <Zap size={14} style={{ color: "#D4A843" }} className="mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>Energy</p>
                <p className="text-lg font-black" style={{ color: "#D4A843" }}>{Math.round(energy * 10)}/10</p>
              </div>
            )}
          </div>
        )}

        {/* Director Mode — Review + Refine */}
        {isDirector && isOwner && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
            <div className="flex items-center gap-2">
              <Clapperboard size={15} style={{ color: "#D4A843" }} />
              <p className="text-sm font-bold text-white">Review + Refine</p>
            </div>
            <p className="text-xs" style={{ color: "#888" }}>
              Not happy with a scene? You get <span style={{ color: "#D4A843" }}>one free regeneration</span>. The AI will re-generate that clip with a fresh attempt using the same prompt.
            </p>
            {regenError && (
              <p className="text-xs text-red-400">{regenError}</p>
            )}
            {regenDone && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#34C759" }}>
                <Check size={12} /> Scene regenerated! Refreshing…
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3].map(i => (
                <button
                  key={i}
                  onClick={() => handleRegen(i)}
                  disabled={regenLoading || regenDone}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition disabled:opacity-40"
                  style={{
                    borderColor:     regenIdx === i && regenLoading ? "#D4A843" : "#2A2A2A",
                    color:           regenIdx === i && regenLoading ? "#D4A843" : "#888",
                    backgroundColor: "transparent",
                  }}
                >
                  {regenIdx === i && regenLoading
                    ? <Loader2 size={11} className="animate-spin" />
                    : <RefreshCw size={11} />}
                  Scene {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guest CTA */}
        {isGuest && (
          <div className="rounded-2xl border px-6 py-6 space-y-3" style={{ borderColor: "#2A1F00", backgroundColor: "rgba(212,168,67,0.04)" }}>
            <div>
              <p className="text-base font-bold text-white">Keep your video. Unlock your library.</p>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Join IndieThis to save your videos, access your full library, and get music videos included with your plan every month.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/signup"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Join IndieThis <ChevronRight size={14} />
              </a>
              <a
                href="/pricing"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "#2A2A2A", color: "#888" }}
              >
                View Plans
              </a>
            </div>
          </div>
        )}

        {/* Subscriber upsell if they paid */}
        {!isGuest && !isOwner && amount > 0 && (
          <div className="rounded-2xl border px-6 py-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
            <p className="text-sm font-semibold text-white">Get included monthly videos</p>
            <p className="text-xs mt-1 mb-3" style={{ color: "#888" }}>
              Upgrade your plan to get 1–4 music videos included each month.
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: "#D4A843" }}
            >
              View Plans <ChevronRight size={12} />
            </a>
          </div>
        )}

        {/* Explore discovery */}
        <div className="border-t pt-8 space-y-5" style={{ borderColor: "#1A1A1A" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Discover more music on IndieThis</p>
              <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                Browse tracks, merch, and beats from independent artists.
              </p>
            </div>
            <a
              href="/explore"
              className="flex items-center gap-1.5 text-xs font-semibold shrink-0"
              style={{ color: "#D4A843" }}
            >
              <Music2 size={12} /> Explore &rarr;
            </a>
          </div>

          {/* Feedback panel */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "#0D0D0D", border: "1px solid #1A1A1A" }}
          >
            {feedbackSubmitted ? (
              <div className="flex items-center gap-3 py-1">
                <Check size={18} style={{ color: "#D4A843" }} />
                <p className="text-sm" style={{ color: "#aaa" }}>
                  Thanks for the feedback — it helps us improve!
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium mb-3" style={{ color: "#ccc" }}>
                  How did it turn out?
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => handleFeedback(true)}
                    disabled={feedbackLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: feedbackLiked === true ? "#D4A843" : "#1A1A1A",
                      color:           feedbackLiked === true ? "#0A0A0A" : "#888",
                      border:          "1px solid #2A2A2A",
                    }}
                  >
                    <ThumbsUp size={15} />
                    Love it
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    disabled={feedbackLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: feedbackLiked === false ? "#2A1A1A" : "#1A1A1A",
                      color:           feedbackLiked === false ? "#E05050" : "#888",
                      border:          "1px solid #2A2A2A",
                    }}
                  >
                    <ThumbsDown size={15} />
                    Not quite
                  </button>
                </div>
                {feedbackLiked !== null && !feedbackSubmitted && (
                  <textarea
                    value={feedbackNote}
                    onChange={e => setFeedbackNote(e.target.value)}
                    placeholder="Any notes? (optional)"
                    rows={2}
                    maxLength={500}
                    className="w-full text-sm rounded-lg px-3 py-2 resize-none"
                    style={{
                      backgroundColor: "#111",
                      border:          "1px solid #222",
                      color:           "#ccc",
                      outline:         "none",
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Trending track cards — horizontal row */}
          {trendingTracks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {trendingTracks.map(track => {
                const artistName = track.artist.artistName || track.artist.name || "Artist";
                const href = track.artist.artistSlug ? `/${track.artist.artistSlug}` : "/explore";
                return (
                  <a
                    key={track.id}
                    href={href}
                    className="group rounded-xl overflow-hidden no-underline transition-all hover:opacity-80"
                    style={{ backgroundColor: "#111", border: "1px solid #1E1E1E" }}
                  >
                    {track.coverArtUrl ? (
                      <img
                        src={track.coverArtUrl}
                        alt={track.title}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div
                        className="w-full aspect-square flex items-center justify-center"
                        style={{ backgroundColor: "#1A1A1A" }}
                      >
                        <Music2 size={20} style={{ color: "#333" }} />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "#666" }}>{artistName}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
