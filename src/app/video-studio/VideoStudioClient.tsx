"use client";

/**
 * VideoStudioClient — 3-step creation wizard for Quick Mode
 *
 * Step 1: Upload / Select Track
 * Step 2: Style + Format
 * Step 3: Confirm + Pay → redirects to /video-studio/[id]/generating
 *
 * Director Mode tab: redirects to /video-studio/director after creating the record.
 */

import { useEffect, useRef, useState }    from "react";
import { useRouter }                      from "next/navigation";
import {
  Film, Upload, Music2, Zap, ChevronRight, ChevronLeft,
  Loader2, AlertCircle, Check, X, Wand2, Clapperboard,
} from "lucide-react";
import { useUploadThing }  from "@/lib/uploadthing-client";
import { DEFAULT_VIDEO_PRICES } from "@/lib/video-studio/model-router";
import AvatarPicker, { type AvatarSelectPayload } from "@/components/avatar/AvatarPicker";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VideoStyle {
  id:         string;
  name:       string;
  category:   string;
  previewUrl: string;
  sortOrder:  number;
}

interface UserTrack {
  id:          string;
  title:       string;
  fileUrl:     string;
  coverArtUrl: string | null;
  audioFeatures?: { duration: number } | null;
}

type WizardMode   = "QUICK" | "DIRECTOR";
type VideoLength  = "SHORT" | "STANDARD" | "EXTENDED";
type AspectRatio  = "16:9" | "9:16" | "1:1";

