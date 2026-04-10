"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, SlidersHorizontal, Activity, Loader2, ChevronRight, ChevronLeft,
  Check, Download, Play, Pause, RotateCcw, Info, Zap, Sun, Volume2,
  CheckCircle2, AlertTriangle, Sparkles, ChevronDown, X, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AlbumWizardClient } from "./AlbumWizardClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "mode" | "upload" | "configure" | "processing" | "compare" | "export" | "album";
type Mode       = "MIX_AND_MASTER" | "MASTER_ONLY";
type Tier       = "STANDARD" | "PREMIUM" | "PRO";
type Mood       = "CLEAN" | "WARM" | "PUNCH" | "LOUD";
type VersionName = "Clean" | "Warm" | "Punch" | "Loud";
type StemType   = "vocals" | "bass" | "drums" | "guitar" | "keys" | "fx" | "pad" | "other";

interface StemFile {
  file:  File;
  url:   string;
  name:  string;
  type:  StemType;
}

interface MasterVersion {
  name:         VersionName;
  lufs:         number;
  truePeak:     number;
  url:          string;
  waveformData: number[];
}

interface PlatformExport {
  platform: string;
  lufs:     number;
  format:   string;
  url:      string;
}

interface MasterReport {
  finalLufs:          number;
  truePeak:           number;
  dynamicRange:       number;
  monoCompatible:     boolean;
  loudnessPenalties:  { platform: string; penalty: number }[];
}

