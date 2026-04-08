"use client";

/**
 * AlbumWizardClient — multi-track album mastering wizard
 *
 * Subscribers upload 2–20 stereo masters. The AI analyzes all tracks together,
 * derives a shared loudness/EQ profile for consistency, and masters each track
 * to 4 versions with the same tonal signature.
 *
 * Steps: configure → upload tracks → checkout → processing → compare & export
 */

import { useState, useCallback } from "react";
import {
  Upload, Trash2, ChevronRight, ChevronLeft,
  Loader2, Check, Download, Music, Zap, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlbumStep = "configure" | "tracks" | "processing" | "export";
type Tier      = "STANDARD" | "PREMIUM" | "PRO";
type Mood      = "CLEAN" | "WARM" | "PUNCH" | "LOUD";

interface TrackEntry {
  id:           string;   // temp client ID
  file:         File | null;
  fileUrl:      string;   // after upload
  trackTitle:   string;
  stripePaymentId?: string;
  status:       "pending" | "uploading" | "ready" | "paid";
}

interface AlbumTrackResult {
  id:              string;
  status:          string;
  versions?:       { name: string; lufs: number; url: string }[];
  exports?:        { platform: string; lufs: number; format: string; url: string }[];
  previewUrl?:     string;
  selectedVersion?: string | null;
}

interface AlbumGroupStatus {
  status:           string;
  completedTracks:  number;
  totalTracks:      number;
  sharedLufsTarget?: number;
  trackOrder?:      string[];
}

const TIER_PRICE_PER_TRACK: Record<Tier, string> = {
  STANDARD: "$11.99",
  PREMIUM:  "$17.99",
  PRO:      "$27.99",
};

const MOOD_OPTIONS: { value: Mood; label: string; description: string }[] = [
  { value: "CLEAN", label: "Clean",  description: "Balanced, reference-quality" },
  { value: "WARM",  label: "Warm",   description: "Vintage character, smooth highs" },
  { value: "PUNCH", label: "Punch",  description: "Aggressive, transient-forward" },
  { value: "LOUD",  label: "Loud",   description: "Maximum competitive loudness" },
];

function uid(): string {
  return Math.random().toString(36).slice(2);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlbumWizardClient({ userId }: { userId: string }) {
  const [step,        setStep]        = useState<AlbumStep>("configure");
  const [albumTitle,  setAlbumTitle]  = useState("");
  const [artist,      setArtist]      = useState("");
  const [genre,       setGenre]       = useState("");
  const [mood,        setMood]        = useState<Mood>("CLEAN");
  const [nlPrompt,    setNlPrompt]    = useState("");
  const [tier,        setTier]        = useState<Tier>("PREMIUM");
  const [tracks,      setTracks]      = useState<TrackEntry[]>([
    { id: uid(), file: null, fileUrl: "", trackTitle: "Track 1", status: "pending" },
    { id: uid(), file: null, fileUrl: "", trackTitle: "Track 2", status: "pending" },
  ]);
  const [uploading,   setUploading]   = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [albumGroupId, setAlbumGroupId] = useState<string | null>(null);
  const [groupStatus, setGroupStatus]  = useState<AlbumGroupStatus | null>(null);
  const [trackResults, setTrackResults] = useState<AlbumTrackResult[]>([]);
  const [error,       setError]       = useState<string | null>(null);

  // ── Track management ────────────────────────────────────────────────────────
  function addTrack() {
    if (tracks.length >= 20) return;
    setTracks((prev) => [
      ...prev,
      { id: uid(), file: null, fileUrl: "", trackTitle: `Track ${prev.length + 1}`, status: "pending" },
    ]);
  }

  function removeTrack(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTrack(id: string, patch: Partial<TrackEntry>) {
    setTracks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }

  const onFileDrop = useCallback((id: string, file: File) => {
    updateTrack(id, { file, trackTitle: file.name.replace(/\.[^.]+$/, ""), status: "pending" });
  }, []);

  // ── Upload all files ────────────────────────────────────────────────────────
  async function uploadAll() {
    setUploading(true);
    setError(null);
    try {
      for (const track of tracks) {
        if (!track.file || track.status === "ready") continue;
        updateTrack(track.id, { status: "uploading" });

        const res = await fetch("/api/mastering/upload-url", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ filename: track.file.name, mimeType: track.file.type }),
        });
        const { uploadUrl, fileUrl } = await res.json() as { uploadUrl: string; fileUrl: string };
        await fetch(uploadUrl, { method: "PUT", body: track.file, headers: { "Content-Type": track.file.type } });
        updateTrack(track.id, { fileUrl, status: "ready" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
      return;
    }
    setUploading(false);
    // Proceed to checkout
    await checkoutAll();
  }

  // ── Checkout each track ─────────────────────────────────────────────────────
  async function checkoutAll() {
    setPaying(true);
    setError(null);
    try {
      const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripeJs) throw new Error("Stripe failed to load.");

      for (const track of tracks) {
        if (track.status === "paid") continue;
        if (!track.fileUrl) continue;

        // Create PaymentIntent per track
        const piRes = await fetch("/api/mastering/checkout", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ mode: "MASTER_ONLY", tier }),
        });
        const { clientSecret, paymentIntentId } = await piRes.json() as {
          clientSecret: string;
          paymentIntentId: string;
        };

        const { error: stripeError } = await stripeJs.confirmPayment({
          clientSecret,
          confirmParams: { return_url: window.location.href },
          redirect: "if_required",
        });

        if (stripeError) throw new Error(stripeError.message);
        updateTrack(track.id, { stripePaymentId: paymentIntentId, status: "paid" });
      }

      // All paid — submit album mastering job
      await submitAlbum();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  // ── Submit album group ──────────────────────────────────────────────────────
  async function submitAlbum() {
    const res = await fetch("/api/mastering/album", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title:  albumTitle.trim() || "Untitled Album",
        artist: artist.trim() || undefined,
        genre:  genre || undefined,
        mood,
        naturalLanguagePrompt: nlPrompt.trim() || undefined,
        tier,
        tracks: tracks
          .filter((t) => t.status === "paid")
          .map((t) => ({
            inputFileUrl:    t.fileUrl,
            trackTitle:      t.trackTitle,
            stripePaymentId: t.stripePaymentId!,
          })),
      }),
    });

    const data = await res.json() as { albumGroupId: string; jobIds: string[] };
    setAlbumGroupId(data.albumGroupId);
    setStep("processing");
    pollAlbumStatus(data.albumGroupId);
  }

  // ── Poll album status ───────────────────────────────────────────────────────
  function pollAlbumStatus(groupId: string) {
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mastering/album/${groupId}`);
        const data = await res.json() as { group: AlbumGroupStatus; tracks: AlbumTrackResult[] };
        setGroupStatus(data.group);
        setTrackResults(data.tracks);

        if (data.group.status === "COMPLETE" || data.group.status === "FAILED") {
          clearInterval(interval);
          if (data.group.status === "COMPLETE") setStep("export");
        }
      } catch {
        // silently retry
      }
    }, 5000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "#ff6b6b22", color: "#ff6b6b", border: "1px solid #ff6b6b44" }}>
          {error}
        </div>
      )}

      {/* ══ STEP: Configure ════════════════════════════════════════════════════ */}
      {step === "configure" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Album details</h2>
            <p className="text-sm" style={{ color: "#777" }}>
              All tracks will share the same loudness target and tonal profile for a cohesive album sound.
            </p>
          </div>

          {/* Album title */}
          <div>
            <label className="block text-sm font-medium mb-2">Album title</label>
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="e.g. Blue Frequencies Vol. 1"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A", color: "#fff" }}
            />
          </div>

          {/* Artist */}
          <div>
            <label className="block text-sm font-medium mb-2">Artist name <span style={{ color: "#555" }}>(optional)</span></label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Blue Nova"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A", color: "#fff" }}
            />
          </div>

          {/* Tier */}
          <div>
            <label className="block text-sm font-medium mb-3">Mastering tier <span className="text-xs font-normal" style={{ color: "#777" }}>(per track)</span></label>
            <div className="grid grid-cols-3 gap-3">
              {(["STANDARD", "PREMIUM", "PRO"] as Tier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn("p-3 rounded-xl border text-center transition-all")}
                  style={{
                    backgroundColor: tier === t ? "#D4A843" : "#1A1A1A",
                    borderColor:     tier === t ? "#D4A843" : "#2A2A2A",
                    color:           tier === t ? "#0A0A0A" : "#ccc",
                  }}
                >
                  <div className="font-bold text-sm">{t.charAt(0) + t.slice(1).toLowerCase()}</div>
                  <div className="text-xs mt-0.5" style={{ color: tier === t ? "#0A0A0A" : "#777" }}>
                    {TIER_PRICE_PER_TRACK[t]}/track
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="block text-sm font-medium mb-3">Master character</label>
            <div className="grid grid-cols-2 gap-3">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={cn("p-3 rounded-xl border text-left transition-all")}
                  style={{
                    backgroundColor: mood === m.value ? "#D4A843" : "#1A1A1A",
                    borderColor:     mood === m.value ? "#D4A843" : "#2A2A2A",
                    color:           mood === m.value ? "#0A0A0A" : "#ccc",
                  }}
                >
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: mood === m.value ? "#0A0A0A" : "#777" }}>{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Natural language prompt */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Zap size={14} style={{ color: "#D4A843" }} />
              Direction for every track <span style={{ color: "#555" }}>(optional)</span>
            </label>
            <textarea
              value={nlPrompt}
              onChange={(e) => setNlPrompt(e.target.value)}
              rows={2}
              placeholder="e.g. Keep it warm and radio-ready. Don't over-compress."
              className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A", color: "#fff" }}
            />
          </div>

          <button
            onClick={() => setStep("tracks")}
            disabled={!albumTitle.trim()}
            className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Add tracks <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ══ STEP: Tracks ═══════════════════════════════════════════════════════ */}
      {step === "tracks" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Upload your tracks</h2>
              <p className="text-sm mt-1" style={{ color: "#777" }}>
                {tracks.length} tracks · {TIER_PRICE_PER_TRACK[tier]}/track · total {tracks.length > 0 ? `$${(parseFloat(TIER_PRICE_PER_TRACK[tier].slice(1)) * tracks.length).toFixed(2)}` : "$0"}
              </p>
            </div>
            <button
              onClick={() => setStep("configure")}
              className="text-xs flex items-center gap-1"
              style={{ color: "#777" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          </div>

          {/* Track list */}
          <div className="space-y-3">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                onRemove={() => removeTrack(track.id)}
                onFile={(f) => onFileDrop(track.id, f)}
                onTitle={(title) => updateTrack(track.id, { trackTitle: title })}
                canRemove={tracks.length > 2}
              />
            ))}
          </div>

          {/* Add track */}
          {tracks.length < 20 && (
            <button
              onClick={addTrack}
              className="w-full py-3 rounded-xl border text-sm font-medium transition-all hover:border-[#444]"
              style={{ borderColor: "#2A2A2A", borderStyle: "dashed", color: "#777" }}
            >
              + Add another track
            </button>
          )}

          {/* Upload + pay */}
          <button
            onClick={uploadAll}
            disabled={uploading || paying || tracks.some((t) => !t.file)}
            className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {(uploading || paying) ? (
              <><Loader2 size={18} className="animate-spin" /> {uploading ? "Uploading…" : "Processing payment…"}</>
            ) : (
              <>Upload &amp; pay — {tracks.length > 0 ? `$${(parseFloat(TIER_PRICE_PER_TRACK[tier].slice(1)) * tracks.length).toFixed(2)}` : "$0"} <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      )}

      {/* ══ STEP: Processing ════════════════════════════════════════════════════ */}
      {step === "processing" && groupStatus && (
        <div className="space-y-6 text-center">
          <div>
            <h2 className="text-lg font-semibold mb-2">Mastering your album</h2>
            <p className="text-sm" style={{ color: "#777" }}>
              {groupStatus.completedTracks} of {groupStatus.totalTracks} tracks complete
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                backgroundColor: "#D4A843",
                width: `${groupStatus.totalTracks > 0
                  ? (groupStatus.completedTracks / groupStatus.totalTracks) * 100
                  : 0}%`,
              }}
            />
          </div>

          {/* Per-track status */}
          <div className="space-y-2 text-left">
            {trackResults.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: "#1A1A1A" }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-sm">Track {i + 1}</span>
                </div>
                <StatusPill status={t.status} />
              </div>
            ))}
          </div>

          {groupStatus.status === "FAILED" && (
            <p className="text-sm" style={{ color: "#ff6b6b" }}>
              Some tracks failed to process. Please contact support.
            </p>
          )}
        </div>
      )}

      {/* ══ STEP: Export ════════════════════════════════════════════════════════ */}
      {step === "export" && trackResults.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Your album is ready</h2>
            <p className="text-sm" style={{ color: "#777" }}>
              All tracks mastered to a shared loudness target{groupStatus?.sharedLufsTarget ? ` (${groupStatus.sharedLufsTarget} LUFS)` : ""}.
            </p>
          </div>

          {trackResults.map((track, i) => {
            const versions = (track.versions ?? []) as { name: string; lufs: number; url: string }[];
            const exports  = (track.exports  ?? []) as { platform: string; lufs: number; format: string; url: string }[];
            if (versions.length === 0) return null;

            return (
              <div key={track.id} className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Track {i + 1}</p>
                    <p className="text-xs" style={{ color: "#777" }}>{track.status === "FAILED" ? "Processing failed" : `${versions.length} versions`}</p>
                  </div>
                </div>

                {track.status !== "FAILED" && (
                  <>
                    {/* Versions */}
                    <div className="grid grid-cols-2 gap-2">
                      {versions.map((v) => (
                        <a
                          key={v.name}
                          href={v.url}
                          download
                          className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: "#1A1A1A", color: "#ccc" }}
                        >
                          <Download size={12} style={{ color: "#D4A843" }} />
                          {v.name} · {v.lufs.toFixed(1)} LUFS
                        </a>
                      ))}
                    </div>

                    {/* Platform exports */}
                    {exports.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {exports.map((e) => (
                          <a
                            key={e.platform}
                            href={e.url}
                            download
                            className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                            style={{ backgroundColor: "#1A1A1A", color: "#ccc", border: "1px solid #2A2A2A" }}
                          >
                            <Check size={12} style={{ color: "#D4A843" }} />
                            {e.platform} · {e.format.toUpperCase()}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TrackRow sub-component ───────────────────────────────────────────────────

function TrackRow({
  track,
  index,
  onRemove,
  onFile,
  onTitle,
  canRemove,
}: {
  track:    TrackEntry;
  index:    number;
  onRemove: () => void;
  onFile:   (f: File) => void;
  onTitle:  (t: string) => void;
  canRemove: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border"
      style={{ backgroundColor: "#111", borderColor: dragging ? "#D4A843" : "#1A1A1A" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Track number */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {index + 1}
      </div>

      {/* File picker */}
      <label className="shrink-0 cursor-pointer">
        <input
          type="file"
          accept="audio/wav,audio/aiff,audio/flac,audio/mpeg"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
          style={{ backgroundColor: track.file ? "#D4A843" : "#1A1A1A", color: track.file ? "#0A0A0A" : "#555" }}
        >
          {track.file ? <Check size={14} /> : <Upload size={14} />}
        </div>
      </label>

      {/* Track title input */}
      <input
        type="text"
        value={track.trackTitle}
        onChange={(e) => onTitle(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: track.file ? "#fff" : "#555" }}
        placeholder="Track name"
      />

      {/* File name / status */}
      {track.file && (
        <span className="text-xs shrink-0" style={{ color: "#555" }}>
          {track.file.name.length > 16 ? track.file.name.slice(0, 14) + "…" : track.file.name}
        </span>
      )}

      {/* Remove */}
      {canRemove && (
        <button onClick={onRemove} className="shrink-0 hover:opacity-70 transition-opacity">
          <Trash2 size={14} style={{ color: "#555" }} />
        </button>
      )}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    PENDING:   { label: "Queued",     color: "#555" },
    ANALYZING: { label: "Analyzing",  color: "#D4A843" },
    MASTERING: { label: "Mastering",  color: "#D4A843" },
    COMPLETE:  { label: "Done",       color: "#4ecdc4" },
    FAILED:    { label: "Failed",     color: "#ff6b6b" },
  };
  const { label, color } = map[status] ?? { label: status, color: "#555" };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}22`, color }}>
      {label}
    </span>
  );
}
