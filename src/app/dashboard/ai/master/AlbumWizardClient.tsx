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

import { useState, useCallback, useRef } from "react";
import {
  Upload, Trash2, ChevronRight, ChevronLeft,
  Loader2, Check, Download, Music, Zap,
  Play, Pause, Archive, Disc3, Activity, Sun, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function AlbumWizardClient({ userId, onBack }: { userId: string; onBack?: () => void }) {
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

  // ── Version selection + playback ────────────────────────────────────────────
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

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

        const res = await fetch("/api/upload/presign", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ filename: track.file.name, contentType: track.file.type, folder: "mastering" }),
        });
        const { uploadUrl, accessUrl } = await res.json() as { uploadUrl: string; fileUrl: string; accessUrl: string };
        await fetch(uploadUrl, { method: "PUT", body: track.file, headers: { "Content-Type": track.file.type } });
        updateTrack(track.id, { fileUrl: accessUrl, status: "ready" });
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

  // ── Single checkout for entire album ────────────────────────────────────────
  async function checkoutAll() {
    setPaying(true);
    setError(null);
    try {
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripeJs) throw new Error("Stripe failed to load.");

      // One payment intent for total album cost
      const checkoutRes = await fetch("/api/mastering/album/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tier, trackCount: tracks.length }),
      });
      if (!checkoutRes.ok) throw new Error("Checkout failed.");
      const { clientSecret } = await checkoutRes.json() as { clientSecret: string; paymentIntentId: string };

      const { error: stripeErr, paymentIntent } = await stripeJs.confirmPayment({
        clientSecret,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (stripeErr) throw new Error(stripeErr.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment was not confirmed.");

      const confirmedId = paymentIntent!.id;
      setTracks((prev) => prev.map((t) => ({ ...t, stripePaymentId: confirmedId, status: "paid" as const })));
      await submitAlbum(confirmedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  // ── Submit album group ──────────────────────────────────────────────────────
  async function submitAlbum(paymentIntentId: string) {
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
        tracks: tracks.map((t) => ({
          inputFileUrl:    t.fileUrl,
          trackTitle:      t.trackTitle,
          stripePaymentId: paymentIntentId,
        })),
      }),
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      throw new Error(d.error ?? "Album submission failed.");
    }
    const data = await res.json() as { albumGroupId: string; jobIds: string[] };
    setAlbumGroupId(data.albumGroupId);
    setStep("processing");
    pollAlbumStatus(data.albumGroupId);
  }

  // ── Version selection + playback ─────────────────────────────────────────────
  function selectVersion(trackId: string, version: string) {
    setSelectedVersions((prev) => ({ ...prev, [trackId]: version }));
  }

  function applyVersionToAll(version: string) {
    const all: Record<string, string> = {};
    trackResults.forEach((t) => { all[t.id] = version; });
    setSelectedVersions(all);
  }

  function togglePlay(key: string, url: string) {
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setPlayingKey(null);
      setPlayingKey(key);
    }
  }

  async function downloadAlbum() {
    for (let i = 0; i < trackResults.length; i++) {
      const t       = trackResults[i]!;
      const version = selectedVersions[t.id] ?? t.versions?.[0]?.name ?? "Clean";
      const vdata   = (t.versions ?? []).find((v: { name: string }) => v.name === version);
      const url     = (t.exports ?? []).find((e: { platform: string }) => e.platform === "wav_master")?.url ?? vdata?.url;
      const title   = tracks[i]?.trackTitle ?? `Track ${i + 1}`;
      const num     = String(i + 1).padStart(2, "0");
      const fname   = `${num} - ${title}.wav`;
      if (!url) continue;
      setTimeout(async () => {
        try {
          const blob   = await fetch(url).then((r) => r.blob());
          const objUrl = URL.createObjectURL(blob);
          const a      = document.createElement("a");
          a.href = objUrl; a.download = fname; a.click();
          setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
        } catch { /* non-fatal */ }
      }, i * 600);
    }
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

      {/* ══ STEP: Export / Album Review ══════════════════════════════════════ */}
      {step === "export" && trackResults.length > 0 && (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Review your album</h2>
            <p className="text-sm mt-1" style={{ color: "#777" }}>
              Select a version per track, then download
            </p>
          </div>

          {/* Consistency badge */}
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <Disc3 size={14} style={{ color: "#D4A843" }} />
              <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Album-consistent mastering</span>
            </div>
            <span className="text-xs" style={{ color: "#777" }}>
              {groupStatus?.sharedLufsTarget ? `Shared target: ${groupStatus.sharedLufsTarget} LUFS` : "Shared LUFS · Tonal balance matched"}
            </span>
          </div>

          {/* Apply to all */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] shrink-0" style={{ color: "#777" }}>Apply to all:</span>
            {(["Clean", "Warm", "Punch", "Loud"] as const).map((v) => (
              <button
                key={v}
                onClick={() => applyVersionToAll(v)}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all hover:border-[#D4A843] hover:text-[#D4A843]"
                style={{ borderColor: "#2A2A2A", color: "#777" }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Track list */}
          <div className="space-y-3">
            {trackResults.map((track, i) => {
              const versions = (track.versions ?? []) as { name: string; lufs: number; truePeak: number; url: string }[];
              const selectedV = selectedVersions[track.id] ?? versions[0]?.name ?? "Clean";
              const selectedVdata = versions.find((v) => v.name === selectedV);
              if (track.status === "FAILED") {
                return (
                  <div key={track.id} className="rounded-xl border border-red-400/20 p-3 text-sm text-red-400">
                    Track {i + 1} — processing failed
                  </div>
                );
              }
              if (versions.length === 0) return null;
              const trackTitle = tracks[i]?.trackTitle ?? `Track ${i + 1}`;

              return (
                <div
                  key={track.id}
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ backgroundColor: "#0D0D0D", borderColor: "#2A2A2A" }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#1A1A1A", color: "#D4A843" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{trackTitle}</p>
                      <p className="text-[11px]" style={{ color: "#555" }}>
                        {selectedV} · {selectedVdata?.lufs.toFixed(1) ?? "—"} LUFS
                      </p>
                    </div>
                    {/* Play selected version */}
                    <button
                      onClick={() => {
                        if (selectedVdata?.url) togglePlay(`${track.id}-${selectedV}`, selectedVdata.url);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
                    >
                      {playingKey === `${track.id}-${selectedV}`
                        ? <Pause size={12} style={{ color: "#D4A843" }} />
                        : <Play  size={12} style={{ color: "#D4A843" }} />
                      }
                    </button>
                  </div>

                  {/* Mini waveform */}
                  <div className="flex items-end gap-px h-6 overflow-hidden rounded px-0.5">
                    {Array.from({ length: 50 }, (_, j) => {
                      const h = 20 + Math.abs(Math.sin(j * 0.5 + (track.id.charCodeAt(0) ?? 65) * 0.05) * 65);
                      return (
                        <div
                          key={j}
                          style={{ flex: 1, height: `${Math.min(100, h)}%`, borderRadius: 1, backgroundColor: "#D4A843", opacity: 0.7 }}
                        />
                      );
                    })}
                  </div>

                  {/* Version pills */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["Clean", "Warm", "Punch", "Loud"] as const).map((v) => {
                      const vdata    = versions.find((x) => x.name === v);
                      const isSel    = selectedV === v;
                      return (
                        <button
                          key={v}
                          onClick={() => {
                            selectVersion(track.id, v);
                            if (playingKey?.startsWith(track.id)) {
                              audioRef.current?.pause();
                              setPlayingKey(null);
                            }
                          }}
                          disabled={!vdata}
                          className="py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-30"
                          style={isSel
                            ? { backgroundColor: "#D4A843", color: "#0A0A0A", borderColor: "#D4A843" }
                            : { borderColor: "#2A2A2A", color: "#777" }}
                        >
                          {v}
                          {vdata && (
                            <div className="text-[9px] mt-0.5 font-normal opacity-70">
                              {vdata.lufs.toFixed(0)} LUFS
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Download album */}
          <div className="space-y-2 pt-2">
            <button
              onClick={downloadAlbum}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <Archive size={16} /> Download Album
              <span className="text-xs font-normal opacity-80">
                ({trackResults.length} tracks · WAV)
              </span>
            </button>
            <p className="text-[11px] text-center" style={{ color: "#555" }}>
              Files saved as <code className="text-[#777]">01 - Track Title.wav</code>, <code className="text-[#777]">02 - Track Title.wav</code>…
            </p>
          </div>
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