interface JobResult {
  versions:        MasterVersion[];
  exports:         PlatformExport[];
  reportData:      MasterReport;
  previewUrl:      string;
  selectedVersion: string | null;
  analysisData?:   { bpm?: number; key?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEM_COLORS: Record<StemType, string> = {
  vocals: "#ff6b6b", bass: "#4ecdc4", drums: "#ffe66d", guitar: "#a29bfe",
  keys: "#fd79a8", fx: "#55efc4", pad: "#74b9ff", other: "#fdcb6e",
};
const STEM_TYPES: StemType[] = ["vocals", "bass", "drums", "guitar", "keys", "fx", "pad", "other"];

const PLATFORMS: { id: string; label: string; lufs: number; truePeak: number; format: string }[] = [
  { id: "spotify",      label: "Spotify",        lufs: -14, truePeak: -1.0,  format: "WAV 24-bit 44.1kHz" },
  { id: "apple_music",  label: "Apple Music",    lufs: -16, truePeak: -1.0,  format: "WAV 24-bit 44.1kHz" },
  { id: "youtube",      label: "YouTube",        lufs: -13, truePeak: -1.0,  format: "WAV 24-bit 48kHz" },
  { id: "tiktok",       label: "TikTok / Reels", lufs: -14, truePeak: -1.0,  format: "MP3 320kbps" },
  { id: "soundcloud",   label: "SoundCloud",     lufs: -14, truePeak: -1.0,  format: "WAV 24-bit 44.1kHz" },
  { id: "club_dj",      label: "Club / DJ",      lufs: -6,  truePeak: -0.3,  format: "WAV 24-bit 44.1kHz" },
  { id: "cd",           label: "CD",             lufs: -9,  truePeak: -0.3,  format: "WAV 16-bit 44.1kHz" },
  { id: "tidal",        label: "Tidal HiFi",     lufs: -14, truePeak: -1.0,  format: "FLAC 24-bit 44.1kHz" },
  { id: "amazon_music", label: "Amazon Music HD", lufs: -14, truePeak: -1.0, format: "FLAC 24-bit 48kHz" },
  { id: "bandcamp",     label: "Bandcamp",       lufs: -14, truePeak: -1.0,  format: "WAV 24-bit 44.1kHz" },
  { id: "wav_master",   label: "WAV Master",     lufs: -14, truePeak: -0.3,  format: "WAV 24-bit 44.1kHz" },
];

const MOODS: { value: Mood; label: string; sub: string; description: string; Icon: React.ElementType }[] = [
  { value: "CLEAN", label: "Clean & Dynamic",  sub: "Waveform",  description: "Preserves dynamics. Acoustic, jazz, singer-songwriter.", Icon: Activity },
  { value: "WARM",  label: "Warm & Full",      sub: "Sun",       description: "Rich low-mids, smooth highs. R&B, soul, indie.",        Icon: Sun      },
  { value: "PUNCH", label: "Punchy & Tight",   sub: "Bolt",      description: "Controlled bass, crisp presence. Hip-hop, pop, rock.",   Icon: Zap      },
  { value: "LOUD",  label: "Loud & Wide",      sub: "Speaker",   description: "Maximum impact. Trap, EDM, club.",                      Icon: Volume2  },
];

const GENRES = [
  { id: "HIP_HOP",    label: "Hip-Hop",        desc: "Punchy low end, crisp highs" },
  { id: "POP",        label: "Pop",            desc: "Bright, polished, wide" },
  { id: "RNB",        label: "R&B / Soul",     desc: "Warm mids, smooth dynamics" },
  { id: "ELECTRONIC", label: "Electronic",     desc: "Loud, wide, transient-forward" },
  { id: "ROCK",       label: "Rock",           desc: "Punchy, mid-forward, controlled" },
  { id: "ACOUSTIC",   label: "Acoustic / Indie", desc: "Natural dynamics, air and detail" },
];

const VERSION_DESCRIPTIONS: Record<VersionName, string> = {
  Clean: "Balanced, flat reference",
  Warm:  "Smooth, vintage character",
  Punch: "Aggressive, transient-forward",
  Loud:  "Maximum competitive loudness",
};

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "mode",       label: "Mode"       },
  { key: "upload",     label: "Upload"     },
  { key: "configure",  label: "Configure"  },
  { key: "processing", label: "Processing" },
  { key: "compare",    label: "Compare"    },
  { key: "export",     label: "Export"     },
];

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={i <= idx ? { backgroundColor: "#D4A843", color: "#0A0A0A" } : { border: "1px solid #333", color: "#555" }}
            >
              {i < idx ? <Check size={14} /> : i + 1}
            </div>
            <span className="text-[10px] font-medium" style={{ color: i === idx ? "#D4A843" : "#555" }}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="w-10 h-px mb-5 mx-1" style={{ backgroundColor: i < idx ? "#D4A843" : "#2A2A2A" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export function MasterWizardClient({ userId }: { userId: string }) {
  const router = useRouter();

  const [step,         setStep]        = useState<WizardStep>("mode");
  const [mode,         setMode]        = useState<Mode>("MIX_AND_MASTER");
  const [tier,         setTier]        = useState<Tier>("STANDARD");
  const [mood,         setMood]        = useState<Mood>("PUNCH");
  const [genre,        setGenre]       = useState<string>("");
  const [platforms,    setPlatforms]   = useState<string[]>(["spotify", "apple_music", "youtube", "wav_master"]);
  const [nlPrompt,     setNlPrompt]    = useState("");
  const [referenceFile, setRefFile]   = useState<File | null>(null);
  const [stereoFile,   setStereoFile]  = useState<File | null>(null);
  const [stems,        setStems]       = useState<StemFile[]>([]);

  const [jobId,        setJobId]       = useState<string | null>(null);
  const [jobStatus,    setJobStatus]   = useState<string>("PENDING");
  const [result,       setResult]      = useState<JobResult | null>(null);
  const [selected,     setSelected]    = useState<VersionName | null>(null);
  const [abMode,       setAbMode]      = useState<"original" | "mastered">("mastered");
  const [playing,      setPlaying]     = useState(false);
  const [nlChange,     setNlChange]    = useState("");
  const [nlChanging,   setNlChanging]  = useState(false);
  const [previewChangeUrl, setPreviewChangeUrl] = useState<string | null>(null);
  const [error,        setError]       = useState<string | null>(null);
  const [uploading,    setUploading]   = useState(false);
  const [revNote,      setRevNote]     = useState("");
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [setMasterLoading, setSetMasterLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Status polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || jobStatus === "COMPLETE" || jobStatus === "FAILED") return;
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mastering/job/${jobId}/status`);
        const data = await res.json() as {
          status: string; versions?: MasterVersion[]; exports?: PlatformExport[];
          reportData?: MasterReport; previewUrl?: string; selectedVersion?: string | null;
          analysisData?: { bpm?: number; key?: string };
        };
        setJobStatus(data.status);
        if (data.status === "COMPLETE") {
          setResult({
            versions:        data.versions ?? [],
            exports:         data.exports  ?? [],
            reportData:      data.reportData!,
            previewUrl:      data.previewUrl ?? "",
            selectedVersion: data.selectedVersion ?? null,
            analysisData:    data.analysisData,
          });
          setStep("compare");
          clearInterval(pollRef.current!);
        } else if (data.status === "FAILED") {
          setError("Processing failed. Please try again.");
          clearInterval(pollRef.current!);
        }
      } catch { /* non-fatal */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, jobStatus]);

  // ── Cleanup audio on unmount ────────────────────────────────────────────────
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── Upload helper ───────────────────────────────────────────────────────────
  async function uploadFile(file: File): Promise<string> {
    const res = await fetch("/api/upload/presign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filename: file.name, contentType: file.type, folder: "mastering" }),
    });
    const { uploadUrl, fileUrl } = await res.json() as { uploadUrl: string; fileUrl: string };
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    return fileUrl;
  }

  // ── Start processing ────────────────────────────────────────────────────────
  async function startProcessing() {
    setUploading(true);
    setError(null);
    try {
      // Upload files fresh — no pre-payment cache
      let inputFileUrl: string | undefined;
      let uploadedStems: { url: string; filename: string; stemType: string }[] | undefined;

      if (mode === "MASTER_ONLY" && stereoFile) {
        inputFileUrl = await uploadFile(stereoFile);
      } else {
        uploadedStems = await Promise.all(
          stems.map(async (s) => ({ url: await uploadFile(s.file), filename: s.name, stemType: s.type }))
        );
      }
      let referenceUrl: string | undefined;
      if (referenceFile) referenceUrl = await uploadFile(referenceFile);

      const checkoutRes = await fetch("/api/mastering/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, tier }),
      });
      const checkoutData = await checkoutRes.json() as {
        creditsUsed?: boolean;
        clientSecret?: string;
        paymentIntentId?: string;
        amountCents?: number;
      };

      let stripePaymentId: string | undefined;

      if (!checkoutData.creditsUsed) {
        if (!checkoutData.clientSecret) throw new Error("Checkout failed — no payment intent.");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        if (!stripeJs) throw new Error("Stripe failed to load.");

        const { error: stripeErr, paymentIntent } = await stripeJs.confirmPayment({
          clientSecret: checkoutData.clientSecret,
          confirmParams: { return_url: window.location.href },
          redirect: "if_required",
        });
        if (stripeErr) throw new Error(stripeErr.message);
        if (paymentIntent?.status !== "succeeded") throw new Error("Payment was not confirmed.");
        stripePaymentId = paymentIntent.id;
      }

      const jobRes = await fetch("/api/mastering/job", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, tier,
          inputType:             mode === "MASTER_ONLY" ? "STEREO" : "STEMS",
          inputFileUrl,
          stems:                 uploadedStems,
          genre:                 genre || undefined,
          mood,
          platforms,
          referenceTrackUrl:     referenceUrl,
          naturalLanguagePrompt: nlPrompt.trim() || undefined,
          stripePaymentId,
          creditsUsed:           checkoutData.creditsUsed ?? false,
        }),
      });
      const { jobId: newId } = await jobRes.json() as { jobId: string };
      setJobId(newId);
      setJobStatus("PENDING");
      setStep("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  // ── Version select ───────────────────────────────────────────────────────────
  async function selectVersion(name: VersionName) {
    setSelected(name);
    await fetch(`/api/mastering/job/${jobId}/select-version`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: name }),
    });
  }

  // ── Audio playback ───────────────────────────────────────────────────────────
  function getPlaybackUrl(): string | null {
    if (!result) return null;
    if (abMode === "original") return result.previewUrl;
    const v = result.versions.find((v) => v.name === selected) ?? result.versions[0];
    return v?.url ?? null;
  }

  function togglePlayback() {
    const url = getPlaybackUrl();
    if (!url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlaying(false);
      setPlaying(true);
    }
  }

  function switchAbMode(m: "original" | "mastered") {
    audioRef.current?.pause();
    setPlaying(false);
    setAbMode(m);
  }

  // ── NL change (Screen 5) ──────────────────────────────────────────────────
  async function applyNlChange() {
    if (!nlChange.trim() || !jobId) return;
    setNlChanging(true);
    try {
      const res = await fetch(`/api/mastering/job/${jobId}/prompt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nlChange.trim() }),
      });
      if (!res.ok) throw new Error("Failed to apply change.");
      const { previewUrl } = await res.json() as { previewUrl: string };
      setPreviewChangeUrl(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setNlChanging(false);
    }
  }

  // ── Apply change to full mix ──────────────────────────────────────────────
  async function applyToFullMix() {
    if (!jobId) return;
    setNlChanging(true);
    try {
      await fetch(`/api/mastering/job/${jobId}/apply-prompt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nlChange.trim() }),
      });
      setPreviewChangeUrl(null);
      setNlChange("");
      setResult(null);
      setJobStatus("MIXING");
      setStep("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setNlChanging(false);
    }
  }

  // ── Revision ─────────────────────────────────────────────────────────────────
  async function submitRevision() {
    if (!revNote.trim() || !jobId) return;
    setRevSubmitting(true);
    try {
      const res = await fetch(`/api/mastering/job/${jobId}/revision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: revNote.trim() }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed.");
      setJobStatus("MIXING");
      setStep("processing");
      setResult(null);
      setSelected(null);
      setRevNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setRevSubmitting(false);
    }
  }

  // ── Set as release master ─────────────────────────────────────────────────
  async function setReleaseMaster() {
    if (!jobId || !selected) return;
    setSetMasterLoading(true);
    try {
      await fetch(`/api/mastering/job/${jobId}/set-master`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: selected }),
      });
    } catch { /* non-fatal */ }
    setSetMasterLoading(false);
  }

  // ── Download all ─────────────────────────────────────────────────────────────
  function downloadAll() {
    if (!result) return;
    result.exports.forEach((ex, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = ex.url;
        a.download = `${ex.platform}.${ex.format.toLowerCase().includes("flac") ? "flac" : ex.format.toLowerCase().includes("mp3") ? "mp3" : "wav"}`;
        a.click();
      }, i * 300);
    });
  }

  // ── Processing status labels ─────────────────────────────────────────────────
  const statusLabels: Record<string, string> = {
    PENDING:    "Queued…",
    ANALYZING:  "Analyzing your audio…",
    SEPARATING: "Separating stems…",
    MIXING:     "Building the mix…",
    MASTERING:  "Mastering — generating 4 versions…",
    COMPLETE:   "Done!",
    FAILED:     "Processing failed",
  };

  // ─────────────────────────────────────────────────────────────────────────────

  // Album mode — hand off to dedicated wizard
  if (step === "album") {
    return (
      <AlbumWizardClient
        userId={userId}
        onBack={() => setStep("mode")}
      />
    );
  }

  return (
    <div className="space-y-0">
      <StepIndicator current={step} />

      {/* ── SCREEN 1: Mode ───────────────────────────────────────────────── */}
      {step === "mode" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center mb-6">What are you starting with?</h2>

          {/* Mode cards */}
          {[
            {
              value:       "MIX_AND_MASTER" as Mode,
              label:       "Mix & Master",
              sub:         "Upload your stems and we'll mix and master your track",
              detail:      "Upload 2–16 individual stems (vocals, bass, drums, etc.)",
              bestFor:     "Producers with separated tracks",
              Icon:        SlidersHorizontal,
            },
            {
              value:       "MASTER_ONLY" as Mode,
              label:       "Master Only",
              sub:         "Upload your finished mix and we'll master it",
              detail:      "Upload a single stereo mix file",
              bestFor:     "Artists with a finished mix",
              Icon:        Activity,
            },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all",
                mode === opt.value ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]"
              )}
              style={mode === opt.value ? { backgroundColor: "rgba(212,168,67,0.06)" } : {}}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: mode === opt.value ? "rgba(212,168,67,0.15)" : "#1A1A1A" }}
              >
                <opt.Icon size={20} style={{ color: "#D4A843" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "#999" }}>{opt.sub}</div>
                <div className="text-[11px] mt-2" style={{ color: "#666" }}>{opt.detail}</div>
                <div className="text-[11px] mt-1 font-medium" style={{ color: "#555" }}>
                  Best for: {opt.bestFor}
                </div>
              </div>
              {mode === opt.value && <Check size={16} className="shrink-0 mt-1" style={{ color: "#D4A843" }} />}
            </button>
          ))}

          {/* Album mastering option */}
          <button
            onClick={() => setStep("album")}
            className="w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all border-[#2A2A2A] hover:border-[#D4A843]"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#1A1A1A" }}>
              <Archive size={20} style={{ color: "#D4A843" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-bold text-sm">Album Mastering</div>
                <div className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>PRO</div>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#999" }}>Master 2–20 tracks with a consistent album profile</div>
              <div className="text-[11px] mt-2" style={{ color: "#666" }}>
                Shared LUFS target · Matched tonal balance · Download all as 01 - Title.wav…
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: "#555" }} />
          </button>

          {/* Tier */}
          <div className="mt-6">
            <p className="text-xs font-medium mb-3" style={{ color: "#777" }}>Choose your tier</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { t: "STANDARD" as Tier, price: "$7.99",  perks: "Stereo master, all exports" },
                { t: "PREMIUM"  as Tier, price: "$14.99", perks: "All platforms + reference matching" },
                { t: "PRO"      as Tier, price: "$24.99", perks: "Everything + 1 revision round" },
              ]).map(({ t, price, perks }) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all relative",
                    tier === t ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]"
                  )}
                  style={tier === t ? { backgroundColor: "rgba(212,168,67,0.06)" } : {}}
                >
                  {t === "PREMIUM" && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                      POPULAR
                    </div>
                  )}
                  <div className="text-xs font-bold">{t}</div>
                  <div className="text-[13px] font-bold mt-1" style={{ color: "#D4A843" }}>{price}</div>
                  <div className="text-[10px] mt-1 leading-tight" style={{ color: "#666" }}>{perks}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep("upload")}
            className="w-full mt-4 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── SCREEN 2: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-center">
            {mode === "MASTER_ONLY" ? "Upload your stereo mix" : "Upload your stems"}
          </h2>

          {mode === "MASTER_ONLY" ? (
            <StereoDropzone file={stereoFile} onFile={setStereoFile} />
          ) : (
            <StemsDropzone stems={stems} onStems={setStems} />
          )}

          {(tier === "PREMIUM" || tier === "PRO") && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>
                Reference track <span style={{ color: "#555" }}>(optional)</span>
              </p>
              <StereoDropzone file={referenceFile} onFile={setRefFile} label="Drop a reference track to match" />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("mode")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border transition-colors hover:border-[#444]"
              style={{ borderColor: "#2A2A2A" }}
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={() => setStep("configure")}
              disabled={mode === "MASTER_ONLY" ? !stereoFile : stems.length < 2}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── SCREEN 3: Configure ──────────────────────────────────────────── */}
      {step === "configure" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-center">Tell us about your sound</h2>

          {/* Genre */}
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "#777" }}>Genre</p>
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id === genre ? "" : g.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    genre === g.id ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]"
                  )}
                  style={genre === g.id ? { backgroundColor: "rgba(212,168,67,0.06)" } : {}}
                >
                  <div className="text-xs font-bold">{g.label}</div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: "#666" }}>{g.desc}</div>
                </button>
              ))}
            </div>
            {!genre && (
              <p className="text-[11px] mt-2" style={{ color: "#555" }}>
                Leave blank — we'll auto-detect from your audio
              </p>
            )}
          </div>

          {/* Mood */}
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "#777" }}>Target sound</p>
            <div className="grid grid-cols-2 gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={cn(
                    "p-3.5 rounded-xl border text-left transition-all flex items-start gap-3",
                    mood === m.value ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]"
                  )}
                  style={mood === m.value ? { backgroundColor: "rgba(212,168,67,0.06)" } : {}}
                >
                  <m.Icon size={18} className="mt-0.5 shrink-0" style={{ color: mood === m.value ? "#D4A843" : "#555" }} />
                  <div>
                    <div className="text-sm font-bold">{m.label}</div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: "#777" }}>{m.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Export platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatforms((prev) =>
                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                    )}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      platforms.includes(p.id)
                        ? "border-[#D4A843] text-[#D4A843]"
                        : "border-[#2A2A2A] hover:border-[#444]"
                    )}
                    style={platforms.includes(p.id) ? { backgroundColor: "rgba(212,168,67,0.08)" } : { color: "#777" }}
                  >
                    {p.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Natural language direction — Premium/Pro only */}
          {(tier === "PREMIUM" || tier === "PRO") && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>
                Any specific direction? <span style={{ color: "#555" }}>(optional)</span>
              </p>
              <div className="rounded-xl border p-0.5 focus-within:border-[#D4A843] transition-colors" style={{ borderColor: "#2A2A2A" }}>
                <div className="flex items-start gap-2 px-3 pt-3 pb-1">
                  <Zap size={14} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                  <textarea
                    placeholder="Make the vocals bright and forward, keep the bass tight…"
                    value={nlPrompt}
                    onChange={(e) => setNlPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                  />
                </div>
                <div className="px-3 pb-2 text-[10px]" style={{ color: "#555" }}>
                  Claude reads this and adjusts every processing decision accordingly
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm rounded-xl px-3 py-2.5 bg-red-400/10 border border-red-400/20 text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("upload")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border transition-colors hover:border-[#444]"
              style={{ borderColor: "#2A2A2A" }}
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={startProcessing}
              disabled={uploading}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> Uploading &amp; processing…</>
                : <>Pay &amp; Master <ChevronRight size={16} /></>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── SCREEN 4: Processing ─────────────────────────────────────────── */}
      {step === "processing" && (
        <div className="py-12 space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1A1A1A", border: "2px solid #D4A843" }}
              >
                <Loader2 size={36} className="animate-spin" style={{ color: "#D4A843" }} />
              </div>
            </div>
            <p className="text-lg font-semibold">{statusLabels[jobStatus] ?? "Processing…"}</p>
            <p className="text-sm" style={{ color: "#777" }}>
              Usually 3–8 minutes. We'll email you when it's ready.
            </p>
          </div>

          {/* Stem waveform animation */}
          {mode === "MIX_AND_MASTER" && stems.length > 0 && (
            <div className="space-y-3">
              {stems.map((stem, i) => (
                <StemProcessingBar key={i} stem={stem} status={jobStatus} index={i} />
              ))}
            </div>
          )}

          {/* Pipeline steps */}
          <ProcessingSteps status={jobStatus} mode={mode} />
        </div>
      )}

      {/* ── SCREEN 5: Compare & Choose ───────────────────────────────────── */}
      {step === "compare" && result && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Compare &amp; choose your master</h2>
            <p className="text-xs mt-1" style={{ color: "#777" }}>
              AI recommends: <span style={{ color: "#D4A843" }}>{result.versions[0]?.name}</span>
            </p>
          </div>

          {/* A/B toggle + play control */}
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}>
            <button
              onClick={togglePlayback}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
            >
              {playing
                ? <Pause size={16} style={{ color: "#D4A843" }} />
                : <Play  size={16} style={{ color: "#D4A843" }} />
              }
            </button>
            <div className="flex-1">
              <div className="text-xs font-medium mb-1.5" style={{ color: "#777" }}>A/B Compare</div>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "#2A2A2A" }}>
                <button
                  onClick={() => switchAbMode("original")}
                  className="flex-1 py-1.5 text-xs font-semibold transition-all"
                  style={abMode === "original"
                    ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                    : { color: "#555" }
                  }
                >
                  Original
                </button>
                <button
                  onClick={() => switchAbMode("mastered")}
                  className="flex-1 py-1.5 text-xs font-semibold transition-all"
                  style={abMode === "mastered"
                    ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                    : { color: "#555" }
                  }
                >
                  Mastered
                </button>
              </div>
            </div>
          </div>

          {/* Version cards */}
          <div className="space-y-3">
            {result.versions.map((v) => {
              const platformPenalties = result.reportData?.loudnessPenalties ?? [];
              const isRecommended = v.name === result.versions[0]?.name;
              const isSelected = selected === v.name;
              return (
                <div
                  key={v.name}
                  className="rounded-2xl border p-4 transition-all cursor-pointer"
                  style={{
                    borderColor: isSelected ? "#D4A843" : "#2A2A2A",
                    backgroundColor: isSelected ? "rgba(212,168,67,0.06)" : undefined,
                    boxShadow: isSelected ? "0 0 0 1px rgba(212,168,67,0.3)" : undefined,
                  }}
                  onClick={() => { selectVersion(v.name); switchAbMode("mastered"); }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSelected) { selectVersion(v.name); switchAbMode("mastered"); }
                        togglePlayback();
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
                    >
                      {playing && isSelected
                        ? <Pause size={14} style={{ color: "#D4A843" }} />
                        : <Play  size={14} style={{ color: "#D4A843" }} />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{v.name}</span>
                        {isRecommended && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                            <Sparkles size={9} /> AI recommends
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                        {VERSION_DESCRIPTIONS[v.name]} · {v.lufs.toFixed(1)} LUFS · {v.truePeak.toFixed(1)} dBTP
                      </div>
                      {/* Mini waveform */}
                      <div className="mt-2 flex items-center gap-px h-5">
                        {generateWaveformBars(v.name).map((val, i) => (
                          <div key={i} className="w-px rounded-sm flex-1"
                            style={{ height: `${val}%`, backgroundColor: isSelected ? "#D4A843" : "#333" }}
                          />
                        ))}
                      </div>
                      {/* Per-version loudness penalties */}
                      {platformPenalties.length > 0 && (
                        <div className="mt-2 flex gap-3 flex-wrap">
                          {platformPenalties.slice(0, 3).map((p) => (
                            <span key={p.platform} className="text-[10px]" style={{ color: p.penalty > 3 ? "#ff6b6b" : "#555" }}>
                              {p.platform}: {p.penalty > 0 ? `-${p.penalty.toFixed(1)} dB` : "✓"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="shrink-0" style={{ color: "#D4A843" }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spectral comparison */}
          {selected && (
            <SpectralComparison versionName={selected} />
          )}

          {/* Mono compatibility */}
          <MonoCompatibility compatible={result.reportData?.monoCompatible ?? true} />

          {/* Mastering report */}
          {result.reportData && <MasteringReport report={result.reportData} />}

          {/* NL prompt bar (Premium / Pro) */}
          {(tier === "PREMIUM" || tier === "PRO") && (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#2A2A2A" }}>
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: "#D4A843" }} />
                <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Want to change something?</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={nlChange}
                  onChange={(e) => setNlChange(e.target.value)}
                  placeholder="More reverb on the chorus vocal, tighter kick…"
                  className="flex-1 bg-transparent text-sm outline-none border rounded-lg px-3 py-2 placeholder:text-[#444]"
                  style={{ borderColor: "#2A2A2A" }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyNlChange(); }}
                />
                <button
                  onClick={applyNlChange}
                  disabled={!nlChange.trim() || nlChanging}
                  className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {nlChanging ? <Loader2 size={12} className="animate-spin" /> : "Preview"}
                </button>
              </div>
              {previewChangeUrl && (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#1A1A1A" }}>
                  <p className="text-xs flex-1" style={{ color: "#D4A843" }}>30-second preview ready</p>
                  <button
                    onClick={() => { audioRef.current?.pause(); audioRef.current = new Audio(previewChangeUrl); audioRef.current.play(); }}
                    className="text-xs px-2 py-1 rounded border border-[#D4A843] text-[#D4A843]"
                  >
                    <Play size={11} className="inline mr-1" />Play
                  </button>
                  <button
                    onClick={applyToFullMix}
                    className="text-xs px-2 py-1 rounded text-[#0A0A0A] font-bold"
                    style={{ backgroundColor: "#D4A843" }}
                  >
                    Apply to full mix
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pro revision */}
          {tier === "PRO" && !result.selectedVersion && (
            <div className="rounded-xl border border-[#2A2A2A] p-4">
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#777" }}>
                <RotateCcw size={12} /> Request a revision <span style={{ color: "#555" }}>(1 included with Pro)</span>
              </p>
              <textarea
                placeholder="More warmth in the low-mids, tighter kick…"
                value={revNote}
                onChange={(e) => setRevNote(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444] border border-[#2A2A2A] rounded-lg px-3 py-2"
              />
              <button
                onClick={submitRevision}
                disabled={!revNote.trim() || revSubmitting}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {revSubmitting ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} /> Submit Revision</>}
              </button>
            </div>
          )}

          <button
            onClick={() => setStep("export")}
            disabled={!selected}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Download &amp; Export <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── SCREEN 6: Export ─────────────────────────────────────────────── */}
      {step === "export" && result && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Download your files</h2>
            <p className="text-xs mt-1" style={{ color: "#777" }}>
              Selected version: <span style={{ color: "#D4A843" }}>{selected}</span>
            </p>
          </div>

          {/* Format downloads */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A843" }}>Format Downloads</p>
              <a
                href={`/api/mastering/job/${jobId}/download?format=all&version=${selected}`}
                className="text-xs font-semibold hover:opacity-80 transition-opacity flex items-center gap-1"
                style={{ color: "#D4A843" }}
              >
                <Download size={11} /> Download All
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "mp3_320",     label: "MP3 320kbps",         size: "~12 MB",   use: "Streaming & social" },
                { id: "wav_16_44",   label: "WAV 16-bit 44.1kHz",  size: "~50 MB",   use: "CD quality" },
                { id: "wav_24_44",   label: "WAV 24-bit 44.1kHz",  size: "~75 MB",   use: "Studio master" },
                { id: "wav_24_48",   label: "WAV 24-bit 48kHz",    size: "~80 MB",   use: "Video / broadcast" },
                { id: "flac_24_44",  label: "FLAC 24-bit 44.1kHz", size: "~35 MB",   use: "Lossless archive" },
                { id: "aiff_24_44",  label: "AIFF 24-bit 44.1kHz", size: "~75 MB",   use: "Apple / Logic" },
              ].map((fmt) => (
                <div key={fmt.id} className="rounded-xl border border-[#2A2A2A] p-3 flex flex-col gap-2">
                  <div>
                    <div className="text-xs font-bold">{fmt.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{fmt.use} · {fmt.size}</div>
                  </div>
                  <a
                    href={`/api/mastering/job/${jobId}/download?format=${fmt.id}&version=${selected}`}
                    download
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold hover:opacity-90 transition-all"
                    style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A", color: "#D4A843" }}
                  >
                    <Download size={11} /> Download
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Platform-targeted exports */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#777" }}>Platform Exports</p>
            <div className="space-y-2">
              {result.exports.map((ex) => {
                const platform = PLATFORMS.find((p) => p.id === ex.platform);
                return (
                  <div key={ex.platform} className="flex items-center justify-between p-4 rounded-xl border border-[#2A2A2A]">
                    <div>
                      <div className="text-sm font-semibold">{platform?.label ?? ex.platform}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                        {platform?.format ?? ex.format} · {ex.lufs.toFixed(1)} LUFS · {platform?.truePeak.toFixed(1) ?? "−1.0"} dBTP
                      </div>
                    </div>
                    <a
                      href={ex.url}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                    >
                      <Download size={13} /> Download
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download all */}
          <button
            onClick={downloadAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all hover:border-[#D4A843] hover:text-[#D4A843]"
            style={{ borderColor: "#2A2A2A", color: "#999" }}
          >
            <Archive size={16} /> Download All Files
          </button>

          {/* Mastering report */}
          {result.reportData && (
            <div className="rounded-xl border border-[#2A2A2A] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Info size={14} style={{ color: "#D4A843" }} />
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#D4A843" }}>
                  Mastering Report
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Integrated LUFS", value: `${result.reportData.finalLufs.toFixed(1)} dB` },
                  { label: "True Peak",        value: `${result.reportData.truePeak.toFixed(1)} dBTP` },
                  { label: "Dynamic Range",    value: `${result.reportData.dynamicRange.toFixed(1)} dB` },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg p-2.5 text-center" style={{ backgroundColor: "#111" }}>
                    <div className="text-sm font-bold">{m.value}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <MonoCompatibility compatible={result.reportData.monoCompatible ?? true} />
              {result.reportData.loudnessPenalties.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                    Platform loudness normalization
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {result.reportData.loudnessPenalties.map((p) => (
                      <div key={p.platform} className="flex justify-between text-[11px]">
                        <span style={{ color: "#666" }}>{p.platform}</span>
                        <span style={{ color: p.penalty > 3 ? "#ff6b6b" : p.penalty > 0 ? "#ffe66d" : "#4ecdc4" }}>
                          {p.penalty > 0 ? `-${p.penalty.toFixed(1)} dB` : "Within target"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Set as release master */}
          <button
            onClick={setReleaseMaster}
            disabled={setMasterLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-all hover:opacity-90 disabled:opacity-40"
            style={{ borderColor: "#D4A843", color: "#D4A843" }}
          >
            {setMasterLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <><Sparkles size={15} /> Set as Release Master</>
            }
          </button>

          <button
            onClick={() => { setStep("mode"); setStereoFile(null); setStems([]); setResult(null); setSelected(null); setJobId(null); setJobStatus("PENDING"); }}
            className="w-full py-3 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors"
          >
            Master another track
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Waveform bars (procedural per version) ───────────────────────────────────

function generateWaveformBars(version: VersionName): number[] {
  const profiles: Record<VersionName, number[]> = {
    Clean: [20,35,28,45,30,55,40,48,35,60,42,55,38,65,50,58,45,70,52,62,48,72,55,65,50,68,58,62,45,75,52,68,48,72,55,65,50,70,48,62,55,68,50,72,58,65,48,70,52,62],
    Warm:  [30,50,42,60,48,72,55,68,52,78,60,72,55,80,65,75,62,85,68,78,65,88,72,80,68,85,75,78,62,88,68,82,65,85,72,78,68,82,65,78,72,85,68,88,75,82,68,85,72,78],
    Punch: [45,70,55,80,65,90,72,85,68,92,78,88,72,95,82,90,78,98,85,92,80,95,88,92,82,92,88,90,78,98,85,94,80,96,88,92,82,95,80,90,88,94,82,96,90,92,82,95,85,90],
    Loud:  [60,88,72,95,82,100,88,98,85,100,92,98,88,100,95,100,92,100,98,100,95,100,98,100,95,100,98,100,92,100,98,100,95,100,98,100,95,100,95,100,98,100,95,100,98,100,95,100,98,100],
  };
  return profiles[version] ?? profiles.Clean;
}

// ─── Spectral comparison canvas ───────────────────────────────────────────────

function SpectralComparison({ versionName }: { versionName: VersionName }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
    });
    [0.2, 0.4, 0.6, 0.8].forEach((x) => {
      ctx.beginPath(); ctx.moveTo(W * x, 0); ctx.lineTo(W * x, H); ctx.stroke();
    });

    // Frequency labels
    ctx.fillStyle = "#333";
    ctx.font = "10px monospace";
    ["60Hz", "250Hz", "2kHz", "8kHz"].forEach((label, i) => {
      ctx.fillText(label, W * [0.05, 0.25, 0.55, 0.78][i], H - 4);
    });

    // Generate original curve (gray)
    const drawCurve = (color: string, adjustments: Record<number, number>, fill: boolean) => {
      const points: [number, number][] = [];
      for (let i = 0; i <= W; i++) {
        const freq = Math.pow(20000 / 20, i / W) * 20; // log scale 20Hz–20kHz
        let energy = 0.5;
        // Sub
        if (freq < 80) energy = 0.35;
        // Low
        else if (freq < 200) energy = 0.65;
        // Low-mid
        else if (freq < 800) energy = 0.7;
        // Mid
        else if (freq < 3000) energy = 0.6;
        // High-mid
        else if (freq < 8000) energy = 0.5;
        // Air
        else energy = 0.3;

        Object.entries(adjustments).forEach(([f, g]) => {
          const dist = Math.abs(Math.log(freq / Number(f)));
          energy += g * Math.exp(-dist * 2);
        });

        energy = Math.max(0.05, Math.min(0.95, energy));
        points.push([i, H - energy * H * 0.85]);
      }

      ctx.beginPath();
      points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));

      if (fill) {
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, color.replace(")", ", 0.15)").replace("rgb", "rgba"));
        grad.addColorStop(1, color.replace(")", ", 0)").replace("rgb", "rgba"));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    // Version-specific mastering adjustments
    const adjustments: Record<VersionName, Record<number, number>> = {
      Clean: { 80: 0.05, 8000: 0.05 },
      Warm:  { 250: 0.1, 1000: 0.05, 8000: -0.05 },
      Punch: { 80: 0.1, 200: -0.05, 3000: 0.1, 8000: 0.08 },
      Loud:  { 80: 0.15, 250: 0.08, 3000: 0.12, 8000: 0.1 },
    };

    drawCurve("#444", {}, true);
    drawCurve("#D4A843", adjustments[versionName] ?? {}, true);

    // Legend
    ctx.fillStyle = "#444";
    ctx.fillRect(W - 80, 8, 12, 3);
    ctx.fillStyle = "#555";
    ctx.font = "10px sans-serif";
    ctx.fillText("Original", W - 64, 13);

    ctx.fillStyle = "#D4A843";
    ctx.fillRect(W - 80, 22, 12, 3);
    ctx.fillStyle = "#888";
    ctx.fillText("Mastered", W - 64, 27);
  }, [versionName]);

  return (
    <div className="rounded-xl border border-[#2A2A2A] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={13} style={{ color: "#D4A843" }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
          Frequency Response
        </span>
      </div>
      <canvas ref={canvasRef} width={560} height={120} className="w-full rounded-lg" style={{ backgroundColor: "#0D0D0D" }} />
    </div>
  );
}

// ─── Mono compatibility ───────────────────────────────────────────────────────

function MonoCompatibility({ compatible }: { compatible: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: compatible ? "#4ecdc4" : "#ffe66d" }}>
      {compatible
        ? <><CheckCircle2 size={13} /> Mono safe — no phase cancellation detected</>
        : <><AlertTriangle size={13} /> Some phase cancellation below 200 Hz — check on mono speakers</>
      }
    </div>
  );
}

// ─── Stem processing bar (Screen 4 animation) ─────────────────────────────────

function StemProcessingBar({ stem, status, index }: { stem: StemFile; status: string; index: number }) {
  const ORDER = ["PENDING", "ANALYZING", "SEPARATING", "MIXING", "MASTERING", "COMPLETE"];
  const currentIdx = ORDER.indexOf(status);
  const stemIdx = ORDER.indexOf("MIXING");
  const done = currentIdx > stemIdx;
  const active = status === "MIXING";
  const color = STEM_COLORS[stem.type];

  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: "#1A1A1A", backgroundColor: "#0D0D0D" }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium flex-1 truncate">{stem.name}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}22`, color }}>
          {stem.type}
        </span>
        {done && <Check size={11} style={{ color }} />}
      </div>
      <div className="flex items-center gap-px h-6 overflow-hidden rounded">
        {Array.from({ length: 60 }).map((_, i) => {
          const base = 20 + Math.sin((i + index * 7) * 0.4) * 15 + Math.random() * 20;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height:           `${base}%`,
                backgroundColor:  color,
                opacity:          done ? 0.9 : active ? 0.6 + Math.sin(i * 0.3) * 0.3 : 0.2,
                transition:       active ? `height ${0.3 + i * 0.01}s ease` : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Processing steps ─────────────────────────────────────────────────────────

function ProcessingSteps({ status, mode }: { status: string; mode: Mode }) {
  const ORDER = ["PENDING", "ANALYZING", "SEPARATING", "MIXING", "MASTERING", "COMPLETE"];
  const currentIdx = ORDER.indexOf(status);

  const steps = [
    { key: "ANALYZING",  label: "Analyzing your audio" },
    ...(mode === "MASTER_ONLY" ? [{ key: "SEPARATING", label: "Separating stems" }] : []),
    { key: "MIXING",     label: mode === "MIX_AND_MASTER" ? "Building the mix" : "Applying adjustments" },
    { key: "MASTERING",  label: "Mastering — generating 4 versions" },
  ];

  return (
    <div className="space-y-2 max-w-xs mx-auto">
      {steps.map((s, i) => {
        const stepIdx = ORDER.indexOf(s.key);
        const done    = currentIdx > stepIdx;
        const active  = currentIdx === stepIdx;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
              style={{
                backgroundColor: done ? "#D4A843" : active ? "#1A1A1A" : "#111",
                border: active ? "2px solid #D4A843" : done ? "none" : "1px solid #2A2A2A",
                color: done ? "#0A0A0A" : "#777",
              }}
            >
              {done ? <Check size={11} /> : i + 1}
            </div>
            <span className="text-xs" style={{ color: active ? "#fff" : done ? "#D4A843" : "#555" }}>
              {s.label}{active && <span className="ml-1 animate-pulse">…</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stereo dropzone ──────────────────────────────────────────────────────────

function StereoDropzone({
  file, onFile, label = "Drop your WAV, AIFF, FLAC, or MP3",
}: { file: File | null; onFile: (f: File) => void; label?: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
      style={dragging
        ? { borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.05)" }
        : { borderColor: file ? "#D4A843" : "#2A2A2A" }
      }
    >
      <input ref={inputRef} type="file" accept=".wav,.aiff,.aif,.flac,.mp3" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <Upload size={24} className="mx-auto mb-3" style={{ color: file ? "#D4A843" : "#555" }} />
      {file ? (
        <p className="text-sm font-medium" style={{ color: "#D4A843" }}>{file.name}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs mt-1" style={{ color: "#555" }}>WAV · AIFF · FLAC · MP3 · Max 100 MB</p>
        </>
      )}
    </div>
  );
}

// ─── Stems dropzone ───────────────────────────────────────────────────────────

function StemsDropzone({ stems, onStems }: { stems: StemFile[]; onStems: (s: StemFile[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [overrideIdx, setOverrideIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function guessType(name: string): StemType {
    const n = name.toLowerCase();
    if (/vocal|vox|voice|adlib/.test(n))    return "vocals";
    if (/bass|808|sub/.test(n))              return "bass";
    if (/drum|kick|snare|hat|perc/.test(n)) return "drums";
    if (/guitar|gtr/.test(n))               return "guitar";
    if (/key|piano|synth|chord|arp/.test(n)) return "keys";
    if (/fx|effect|riser|sweep/.test(n))    return "fx";
    if (/pad|atmo|ambient/.test(n))         return "pad";
    return "other";
  }

  function addFiles(files: FileList) {
    const newStems: StemFile[] = Array.from(files).map((f) => ({
      file: f, url: URL.createObjectURL(f), name: f.name, type: guessType(f.name),
    }));
    onStems([...stems, ...newStems].slice(0, 16));
  }

  function changeType(i: number, type: StemType) {
    const updated = stems.map((s, j) => j === i ? { ...s, type } : s);
    onStems(updated);
    setOverrideIdx(null);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={dragging
          ? { borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.05)" }
          : { borderColor: stems.length ? "#D4A843" : "#2A2A2A" }
        }
      >
        <input ref={inputRef} type="file" accept=".wav,.aiff,.aif,.flac,.mp3" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
        <Upload size={24} className="mx-auto mb-3" style={{ color: stems.length ? "#D4A843" : "#555" }} />
        <p className="text-sm font-medium">Drop stems here or click to browse</p>
        <p className="text-xs mt-1" style={{ color: "#555" }}>2–16 stems · WAV · AIFF · FLAC · Max 100 MB each</p>
      </div>

      {stems.length > 0 && (
        <div className="space-y-2">
          {stems.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2A2A] relative">
              {/* Stem type badge (tappable) */}
              <button
                onClick={() => setOverrideIdx(overrideIdx === i ? null : i)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold shrink-0 transition-all hover:opacity-80"
                style={{ backgroundColor: `${STEM_COLORS[s.type]}22`, color: STEM_COLORS[s.type] }}
              >
                {s.type}
                <ChevronDown size={9} />
              </button>

              {/* Dropdown */}
              {overrideIdx === i && (
                <div
                  className="absolute left-3 top-10 z-20 rounded-xl border shadow-xl py-1"
                  style={{ backgroundColor: "#141414", borderColor: "#2A2A2A" }}
                >
                  {STEM_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => changeType(i, t)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STEM_COLORS[t] }} />
                      <span style={{ color: s.type === t ? STEM_COLORS[t] : "#ccc" }}>{t}</span>
                      {s.type === t && <Check size={10} className="ml-auto" style={{ color: STEM_COLORS[t] }} />}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-xs flex-1 truncate" style={{ color: "#ccc" }}>{s.name}</span>
              <button
                onClick={() => onStems(stems.filter((_, j) => j !== i))}
                className="text-[#555] hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <p className="text-[11px]" style={{ color: "#555" }}>
            {stems.length}/16 stems · Tap a badge to override stem type
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Mastering report (full) ──────────────────────────────────────────────────

function MasteringReport({ report }: { report: MasterReport }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Info size={14} style={{ color: "#D4A843" }} />
        <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Mastering Report</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Integrated LUFS", value: `${report.finalLufs.toFixed(1)} dB` },
          { label: "True Peak",       value: `${report.truePeak.toFixed(1)} dBTP` },
          { label: "Dynamic Range",   value: `${report.dynamicRange.toFixed(1)} dB` },
        ].map((m) => (
          <div key={m.label} className="rounded-lg p-2.5 text-center" style={{ backgroundColor: "#111" }}>
            <div className="text-sm font-bold">{m.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