interface Props {
  userId:                string | null;
  userTier:              string | null;
  initialMode?:          "QUICK" | "DIRECTOR";
  initialGuestEmail?:    string;
  initialCoverArtUrl?:   string; // pre-seeded from cover art studio
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["ALL", "CINEMATIC", "ANIMATED", "ABSTRACT", "RETRO", "DARK", "BRIGHT"] as const;

const FORMAT_OPTIONS: { value: AspectRatio; label: string; icon: string; sub: string }[] = [
  { value: "16:9", label: "YouTube",          icon: "▬", sub: "Landscape · 1920×1080" },
  { value: "9:16", label: "TikTok / Reels",   icon: "▐", sub: "Vertical · 1080×1920"  },
  { value: "1:1",  label: "Instagram Feed",   icon: "■", sub: "Square · 1080×1080"    },
];

const LENGTH_OPTIONS: { value: VideoLength; label: string; sub: string }[] = [
  { value: "SHORT",    label: "Short",    sub: "First verse + chorus · ~1 min" },
  { value: "STANDARD", label: "Standard", sub: "Most of the song · up to 3 min" },
  { value: "EXTENDED", label: "Extended", sub: "Full song · no limit"           },
];

// ─── Price helper ───────────────────────────────────────────────────────────────

function formatTier(tier: string | null): "GUEST" | "LAUNCH" | "PUSH" | "REIGN" {
  if (tier === "LAUNCH" || tier === "PUSH" || tier === "REIGN") return tier;
  return "GUEST";
}

function getPrice(mode: WizardMode, length: VideoLength, tier: string | null): number {
  const t = formatTier(tier);
  if (t !== "GUEST") {
    // Subscriber extras
    const key = `${t}_${mode}_${length === "SHORT" ? "EXTRA_SHORT" : length === "EXTENDED" ? "EXTRA_EXTENDED" : "EXTRA_STANDARD"}` as keyof typeof DEFAULT_VIDEO_PRICES;
    const val = DEFAULT_VIDEO_PRICES[key as keyof typeof DEFAULT_VIDEO_PRICES];
    if (typeof val === "number" && val > 0) return val;
  }
  const guestKey = `GUEST_${mode}_${length}` as keyof typeof DEFAULT_VIDEO_PRICES;
  return (DEFAULT_VIDEO_PRICES[guestKey] as number | undefined) ?? 1999;
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function VideoStudioClient({ userId, userTier, initialMode, initialGuestEmail, initialCoverArtUrl }: Props) {
  const router = useRouter();

  // Wizard state
  const [mode,    setMode]    = useState<WizardMode>(initialMode ?? "QUICK");
  const [step,    setStep]    = useState<1 | 2 | 3>(1);

  // Cover art pre-seeded from cover art studio
  const [coverArtRefUrl, setCoverArtRefUrl] = useState<string | null>(initialCoverArtUrl ?? null);

  // Avatar ref — selected from AvatarPicker (takes priority over cover art ref)
  const [avatarRefUrl, setAvatarRefUrl] = useState<string | null>(null);

  // Step 1 — track selection
  const [audioUrl,       setAudioUrl]       = useState("");
  const [trackTitle,     setTrackTitle]     = useState("");
  const [trackDuration,  setTrackDuration]  = useState(180); // seconds
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [userTracks,      setUserTracks]    = useState<UserTrack[]>([]);
  const [tracksLoading,   setTracksLoading] = useState(false);
  const [audioUploading,  setAudioUploading] = useState(false);
  const [uploadError,     setUploadError]   = useState<string | null>(null);
  const [dragOver,        setDragOver]       = useState(false);

  // Step 2 — style + format
  const [styles,       setStyles]       = useState<VideoStyle[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [activeCat,     setActiveCat]    = useState<typeof CATEGORIES[number]>("ALL");
  const [aspectRatio,   setAspectRatio]  = useState<AspectRatio>("16:9");
  const [videoLength,   setVideoLength]  = useState<VideoLength>("STANDARD");

  // Step 3 — confirm + pay
  const [guestEmail,  setGuestEmail]  = useState(initialGuestEmail ?? "");
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Load user tracks (if logged in) ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setTracksLoading(true);
    fetch("/api/dashboard/tracks")
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then(d => setUserTracks((d.tracks ?? []).slice(0, 20)))
      .catch(() => {})
      .finally(() => setTracksLoading(false));
  }, [userId]);

  // ── Load styles on step 2 ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || styles.length > 0) return;
    setStylesLoading(true);
    fetch("/api/video-studio/styles")
      .then(r => r.ok ? r.json() : { styles: [] })
      .then(d => {
        setStyles(d.styles ?? []);
        if (d.styles?.length > 0) setSelectedStyle(d.styles[0].name);
      })
      .catch(() => {})
      .finally(() => setStylesLoading(false));
  }, [step, styles.length]);

  // ── UploadThing audio upload ──────────────────────────────────────────────────
  const { startUpload } = useUploadThing("videoStudioAudio", {
    onUploadBegin:    () => { setAudioUploading(true); setUploadError(null); },
    onUploadError:    (e) => { setAudioUploading(false); setUploadError(e.message); },
    onClientUploadComplete: (res) => {
      setAudioUploading(false);
      const url = res[0]?.url;
      if (url) setAudioUrl(url);
    },
  });


  // ── Step 1 validation ─────────────────────────────────────────────────────────
  const step1Valid = audioUrl.trim().length > 0 && trackTitle.trim().length > 0;

  // ── Track select helper ────────────────────────────────────────────────────────
  function selectTrack(t: UserTrack) {
    setSelectedTrackId(t.id);
    setAudioUrl(t.fileUrl);
    setTrackTitle(t.title);
    setTrackDuration(t.audioFeatures?.duration ?? 180);
  }

  // ── Detect duration from uploaded audio file ──────────────────────────────────
  function handleAudioFile(file: File) {
    setTrackTitle(file.name.replace(/\.[^.]+$/, ""));
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      setTrackDuration(Math.round(audio.duration));
      URL.revokeObjectURL(audio.src);
    };
    startUpload([file]);
  }

  // ── Confirm + Pay ──────────────────────────────────────────────────────────────
  async function handleConfirmPay() {
    if (creating) return;
    if (!userId && !guestEmail.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      // Create the record
      const createRes = await fetch("/api/video-studio/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          audioUrl,
          trackTitle:    trackTitle.trim(),
          trackDuration,
          trackId:       selectedTrackId ?? undefined,
          mode,
          videoLength,
          style:         selectedStyle,
          aspectRatio,
          guestEmail:    !userId ? guestEmail.trim() : undefined,
          characterRefs: (() => {
            const refs = [avatarRefUrl ?? coverArtRefUrl].filter((u): u is string => Boolean(u));
            return refs.length > 0 ? refs : undefined;
          })(),
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        setCreateError(createData.error ?? "Failed to create video");
        return;
      }

      const { id, requiresPayment } = createData as { id: string; requiresPayment: boolean; amount: number };

      // Director Mode — redirect to director chat (payment happens after shot list approval)
      if (mode === "DIRECTOR") {
        if (!userId && guestEmail.trim()) {
          document.cookie = `videoStudio_guest=${encodeURIComponent(JSON.stringify({ email: guestEmail.trim(), videoId: id }))}; max-age=604800; path=/`;
        }
        router.push(`/video-studio/director/${id}`);
        return;
      }

      if (!requiresPayment) {
        // Subscriber with included credit — generation already started
        // Set guest cookie for later linking
        if (!userId && guestEmail.trim()) {
          document.cookie = `videoStudio_guest=${encodeURIComponent(JSON.stringify({ email: guestEmail.trim(), videoId: id }))}; max-age=604800; path=/`;
        }
        router.push(`/video-studio/${id}/generating`);
        return;
      }

      // Requires payment → get Stripe URL
      const checkoutRes = await fetch(`/api/video-studio/${id}/checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: !userId ? guestEmail.trim() : undefined }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) {
        setCreateError(checkoutData.error ?? "Failed to start checkout");
        return;
      }

      // Set guest cookie before redirecting
      if (!userId && guestEmail.trim()) {
        document.cookie = `videoStudio_guest=${encodeURIComponent(JSON.stringify({ email: guestEmail.trim(), videoId: id }))}; max-age=604800; path=/`;
      }

      window.location.href = checkoutData.url;

    } catch (err) {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Filtered styles ────────────────────────────────────────────────────────────
  const filteredStyles = activeCat === "ALL" ? styles : styles.filter(s => s.category === activeCat);
  const selectedStyleObj = styles.find(s => s.name === selectedStyle);

  const price = getPrice(mode, videoLength, userTier);

  // ─── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: "#0A0A0A", borderColor: "#1E1E1E" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
              <Film size={16} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Music Video Studio</p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: "#888" }}>by IndieThis</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "#2A2A2A" }}>
            {(["QUICK", "DIRECTOR"] as WizardMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: mode === m ? (m === "QUICK" ? "#D4A843" : "#1E1E1E") : "transparent",
                  color:           mode === m ? (m === "QUICK" ? "#0A0A0A" : "#D4A843") : "#888",
                }}
              >
                {m === "QUICK" ? <Zap size={11} /> : <Clapperboard size={11} />}
                {m === "QUICK" ? "Quick Mode" : "Director Mode"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────────────── */}
      <div className="h-0.5 w-full" style={{ backgroundColor: "#1E1E1E" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${(step / 3) * 100}%`, backgroundColor: "#D4A843" }}
        />
      </div>

      {/* ── Director Mode notice ─────────────────────────────────────────────────── */}
      {mode === "DIRECTOR" && (
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="rounded-xl border px-4 py-3 flex items-start gap-3" style={{ borderColor: "#2A2A2A", backgroundColor: "rgba(212,168,67,0.06)" }}>
            <Clapperboard size={16} style={{ color: "#D4A843", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>Director Mode</p>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                After uploading your track, our AI director will collaborate with you to craft a custom vision — creative brief, shot list, scene-by-scene direction. The most cinematic result possible.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1 — Upload / Select Track
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Your track</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Upload an audio file or pick a saved track from your library.
              </p>
            </div>

            {/* Upload zone */}
            <div className="space-y-4">
              {audioUrl ? (
                <div className="rounded-2xl border px-5 py-4 flex items-center gap-4" style={{ borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.06)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.2)" }}>
                    <Music2 size={18} style={{ color: "#D4A843" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={trackTitle}
                      onChange={e => setTrackTitle(e.target.value)}
                      placeholder="Track title…"
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none border-b pb-0.5"
                      style={{ borderColor: "rgba(212,168,67,0.3)" }}
                    />
                    <p className="text-xs mt-1" style={{ color: "#888" }}>
                      {Math.floor(trackDuration / 60)}:{String(trackDuration % 60).padStart(2, "0")} · Ready to go
                    </p>
                  </div>
                  <button onClick={() => { setAudioUrl(""); setTrackTitle(""); setSelectedTrackId(null); }}>
                    <X size={16} style={{ color: "#888" }} />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 cursor-pointer transition-colors"
                  style={{ borderColor: (audioUploading || dragOver) ? "#D4A843" : "#2A2A2A", backgroundColor: dragOver ? "rgba(212,168,67,0.04)" : undefined }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("audio/")) handleAudioFile(f); }}
                >
                  {audioUploading ? (
                    <>
                      <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
                      <p className="text-sm font-medium" style={{ color: "#D4A843" }}>Uploading…</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#1A1A1A" }}>
                        <Upload size={20} style={{ color: "#D4A843" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">Drop your track here</p>
                        <p className="text-xs mt-1" style={{ color: "#888" }}>MP3, WAV, FLAC, AAC — up to 50MB</p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    disabled={audioUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = ""; }}
                  />
                </label>
              )}

              {uploadError && (
                <p className="text-xs flex items-center gap-1.5 text-red-400">
                  <AlertCircle size={12} /> {uploadError}
                </p>
              )}
            </div>

            {/* Saved tracks (subscribers only) */}
            {userId && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                  Or pick from your library
                </p>
                {tracksLoading ? (
                  <div className="flex items-center gap-2 py-4" style={{ color: "#666" }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-sm">Loading your tracks…</span>
                  </div>
                ) : userTracks.length === 0 ? (
                  <p className="text-sm" style={{ color: "#666" }}>No tracks uploaded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {userTracks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => selectTrack(t)}
                        className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                        style={{
                          borderColor:     selectedTrackId === t.id ? "#D4A843" : "#2A2A2A",
                          backgroundColor: selectedTrackId === t.id ? "rgba(212,168,67,0.08)" : "transparent",
                        }}
                      >
                        {t.coverArtUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.coverArtUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: "#1A1A1A" }}>
                            <Music2 size={14} style={{ color: "#666" }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{t.title}</p>
                          {t.audioFeatures?.duration != null && (
                            <p className="text-xs" style={{ color: "#666" }}>
                              {Math.floor(t.audioFeatures.duration / 60)}:{String(t.audioFeatures.duration % 60).padStart(2, "0")}
                            </p>
                          )}
                        </div>
                        {selectedTrackId === t.id && <Check size={14} style={{ color: "#D4A843", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Track title (for uploaded file without track ID) */}
            {audioUrl && !selectedTrackId && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                  Track Title
                </label>
                <input
                  value={trackTitle}
                  onChange={e => setTrackTitle(e.target.value)}
                  placeholder="e.g. Midnight Drive"
                  className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none focus:ring-1"
                  style={{ borderColor: "#2A2A2A", focusRingColor: "#D4A843" } as React.CSSProperties}
                  onFocus={e => e.target.style.borderColor = "#D4A843"}
                  onBlur={e => e.target.style.borderColor = "#2A2A2A"}
                />
              </div>
            )}

            {/* Step 1 CTA */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Choose Style <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2 — Style + Format
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <h1 className="text-2xl font-bold text-white">Visual style</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Hover any card to preview the look. Your whole video will match this style.
              </p>
            </div>

            {/* Reference photo — avatar picker for logged-in users, cover art banner for guests */}
            {userId ? (
              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#1E1E1E", backgroundColor: "#111" }}>
                <p className="text-xs font-semibold text-white">Artist Reference</p>
                <p className="text-[11px]" style={{ color: "#666" }}>
                  Your avatar will be passed to the director as a character reference.
                </p>
                <AvatarPicker
                  compact
                  label="Artist Reference"
                  selectedUrl={avatarRefUrl ?? undefined}
                  onSelect={(p: AvatarSelectPayload) => setAvatarRefUrl(p.url)}
                  onUploadUrl={(url: string) => setAvatarRefUrl(url)}
                />
              </div>
            ) : coverArtRefUrl ? (
              <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#2A2A2A", backgroundColor: "rgba(212,168,67,0.06)" }}>
                <img src={coverArtRefUrl} alt="Cover art" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>Cover art added</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "#888" }}>Your cover art will be passed to the director as a visual reference</p>
                </div>
                <button onClick={() => setCoverArtRefUrl(null)} className="shrink-0" style={{ color: "#666" }}>
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: activeCat === cat ? "#D4A843" : "#1A1A1A",
                    color:           activeCat === cat ? "#0A0A0A" : "#888",
                  }}
                >
                  {cat === "ALL" ? "All" : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Style grid */}
            {stylesLoading ? (
              <div className="flex items-center justify-center py-12" style={{ color: "#666" }}>
                <Loader2 size={20} className="animate-spin mr-2" /> Loading styles…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredStyles.map(s => {
                  const isSelected = selectedStyle === s.name;
                  const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  const imgSrc = `/images/video-styles/${slug}.jpg`;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s.name)}
                      className="relative rounded-xl overflow-hidden transition-all text-left"
                      style={{
                        outline:     isSelected ? "2px solid #D4A843" : "2px solid transparent",
                        aspectRatio: "16/9",
                      }}
                    >
                      {/* Preview image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc}
                        alt={s.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />

                      {/* Dark overlay + name */}
                      <div
                        className="absolute inset-0 flex flex-col justify-between p-2"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.15) 100%)" }}
                      >
                        {isSelected && (
                          <div className="self-end">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
                              <Check size={11} style={{ color: "#0A0A0A" }} />
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>
                            {s.category.charAt(0) + s.category.slice(1).toLowerCase()}
                          </p>
                          <p className="text-xs font-bold text-white leading-tight mt-0.5">{s.name}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Format */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Format</p>
              <div className="grid grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setAspectRatio(f.value)}
                    className="rounded-xl border py-4 flex flex-col items-center gap-1.5 transition-all"
                    style={{
                      borderColor:     aspectRatio === f.value ? "#D4A843" : "#2A2A2A",
                      backgroundColor: aspectRatio === f.value ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    <span className="text-2xl" style={{ color: aspectRatio === f.value ? "#D4A843" : "#666" }}>{f.icon}</span>
                    <p className="text-xs font-bold" style={{ color: aspectRatio === f.value ? "#D4A843" : "#CCC" }}>{f.label}</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Video length */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Video length</p>
              <div className="grid grid-cols-3 gap-3">
                {LENGTH_OPTIONS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setVideoLength(l.value)}
                    className="rounded-xl border px-4 py-4 text-left transition-all"
                    style={{
                      borderColor:     videoLength === l.value ? "#D4A843" : "#2A2A2A",
                      backgroundColor: videoLength === l.value ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    <p className="text-sm font-bold text-white">{l.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#888" }}>{l.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm" style={{ color: "#888" }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedStyle}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Review & Pay <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3 — Confirm + Pay
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Review your order</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Everything looks good? Hit Create Video to start generating.
              </p>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border divide-y divide-[#2A2A2A]" style={{ borderColor: "#2A2A2A" }}>
              {/* Track */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Music2 size={16} style={{ color: "#D4A843" }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Track</p>
                    <p className="text-sm font-bold text-white">{trackTitle}</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "#666" }}>
                  {Math.floor(trackDuration / 60)}:{String(trackDuration % 60).padStart(2, "0")}
                </p>
              </div>

              {/* Style */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Wand2 size={16} style={{ color: "#D4A843" }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Style</p>
                    <p className="text-sm font-bold text-white">{selectedStyle}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1A1A1A", color: "#888" }}>
                  {selectedStyleObj?.category.charAt(0) + (selectedStyleObj?.category.slice(1).toLowerCase() ?? "")}
                </span>
              </div>

              {/* Format + Length */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Film size={16} style={{ color: "#D4A843" }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Output</p>
                    <p className="text-sm font-bold text-white">
                      {FORMAT_OPTIONS.find(f => f.value === aspectRatio)?.label} · {LENGTH_OPTIONS.find(l => l.value === videoLength)?.label}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  {mode === "QUICK" ? <Zap size={16} style={{ color: "#D4A843" }} /> : <Clapperboard size={16} style={{ color: "#D4A843" }} />}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Mode</p>
                    <p className="text-sm font-bold text-white">{mode === "QUICK" ? "Quick Mode" : "Director Mode"}</p>
                  </div>
                </div>
              </div>

              {/* Cover art ref (if pre-seeded) */}
              {coverArtRefUrl && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <img src={coverArtRefUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Cover Art Ref</p>
                    <p className="text-sm font-bold text-white">Included as visual reference</p>
                  </div>
                </div>
              )}

              {/* Price */}
              <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: "rgba(212,168,67,0.04)" }}>
                <p className="text-sm font-semibold text-white">Total</p>
                <p className="text-xl font-black" style={{ color: "#D4A843" }}>{fmtPrice(price)}</p>
              </div>
            </div>

            {/* Guest email */}
            {!userId && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                  Your email address — we'll send your video here
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
                  style={{ borderColor: "#2A2A2A" }}
                  onFocus={e => e.target.style.borderColor = "#D4A843"}
                  onBlur={e => e.target.style.borderColor = "#2A2A2A"}
                />
              </div>
            )}

            {createError && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle size={14} /> {createError}
              </div>
            )}

            {/* CTA */}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm" style={{ color: "#888" }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={handleConfirmPay}
                disabled={creating || (!userId && !guestEmail.trim())}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                {creating
                  ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                  : <><Film size={16} /> Create Video — {fmtPrice(price)}</>
                }
              </button>
            </div>

            {!userId && (
              <p className="text-xs text-center" style={{ color: "#555" }}>
                Already have an account?{" "}
                <a href="/login?callbackUrl=/video-studio" style={{ color: "#D4A843" }}>Sign in</a>
                {" "}to use included credits.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
