"use client";

/**
 * /dashboard/ai/canvas — Canvas Video from Cover Art
 *
 * Accepts ?refImageUrl=<url> from the Cover Art Studio.
 * Lets the artist pick a track, set the cover art, and launch
 * the Remotion-powered canvas video generation ($1.99).
 */

import { useState, useEffect }   from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Play, Loader2, AlertCircle, Check, X, ChevronLeft, Music2 } from "lucide-react";
import { AIToolsNav }            from "@/components/dashboard/AIToolsNav";

interface Track {
  id:          string;
  title:       string;
  coverArtUrl: string | null;
  fileUrl:     string;
}

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const refImageUrl  = searchParams.get("refImageUrl") ?? "";

  const [tracks,        setTracks]        = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const [phase,   setPhase]   = useState<"pick" | "confirm" | "generating" | "done" | "error">("pick");
  const [error,   setError]   = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Load tracks
  useEffect(() => {
    fetch("/api/dashboard/tracks")
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then((d: { tracks?: Track[] }) => setTracks(d.tracks ?? []))
      .catch(() => {})
      .finally(() => setTracksLoading(false));
  }, []);

  // ── Step 1: Set cover art on selected track + initiate checkout ──────────────
  async function handleGenerate() {
    if (!selectedTrack || !refImageUrl) return;
    setPhase("confirm");
    setError(null);

    try {
      // 1. Set the cover art on the track
      await fetch(`/api/dashboard/tracks/${selectedTrack.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ coverArtUrl: refImageUrl }),
      });

      // 2. Initiate Stripe checkout for canvas generation
      const res  = await fetch("/api/dashboard/music/canvas/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ trackId: selectedTrack.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Failed to start checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("pick");
    }
  }

  const hasRefImage = !!refImageUrl;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <AIToolsNav />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <a href="/dashboard/ai/cover-art" className="text-muted-foreground hover:text-foreground transition">
              <ChevronLeft size={18} />
            </a>
            <div>
              <h1 className="text-2xl font-bold">Canvas Video</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Turn your cover art into a looping animated canvas video for streaming platforms.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Cover art preview */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Cover art</p>
            {hasRefImage ? (
              <div className="relative rounded-2xl overflow-hidden aspect-square border" style={{ borderColor: "var(--border)" }}>
                <img src={refImageUrl} alt="Cover art" className="w-full h-full object-cover" />
                <div
                  className="absolute bottom-0 inset-x-0 px-4 py-3 text-center"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
                >
                  <p className="text-xs font-semibold text-white">Will be used as canvas background</p>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed"
                style={{ borderColor: "var(--border)" }}
              >
                <Play size={24} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No cover art selected</p>
                <a
                  href="/dashboard/ai/cover-art"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  Go to Cover Art Studio
                </a>
              </div>
            )}

            {/* Price callout */}
            <div className="rounded-xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canvas Video</p>
                <p className="text-sm font-bold">Animated loop · 8–30 seconds</p>
              </div>
              <span className="text-xl font-black" style={{ color: "#D4A843" }}>$1.99</span>
            </div>
          </div>

          {/* Right: Track picker */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Select a track</p>
            <p className="text-xs text-muted-foreground">
              The canvas video will be attached to this track and your cover art will be set as its album art.
            </p>

            {tracksLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading tracks…
              </div>
            ) : tracks.length === 0 ? (
              <div className="rounded-xl border px-5 py-8 text-center" style={{ borderColor: "var(--border)" }}>
                <Music2 size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No tracks yet</p>
                <a href="/dashboard/music" className="text-xs font-semibold mt-2 inline-block" style={{ color: "#D4A843" }}>
                  Upload your first track →
                </a>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {tracks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTrack(t)}
                    className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                    style={{
                      borderColor:     selectedTrack?.id === t.id ? "#D4A843" : "var(--border)",
                      backgroundColor: selectedTrack?.id === t.id ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    {t.coverArtUrl ? (
                      <img src={t.coverArtUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "var(--muted)" }}>
                        <Music2 size={14} className="text-muted-foreground" />
                      </div>
                    )}
                    <span className="flex-1 text-sm font-semibold truncate">{t.title}</span>
                    {selectedTrack?.id === t.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#D4A843" }}>
                        <Check size={10} style={{ color: "#0A0A0A" }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: "#F87171", backgroundColor: "rgba(248,113,113,0.08)", color: "#F87171" }}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleGenerate}
              disabled={!selectedTrack || !hasRefImage || phase === "confirm"}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {phase === "confirm" ? (
                <><Loader2 size={16} className="animate-spin" /> Starting checkout…</>
              ) : (
                <><Play size={15} /> Generate Canvas Video — $1.99</>
              )}
            </button>

            <p className="text-[11px] text-center text-muted-foreground">
              Renders in ~2 minutes via Remotion Lambda. MP4 delivered to your dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
