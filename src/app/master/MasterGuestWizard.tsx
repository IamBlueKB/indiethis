"use client";

/**
 * MasterGuestWizard — public wizard for non-subscribers
 *
 * Same flow as the dashboard wizard but:
 * - Captures guest email before processing (cookie + DB)
 * - Redirects subscribers who log in mid-flow
 * - Shows upgrade upsell after job completion
 * - Free 30-second preview before payment prompt
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, Loader2, ChevronRight, ChevronLeft, Check, Download,
  Play, Pause, Zap, Info, RotateCcw, X, Music, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "email" | "mode" | "upload" | "configure" | "preview" | "payment" | "processing" | "compare" | "export";
type Mode = "MIX_AND_MASTER" | "MASTER_ONLY";
type Tier = "STANDARD" | "PREMIUM" | "PRO";
type Mood = "CLEAN" | "WARM" | "PUNCH" | "LOUD";
type VersionName = "Clean" | "Warm" | "Punch" | "Loud";

interface MasterVersion {
  name:         VersionName;
  lufs:         number;
  truePeak:     number;
  url:          string;
  waveformData: number[];
}

interface MasterReport {
  finalLufs:         number;
  truePeak:          number;
  dynamicRange:      number;
  loudnessPenalties: { platform: string; penalty: number }[];
}

interface JobResult {
  versions:        MasterVersion[];
  exports:         { platform: string; lufs: number; format: string; url: string }[];
  reportData:      MasterReport;
  previewUrl:      string;
  selectedVersion: string | null;
}

const TIER_PRICES: Record<Tier, Record<Mode, string>> = {
  STANDARD: { MASTER_ONLY: "$11.99", MIX_AND_MASTER: "$17.99" },
  PREMIUM:  { MASTER_ONLY: "$17.99", MIX_AND_MASTER: "$17.99" },
  PRO:      { MASTER_ONLY: "$27.99", MIX_AND_MASTER: "$27.99" },
};

const MOOD_OPTIONS: { value: Mood; label: string; description: string }[] = [
  { value: "CLEAN", label: "Clean",  description: "Balanced, reference-quality" },
  { value: "WARM",  label: "Warm",   description: "Vintage character, smooth highs" },
  { value: "PUNCH", label: "Punch",  description: "Aggressive, transient-forward" },
  { value: "LOUD",  label: "Loud",   description: "Maximum competitive loudness" },
];

const PLATFORMS = [
  { id: "spotify",     label: "Spotify"     },
  { id: "apple_music", label: "Apple Music" },
  { id: "youtube",     label: "YouTube"     },
  { id: "wav_master",  label: "WAV Master"  },
];

const VERSION_DESCRIPTIONS: Record<VersionName, string> = {
  Clean: "Balanced, flat reference",
  Warm:  "Smooth, vintage character",
  Punch: "Aggressive, transient-forward",
  Loud:  "Maximum competitive loudness",
};

export function MasterGuestWizard({
  initialTier,
  initialMode,
  onBack,
}: {
  initialTier: string;
  initialMode: Mode;
  onBack:      () => void;
}) {
  const [step,       setStep]       = useState<Step>("email");
  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [mode,       setMode]       = useState<Mode>(initialMode);
  const [tier,       setTier]       = useState<Tier>(initialTier as Tier);
  const [mood,       setMood]       = useState<Mood>("CLEAN");
  const [platforms,  setPlatforms]  = useState(["spotify", "apple_music", "youtube", "wav_master"]);
  const [nlPrompt,   setNlPrompt]   = useState("");

  const [stereoFile, setStereoFile] = useState<File | null>(null);
  const [stems,      setStems]      = useState<{ file: File; name: string; type?: string }[]>([]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const [jobId,      setJobId]      = useState<string | null>(null);
  const [jobStatus,  setJobStatus]  = useState("PENDING");
  const [result,     setResult]     = useState<JobResult | null>(null);
  const [selected,   setSelected]   = useState<VersionName | null>(null);
  const [playing,    setPlaying]    = useState<VersionName | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef    = useRef<HTMLInputElement | null>(null);
  const stemsRef    = useRef<HTMLInputElement | null>(null);

  // ── Status polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || jobStatus === "COMPLETE" || jobStatus === "FAILED") return;

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mastering/job/${jobId}/status`);
        const data = await res.json() as {
          status:      string;
          versions?:   MasterVersion[];
          exports?:    { platform: string; lufs: number; format: string; url: string }[];
          reportData?: MasterReport;
          previewUrl?: string;
        };
        setJobStatus(data.status);
        if (data.status === "COMPLETE") {
          setResult({
            versions:        data.versions ?? [],
            exports:         data.exports  ?? [],
            reportData:      data.reportData!,
            previewUrl:      data.previewUrl ?? "",
            selectedVersion: null,
          });
          setStep("compare");
          clearInterval(pollRef.current!);
        } else if (data.status === "FAILED") {
          setError("Processing failed. Please try again.");
          clearInterval(pollRef.current!);
        }
      } catch { /* retry */ }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, jobStatus]);

  // ── Upload helper ─────────────────────────────────────────────────────────
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

  // ── 30-second free preview ─────────────────────────────────────────────────
  async function generateFreePreview() {
    if (!stereoFile && stems.length < 2) return;
    setPreviewing(true);
    setError(null);
    try {
      let inputFileUrl: string | undefined;
      let uploadedStems: { url: string; filename: string }[] | undefined;

      if (mode === "MASTER_ONLY" && stereoFile) {
        inputFileUrl = await uploadFile(stereoFile);
      } else {
        uploadedStems = await Promise.all(
          stems.map(async (s) => ({ url: await uploadFile(s.file), filename: s.name }))
        );
      }

      const res = await fetch("/api/mastering/preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode,
          inputType:   mode === "MASTER_ONLY" ? "STEREO" : "STEMS",
          inputFileUrl,
          stems:       uploadedStems,
          mood,
          guestEmail:  email,
        }),
      });
      const { previewUrl: url } = await res.json() as { previewUrl: string };
      setPreviewUrl(url);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  // ── Full job start (post-payment) ──────────────────────────────────────────
  async function startProcessing(paymentIntentId: string) {
    setError(null);
    setUploading(true);
    try {
      let inputFileUrl: string | undefined;
      let uploadedStems: { url: string; filename: string }[] | undefined;

      if (mode === "MASTER_ONLY" && stereoFile) {
        inputFileUrl = await uploadFile(stereoFile);
      } else {
        uploadedStems = await Promise.all(
          stems.map(async (s) => ({ url: await uploadFile(s.file), filename: s.name }))
        );
      }

      const res = await fetch("/api/mastering/job", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode,
          tier,
          inputType:             mode === "MASTER_ONLY" ? "STEREO" : "STEMS",
          inputFileUrl,
          stems:                 uploadedStems,
          mood,
          platforms:             tier === "STANDARD" ? ["spotify", "wav_master"] : platforms,
          naturalLanguagePrompt: nlPrompt.trim() || undefined,
          stripePaymentId:       paymentIntentId,
          guestEmail:            email,
          guestName:             name || undefined,
        }),
      });
      const { jobId: id } = await res.json() as { jobId: string };

      // Set guest email cookie so status polling works
      document.cookie = `indiethis_guest_email=${encodeURIComponent(email)}; path=/; max-age=604800`;

      setJobId(id);
      setJobStatus("PENDING");
      setStep("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  async function handlePayment() {
    setError(null);
    setUploading(true);
    try {
      const checkoutRes = await fetch("/api/mastering/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode, tier }),
      });
      const { clientSecret } = await checkoutRes.json() as { clientSecret: string };

      const { loadStripe } = await import("@stripe/stripe-js");
      const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripeJs) throw new Error("Stripe unavailable.");

      const { error: stripeErr, paymentIntent } = await stripeJs.confirmPayment({
        clientSecret,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (stripeErr) throw new Error(stripeErr.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment not confirmed.");

      await startProcessing(paymentIntent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
      setUploading(false);
    }
  }

  function guessType(name: string): string {
    const n = name.toLowerCase();
    if (/vocal|vox|voice|adlib/.test(n))    return "vocals";
    if (/bass|808|sub/.test(n))              return "bass";
    if (/drum|kick|snare|hat|perc/.test(n))  return "drums";
    if (/guitar|gtr/.test(n))               return "guitar";
    if (/key|piano|synth|chord|arp/.test(n)) return "keys";
    if (/fx|effect|riser|sweep/.test(n))    return "fx";
    if (/pad|atmo|ambient/.test(n))         return "pad";
    return "other";
  }

  function addStemFiles(files: FileList) {
    const newStems = Array.from(files).map((f) => ({ file: f, name: f.name, type: guessType(f.name) }));
    setStems((prev) => [...prev, ...newStems].slice(0, 16));
  }

  function togglePlay(version: MasterVersion) {
    if (playing === version.name) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      audioRef.current?.pause();
      audioRef.current = new Audio(version.url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlaying(null);
      setPlaying(version.name);
    }
  }

  async function selectVersion(name: VersionName) {
    setSelected(name);
    if (jobId) {
      await fetch(`/api/mastering/job/${jobId}/select-version`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ version: name }),
      });
    }
  }

  const statusLabels: Record<string, string> = {
    PENDING:    "Queued…",
    ANALYZING:  "Analyzing your audio…",
    SEPARATING: "Separating stems…",
    MIXING:     "Applying processing chain…",
    MASTERING:  "Mastering — generating 4 versions…",
  };

  // ─────────────────────────────────────────────────────────────────────────

  const card = "rounded-2xl border border-[#1A1A1A] p-8";

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Back button */}
        {step === "email" && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors mb-8">
            <ChevronLeft size={15} /> Back
          </button>
        )}

        {/* ── STEP: Email gate ──────────────────────────────────────────── */}
        {step === "email" && (
          <div className={card}>
            <h2 className="text-xl font-bold mb-1">Where should we send your master?</h2>
            <p className="text-sm mb-6" style={{ color: "#777" }}>
              We'll email you when your master is ready. No account required.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#D4A843] transition-colors"
              />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#D4A843] transition-colors"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={() => {
                  if (!email.includes("@")) { setError("Please enter a valid email."); return; }
                  setError(null);
                  setStep("mode");
                }}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                Continue <ChevronRight size={16} />
              </button>
              <p className="text-center text-xs" style={{ color: "#555" }}>
                Already have an account?{" "}
                <a href="/login" className="underline hover:text-white transition-colors">Sign in</a>
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Mode ────────────────────────────────────────────────── */}
        {step === "mode" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-6">What are you starting with?</h2>
            {[
              { value: "MASTER_ONLY" as Mode, label: "Master a Stereo Mix", description: "Upload a finished WAV or MP3", icon: <Music size={20} style={{ color: "#D4A843" }} /> },
              { value: "MIX_AND_MASTER" as Mode, label: "Mix + Master from Stems", description: "Upload 2–16 individual stems", icon: <Wand2 size={20} style={{ color: "#D4A843" }} /> },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={cn("w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all", mode === opt.value ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]")}
              >
                {opt.icon}
                <div className="flex-1">
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#777" }}>{opt.description}</div>
                </div>
                {mode === opt.value && <Check size={15} style={{ color: "#D4A843" }} />}
              </button>
            ))}

            {/* Tier */}
            <div className="mt-6">
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Tier</p>
              <div className="grid grid-cols-3 gap-2">
                {(["STANDARD", "PREMIUM", "PRO"] as Tier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={cn("p-3 rounded-xl border text-center transition-all text-xs", tier === t ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]")}
                  >
                    <div className="font-bold">{TIER_PRICES[t][mode]}</div>
                    <div className="mt-0.5" style={{ color: "#777" }}>{t}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep("upload")} className="w-full py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:opacity-90 transition-all" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP: Upload ─────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">
              {mode === "MASTER_ONLY" ? "Upload your stereo mix" : "Upload your stems"}
            </h2>

            {mode === "MASTER_ONLY" ? (
              <div
                onClick={() => inputRef.current?.click()}
                className={cn("rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all", stereoFile ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]")}
              >
                <input ref={inputRef} type="file" accept=".wav,.aiff,.aif,.flac,.mp3" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setStereoFile(f); }} />
                <Upload size={22} className="mx-auto mb-3" style={{ color: stereoFile ? "#D4A843" : "#555" }} />
                {stereoFile ? (
                  <p className="text-sm font-medium" style={{ color: "#D4A843" }}>{stereoFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Drop your WAV, AIFF, FLAC, or MP3</p>
                    <p className="text-xs mt-1" style={{ color: "#555" }}>Max 500 MB</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => stemsRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer border-[#2A2A2A] hover:border-[#444] transition-all"
                >
                  <input ref={stemsRef} type="file" accept=".wav,.aiff,.aif,.flac,.mp3" multiple className="hidden" onChange={(e) => { if (e.target.files) addStemFiles(e.target.files); }} />
                  <Upload size={22} className="mx-auto mb-2" style={{ color: "#555" }} />
                  <p className="text-sm font-medium">Drop stems or click to browse</p>
                  <p className="text-xs mt-1" style={{ color: "#555" }}>2–16 stems · Max 500 MB each</p>
                </div>
                {stems.length > 0 && (
                  <div className="space-y-1.5">
                    {stems.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-[#2A2A2A]">
                        <span className="flex-1 truncate">{s.name}</span>
                        <span style={{ color: "#777" }}>{s.type}</span>
                        <button onClick={() => setStems(stems.filter((_, j) => j !== i))} className="text-[#555] hover:text-red-400"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Direction */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Direction <span style={{ color: "#555" }}>(optional)</span></p>
              <div className="rounded-xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                <div className="flex items-start gap-2 px-3 pt-2.5 pb-1">
                  <Zap size={13} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                  <textarea placeholder="More reverb on the chorus. Punchier kick. Wide stereo on the pad…" value={nlPrompt} onChange={(e) => setNlPrompt(e.target.value)} rows={2} className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]" />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep("mode")} className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={generateFreePreview}
                disabled={previewing || (mode === "MASTER_ONLY" ? !stereoFile : stems.length < 2)}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {previewing ? <><Loader2 size={15} className="animate-spin" /> Generating preview…</> : <><Play size={15} /> Hear free 30s preview</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Preview ────────────────────────────────────────────── */}
        {step === "preview" && previewUrl && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">Your free preview</h2>
              <p className="text-sm mt-1" style={{ color: "#777" }}>30 seconds of your highest-energy section</p>
            </div>

            <div
              className="rounded-2xl border border-[#D4A843]/40 p-6 text-center"
              style={{ backgroundColor: "#111" }}
            >
              <button
                onClick={() => {
                  if (previewPlaying) {
                    audioRef.current?.pause();
                    setPreviewPlaying(false);
                  } else {
                    if (audioRef.current) audioRef.current.pause();
                    audioRef.current = new Audio(previewUrl);
                    audioRef.current.play();
                    audioRef.current.onended = () => setPreviewPlaying(false);
                    setPreviewPlaying(true);
                  }
                }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-all hover:opacity-90"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {previewPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <p className="text-sm font-semibold">
                {previewPlaying ? "Playing preview…" : "Click to play your free preview"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                Like what you hear? Pay to get the full master.
              </p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handlePayment}
              disabled={uploading}
              className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              {uploading ? (
                <><Loader2 size={15} className="animate-spin" /> Processing…</>
              ) : (
                <>Pay {TIER_PRICES[tier][mode]} &amp; get the full master <ChevronRight size={16} /></>
              )}
            </button>
            <button onClick={() => setStep("upload")} className="w-full text-sm text-[#555] hover:text-white transition-colors">
              Change settings
            </button>
          </div>
        )}

        {/* ── STEP: Processing ─────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="text-center py-16 space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "#1A1A1A", border: "2px solid #D4A843" }}>
              <Loader2 size={36} className="animate-spin" style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-lg font-semibold">{statusLabels[jobStatus] ?? "Processing…"}</p>
              <p className="text-sm mt-2" style={{ color: "#777" }}>
                We'll email <span style={{ color: "#D4A843" }}>{email}</span> when it's ready.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Compare ────────────────────────────────────────────── */}
        {step === "compare" && result && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold">Compare your versions</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                AI recommends: <span style={{ color: "#D4A843" }}>{result.versions[0]?.name}</span>
              </p>
            </div>

            {result.versions.map((v) => (
              <div
                key={v.name}
                onClick={() => selectVersion(v.name)}
                className={cn("rounded-2xl border p-4 cursor-pointer transition-all", selected === v.name ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]")}
              >
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); togglePlay(v); }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}>
                    {playing === v.name ? <Pause size={13} style={{ color: "#D4A843" }} /> : <Play size={13} style={{ color: "#D4A843" }} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{v.name}</span>
                      {v.name === result.versions[0]?.name && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>AI recommends</span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                      {VERSION_DESCRIPTIONS[v.name]} · {v.lufs.toFixed(1)} LUFS
                    </div>
                  </div>
                  {selected === v.name && <Check size={15} style={{ color: "#D4A843" }} />}
                </div>
              </div>
            ))}

            {/* Mastering report */}
            {result.reportData && (
              <div className="rounded-xl border border-[#2A2A2A] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={13} style={{ color: "#D4A843" }} />
                  <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Mastering Report</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "LUFS",    value: `${result.reportData.finalLufs.toFixed(1)} dB` },
                    { label: "Peak",    value: `${result.reportData.truePeak.toFixed(1)} dBTP` },
                    { label: "Dynamic", value: `${result.reportData.dynamicRange.toFixed(1)} dB` },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: "#111" }}>
                      <div className="text-sm font-bold">{m.value}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#777" }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setStep("export")} disabled={!selected} className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
              Download files <ChevronRight size={16} />
            </button>

            {/* Upsell */}
            <div className="rounded-xl border border-[#D4A843]/30 p-4 text-center" style={{ backgroundColor: "#D4A843/5" }}>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>Get up to 50% off every master</p>
              <p className="text-xs mt-1 mb-3" style={{ color: "#777" }}>Subscribe to IndieThis and never pay full price again.</p>
              <a href="/pricing" className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                See subscriber pricing <ChevronRight size={12} />
              </a>
            </div>
          </div>
        )}

        {/* ── STEP: Export ─────────────────────────────────────────────── */}
        {step === "export" && result && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold">Download your files</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>Version: <span style={{ color: "#D4A843" }}>{selected}</span></p>
            </div>

            {result.exports.map((ex) => {
              const p = PLATFORMS.find((x) => x.id === ex.platform);
              return (
                <div key={ex.platform} className="flex items-center justify-between p-4 rounded-xl border border-[#2A2A2A]">
                  <div>
                    <div className="text-sm font-semibold">{p?.label ?? ex.platform}</div>
                    <div className="text-[11px]" style={{ color: "#777" }}>{ex.format} · {ex.lufs.toFixed(1)} LUFS</div>
                  </div>
                  <a href={ex.url} download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                    <Download size={12} /> Download
                  </a>
                </div>
              );
            })}

            {/* Post-delivery upsell */}
            <div className="rounded-2xl border border-[#D4A843]/30 p-5 text-center">
              <p className="font-bold mb-1">Like your master?</p>
              <p className="text-sm mb-4" style={{ color: "#777" }}>IndieThis subscribers save up to 50% on every track — plus full studio tools.</p>
              <a href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
                Start your subscription <ChevronRight size={15} />
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
