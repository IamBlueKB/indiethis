"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Music, Wand2, Loader2, ChevronRight, ChevronLeft,
  Check, Download, Play, Pause, RotateCcw, Info, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "mode" | "upload" | "configure" | "processing" | "compare" | "export";
type Mode       = "MIX_AND_MASTER" | "MASTER_ONLY";
type Tier       = "STANDARD" | "PREMIUM" | "PRO";
type Mood       = "CLEAN" | "WARM" | "PUNCH" | "LOUD";
type VersionName = "Clean" | "Warm" | "Punch" | "Loud";

interface StemFile {
  file:    File;
  url:     string;
  name:    string;
  type?:   string;
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
  finalLufs:         number;
  truePeak:          number;
  dynamicRange:      number;
  loudnessPenalties: { platform: string; penalty: number }[];
}

interface JobResult {
  versions:         MasterVersion[];
  exports:          PlatformExport[];
  reportData:       MasterReport;
  previewUrl:       string;
  selectedVersion:  string | null;
}

const PLATFORMS = [
  { id: "spotify",      label: "Spotify",      lufs: -14 },
  { id: "apple_music",  label: "Apple Music",  lufs: -16 },
  { id: "youtube",      label: "YouTube",      lufs: -14 },
  { id: "tidal",        label: "Tidal",        lufs: -14 },
  { id: "amazon_music", label: "Amazon Music", lufs: -14 },
  { id: "soundcloud",   label: "SoundCloud",   lufs: -14 },
  { id: "wav_master",   label: "WAV Master",   lufs: -14 },
];

const MOOD_OPTIONS: { value: Mood; label: string; description: string }[] = [
  { value: "CLEAN", label: "Clean",  description: "Balanced, reference-quality — sits well on all platforms" },
  { value: "WARM",  label: "Warm",   description: "Vintage character, smoothed highs, rich low-mids" },
  { value: "PUNCH", label: "Punch",  description: "Transient-forward, tight low end, aggressive presence" },
  { value: "LOUD",  label: "Loud",   description: "Maximum competitive loudness — great for trap, EDM, pop" },
];

const VERSION_DESCRIPTIONS: Record<VersionName, string> = {
  Clean: "Balanced, flat reference",
  Warm:  "Smooth, vintage character",
  Punch: "Aggressive, transient-forward",
  Loud:  "Maximum competitive loudness",
};

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "mode",       label: "Mode"      },
  { key: "upload",     label: "Upload"    },
  { key: "configure",  label: "Configure" },
  { key: "processing", label: "Processing"},
  { key: "compare",    label: "Compare"   },
  { key: "export",     label: "Export"    },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                i < idx  ? "text-[#0A0A0A]" : i === idx ? "text-[#0A0A0A]" : "text-[#555] border border-[#333]"
              )}
              style={i <= idx ? { backgroundColor: "#D4A843" } : {}}
            >
              {i < idx ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn("text-[10px] font-medium", i === idx ? "text-[#D4A843]" : "text-[#555]")}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="w-10 h-px mb-5 mx-1 transition-colors"
              style={{ backgroundColor: i < idx ? "#D4A843" : "#2A2A2A" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export function MasterWizardClient({ userId }: { userId: string }) {
  const router = useRouter();

  const [step,       setStep]       = useState<WizardStep>("mode");
  const [mode,       setMode]       = useState<Mode>("MASTER_ONLY");
  const [tier,       setTier]       = useState<Tier>("STANDARD");
  const [mood,       setMood]       = useState<Mood>("CLEAN");
  const [genre,      setGenre]      = useState<string>("");
  const [platforms,  setPlatforms]  = useState<string[]>(["spotify", "apple_music", "youtube", "wav_master"]);
  const [nlPrompt,   setNlPrompt]   = useState("");
  const [referenceFile, setRefFile] = useState<File | null>(null);

  const [stereoFile, setStereoFile] = useState<File | null>(null);
  const [stems,      setStems]      = useState<StemFile[]>([]);

  const [jobId,      setJobId]      = useState<string | null>(null);
  const [jobStatus,  setJobStatus]  = useState<string>("PENDING");
  const [result,     setResult]     = useState<JobResult | null>(null);
  const [selected,   setSelected]   = useState<VersionName | null>(null);
  const [playing,    setPlaying]    = useState<VersionName | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [revNote,    setRevNote]    = useState("");
  const [revSubmitting, setRevSubmitting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Status polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || jobStatus === "COMPLETE" || jobStatus === "FAILED") return;

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mastering/job/${jobId}/status`);
        const data = await res.json() as {
          status:          string;
          versions?:       MasterVersion[];
          exports?:        PlatformExport[];
          reportData?:     MasterReport;
          previewUrl?:     string;
          selectedVersion?: string | null;
        };

        setJobStatus(data.status);

        if (data.status === "COMPLETE") {
          setResult({
            versions:        data.versions ?? [],
            exports:         data.exports  ?? [],
            reportData:      data.reportData!,
            previewUrl:      data.previewUrl ?? "",
            selectedVersion: data.selectedVersion ?? null,
          });
          setStep("compare");
          clearInterval(pollRef.current!);
        } else if (data.status === "FAILED") {
          setError("Processing failed. Please try again.");
          clearInterval(pollRef.current!);
        }
      } catch {
        // Non-fatal poll error, will retry
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, jobStatus]);

  // ── Upload helper (uploads to S3 via presigned URL) ─────────────────────────
  async function uploadFile(file: File): Promise<string> {
    const presignRes = await fetch("/api/upload/presign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filename: file.name, contentType: file.type, folder: "mastering" }),
    });
    const { uploadUrl, fileUrl } = await presignRes.json() as { uploadUrl: string; fileUrl: string };

    await fetch(uploadUrl, {
      method:  "PUT",
      body:    file,
      headers: { "Content-Type": file.type },
    });

    return fileUrl;
  }

  // ── Checkout + job creation ──────────────────────────────────────────────────
  async function startProcessing() {
    setUploading(true);
    setError(null);

    try {
      // 1. Upload files
      let inputFileUrl: string | undefined;
      let uploadedStems: { url: string; filename: string }[] | undefined;

      if (mode === "MASTER_ONLY" && stereoFile) {
        inputFileUrl = await uploadFile(stereoFile);
      } else if (mode === "MIX_AND_MASTER") {
        uploadedStems = await Promise.all(
          stems.map(async (s) => ({ url: await uploadFile(s.file), filename: s.name }))
        );
      }

      let referenceUrl: string | undefined;
      if (referenceFile) referenceUrl = await uploadFile(referenceFile);

      // 2. Create Stripe PaymentIntent
      const checkoutRes = await fetch("/api/mastering/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode, tier }),
      });
      const { clientSecret, paymentIntentId, amountCents } = await checkoutRes.json() as {
        clientSecret:    string;
        paymentIntentId: string;
        amountCents:     number;
      };

      // 3. Confirm payment with Stripe.js
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripeJs = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripeJs) throw new Error("Stripe failed to load.");

      const { error: stripeError, paymentIntent } = await stripeJs.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment was not confirmed.");

      // 4. Create mastering job
      const jobRes = await fetch("/api/mastering/job", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode,
          tier,
          inputType:             mode === "MASTER_ONLY" ? "STEREO" : "STEMS",
          inputFileUrl,
          stems:                 uploadedStems,
          genre:                 genre || undefined,
          mood,
          platforms,
          referenceTrackUrl:     referenceUrl,
          naturalLanguagePrompt: nlPrompt.trim() || undefined,
          stripePaymentId:       paymentIntent!.id,
        }),
      });

      const { jobId: newJobId } = await jobRes.json() as { jobId: string };
      setJobId(newJobId);
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
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ version: name }),
    });
  }

  // ── Audio playback ───────────────────────────────────────────────────────────
  function togglePlay(version: MasterVersion) {
    if (playing === version.name) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(version.url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlaying(null);
      setPlaying(version.name);
    }
  }

  // ── Revision ─────────────────────────────────────────────────────────────────
  async function submitRevision() {
    if (!revNote.trim() || !jobId) return;
    setRevSubmitting(true);
    try {
      const res = await fetch(`/api/mastering/job/${jobId}/revision`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note: revNote.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Failed to submit revision.");
      }
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

  // ─────────────────────────────────────────────────────────────────────────────

  const statusLabels: Record<string, string> = {
    PENDING:    "Queued…",
    ANALYZING:  "Analyzing your audio…",
    SEPARATING: "Separating stems…",
    MIXING:     "Applying processing chain…",
    MASTERING:  "Mastering — generating 4 versions…",
    COMPLETE:   "Done!",
    FAILED:     "Failed",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

        <StepIndicator current={step} />

        {/* ── STEP: Mode ─────────────────────────────────────────────────── */}
        {step === "mode" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-center mb-6">What are you starting with?</h2>

            {[
              {
                value:       "MASTER_ONLY" as Mode,
                label:       "Master a Stereo Mix",
                description: "Upload a finished WAV or MP3. We'll separate, analyze, and master it in 4 versions.",
                icon:        <Music size={22} style={{ color: "#D4A843" }} />,
              },
              {
                value:       "MIX_AND_MASTER" as Mode,
                label:       "Mix + Master from Stems",
                description: "Upload 2–16 individual stems. We'll classify, mix, and master them with AI precision.",
                icon:        <Wand2 size={22} style={{ color: "#D4A843" }} />,
              },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={cn(
                  "w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all",
                  mode === opt.value ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]"
                )}
              >
                <div className="mt-0.5 shrink-0">{opt.icon}</div>
                <div>
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs mt-1" style={{ color: "#777" }}>{opt.description}</div>
                </div>
                {mode === opt.value && (
                  <Check size={16} className="ml-auto shrink-0 mt-1" style={{ color: "#D4A843" }} />
                )}
              </button>
            ))}

            {/* Tier selector */}
            <div className="mt-6">
              <p className="text-xs font-medium mb-3" style={{ color: "#777" }}>Choose your tier</p>
              <div className="grid grid-cols-3 gap-3">
                {(["STANDARD", "PREMIUM", "PRO"] as Tier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all",
                      tier === t ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]"
                    )}
                  >
                    <div className="text-xs font-bold">{t}</div>
                    {t === "STANDARD" && <div className="text-[10px] mt-1" style={{ color: "#777" }}>Mastering + 1 export</div>}
                    {t === "PREMIUM"  && <div className="text-[10px] mt-1" style={{ color: "#777" }}>+ Reference + all exports</div>}
                    {t === "PRO"      && <div className="text-[10px] mt-1" style={{ color: "#777" }}>+ Revision round</div>}
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

        {/* ── STEP: Upload ────────────────────────────────────────────────── */}
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
                <StereoDropzone file={referenceFile} onFile={setRefFile} label="Drop a reference track" />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("mode")}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors"
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

        {/* ── STEP: Configure ─────────────────────────────────────────────── */}
        {step === "configure" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-center">Configure your master</h2>

            {/* Mood */}
            <div>
              <p className="text-xs font-medium mb-3" style={{ color: "#777" }}>Target sound</p>
              <div className="grid grid-cols-2 gap-3">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      mood === m.value ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]"
                    )}
                  >
                    <div className="text-sm font-bold">{m.label}</div>
                    <div className="text-[11px] mt-1 leading-snug" style={{ color: "#777" }}>{m.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Natural language prompt — THE key differentiator */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>
                Direct the mix <span style={{ color: "#555" }}>(optional)</span>
              </p>
              <div
                className="rounded-xl border p-0.5 focus-within:border-[#D4A843] transition-colors"
                style={{ borderColor: "#2A2A2A" }}
              >
                <div className="flex items-start gap-2 px-3 pt-3 pb-1">
                  <Zap size={14} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                  <textarea
                    placeholder="e.g. More reverb on the chorus vocal. Make the bass punchier in the verse. Wide stereo on the pad…"
                    value={nlPrompt}
                    onChange={(e) => setNlPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                  />
                </div>
                <div className="px-3 pb-2 text-[10px]" style={{ color: "#555" }}>
                  Natural language direction — be as specific as you want
                </div>
              </div>
            </div>

            {/* Platform targets */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Export platforms</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS
                  .filter((p) => tier !== "STANDARD" || p.id === "spotify" || p.id === "wav_master")
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPlatforms((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        platforms.includes(p.id)
                          ? "border-[#D4A843] bg-[#D4A843]/10 text-[#D4A843]"
                          : "border-[#2A2A2A] text-[#777] hover:border-[#444]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-xl px-3 py-2.5 bg-red-400/10 border border-red-400/20 text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                onClick={startProcessing}
                disabled={uploading}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                {uploading ? (
                  <><Loader2 size={16} className="animate-spin" /> Uploading &amp; paying…</>
                ) : (
                  <>Pay &amp; Start Mastering <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Processing ────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="text-center py-16 space-y-6">
            <div className="flex justify-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#1A1A1A", border: "2px solid #D4A843" }}
              >
                <Loader2 size={36} className="animate-spin" style={{ color: "#D4A843" }} />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold">{statusLabels[jobStatus] ?? "Processing…"}</p>
              <p className="text-sm mt-2" style={{ color: "#777" }}>
                This typically takes 3–8 minutes. We'll email you when it's ready.
              </p>
            </div>
            <ProcessingSteps status={jobStatus} />
          </div>
        )}

        {/* ── STEP: Compare ───────────────────────────────────────────────── */}
        {step === "compare" && result && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Compare your versions</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                AI recommends: <span style={{ color: "#D4A843" }}>{result.versions[0]?.name}</span>
              </p>
            </div>

            <div className="space-y-3">
              {result.versions.map((v) => (
                <div
                  key={v.name}
                  className={cn(
                    "rounded-2xl border p-4 transition-all cursor-pointer",
                    selected === v.name ? "border-[#D4A843] bg-[#D4A843]/8" : "border-[#2A2A2A] hover:border-[#444]"
                  )}
                  onClick={() => selectVersion(v.name)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlay(v); }}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                      style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
                    >
                      {playing === v.name
                        ? <Pause size={14} style={{ color: "#D4A843" }} />
                        : <Play  size={14} style={{ color: "#D4A843" }} />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{v.name}</span>
                        {v.name === result.versions[0]?.name && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                          >
                            AI recommends
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                        {VERSION_DESCRIPTIONS[v.name]} · {v.lufs.toFixed(1)} LUFS · {v.truePeak.toFixed(1)} dBTP
                      </div>
                      {/* Mini waveform bar */}
                      <div className="mt-2 flex items-center gap-px h-6">
                        {v.waveformData.slice(0, 80).map((val, i) => (
                          <div
                            key={i}
                            className="w-px rounded-sm flex-1"
                            style={{
                              height:          `${Math.max(10, val * 100)}%`,
                              backgroundColor: selected === v.name ? "#D4A843" : "#333",
                              opacity:         playing === v.name ? 1 : 0.7,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {selected === v.name && (
                      <Check size={16} className="shrink-0" style={{ color: "#D4A843" }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mastering report */}
            {result.reportData && (
              <MasteringReport report={result.reportData} />
            )}

            {/* Pro revision */}
            {tier === "PRO" && !result.selectedVersion && (
              <div className="rounded-xl border border-[#2A2A2A] p-4">
                <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>
                  <RotateCcw size={12} className="inline mr-1" />
                  Request a revision <span style={{ color: "#555" }}>(1 included with Pro)</span>
                </p>
                <textarea
                  placeholder="Tell us what to change: more warmth in the low-mids, tighter kick…"
                  value={revNote}
                  onChange={(e) => setRevNote(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444] border border-[#2A2A2A] rounded-lg px-3 py-2"
                />
                <button
                  onClick={submitRevision}
                  disabled={!revNote.trim() || revSubmitting}
                  className="mt-2 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {revSubmitting ? <Loader2 size={12} className="animate-spin inline" /> : "Submit Revision"}
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

        {/* ── STEP: Export ────────────────────────────────────────────────── */}
        {step === "export" && result && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Download your files</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                Selected version: <span style={{ color: "#D4A843" }}>{selected}</span>
              </p>
            </div>

            <div className="space-y-3">
              {result.exports.map((ex) => {
                const platform = PLATFORMS.find((p) => p.id === ex.platform);
                return (
                  <div
                    key={ex.platform}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#2A2A2A]"
                  >
                    <div>
                      <div className="text-sm font-semibold">{platform?.label ?? ex.platform}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#777" }}>
                        {ex.format} · {ex.lufs.toFixed(1)} LUFS
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

            <button
              onClick={() => router.push("/dashboard/ai/master")}
              className="w-full py-3 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors"
            >
              Master another track
            </button>
          </div>
        )}

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
        dragging ? "border-[#D4A843] bg-[#D4A843]/5" : "border-[#2A2A2A] hover:border-[#444]"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".wav,.aiff,.aif,.flac,.mp3"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Upload size={24} className="mx-auto mb-3" style={{ color: file ? "#D4A843" : "#555" }} />
      {file ? (
        <p className="text-sm font-medium" style={{ color: "#D4A843" }}>{file.name}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs mt-1" style={{ color: "#555" }}>WAV · AIFF · FLAC · MP3 · Max 500 MB</p>
        </>
      )}
    </div>
  );
}

function StemsDropzone({
  stems, onStems,
}: { stems: StemFile[]; onStems: (s: StemFile[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const STEM_COLORS: Record<string, string> = {
    vocals: "#ff6b6b", bass: "#4ecdc4", drums: "#ffe66d", guitar: "#a29bfe",
    keys: "#fd79a8", fx: "#55efc4", pad: "#74b9ff", other: "#fdcb6e",
  };

  function guessType(name: string): string {
    const n = name.toLowerCase();
    if (/vocal|vox|voice|adlib/.test(n))   return "vocals";
    if (/bass|808|sub/.test(n))             return "bass";
    if (/drum|kick|snare|hat|perc/.test(n)) return "drums";
    if (/guitar|gtr/.test(n))              return "guitar";
    if (/key|piano|synth|chord|arp/.test(n)) return "keys";
    if (/fx|effect|riser|sweep/.test(n))   return "fx";
    if (/pad|atmo|ambient/.test(n))        return "pad";
    return "other";
  }

  function addFiles(files: FileList) {
    const newStems: StemFile[] = Array.from(files).map((f) => ({
      file: f, url: URL.createObjectURL(f), name: f.name, type: guessType(f.name),
    }));
    onStems([...stems, ...newStems].slice(0, 16));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
          dragging ? "border-[#D4A843] bg-[#D4A843]/5" : "border-[#2A2A2A] hover:border-[#444]"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.aiff,.aif,.flac,.mp3"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
        />
        <Upload size={24} className="mx-auto mb-3" style={{ color: stems.length ? "#D4A843" : "#555" }} />
        <p className="text-sm font-medium">Drop stems here or click to browse</p>
        <p className="text-xs mt-1" style={{ color: "#555" }}>2–16 stems · WAV · AIFF · FLAC · Max 500 MB each</p>
      </div>

      {stems.length > 0 && (
        <div className="space-y-2">
          {stems.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2A2A]"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: STEM_COLORS[s.type ?? "other"] }}
              />
              <span className="text-xs flex-1 truncate">{s.name}</span>
              <span className="text-[10px] font-medium" style={{ color: STEM_COLORS[s.type ?? "other"] }}>
                {s.type}
              </span>
              <button
                onClick={() => onStems(stems.filter((_, j) => j !== i))}
                className="text-[#555] hover:text-red-400 transition-colors text-xs"
              >
                ×
              </button>
            </div>
          ))}
          <p className="text-[10px]" style={{ color: "#555" }}>
            {stems.length}/16 stems · Types auto-detected from filename
          </p>
        </div>
      )}
    </div>
  );
}

function ProcessingSteps({ status }: { status: string }) {
  const steps = [
    { key: "ANALYZING",  label: "Audio analysis" },
    { key: "SEPARATING", label: "Stem separation" },
    { key: "MIXING",     label: "Processing chain" },
    { key: "MASTERING",  label: "Mastering · 4 versions" },
  ];
  const ORDER = ["PENDING", "ANALYZING", "SEPARATING", "MIXING", "MASTERING", "COMPLETE"];
  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="space-y-2 text-left max-w-xs mx-auto">
      {steps.map((s, i) => {
        const stepIdx = ORDER.indexOf(s.key);
        const done    = currentIdx > stepIdx;
        const active  = currentIdx === stepIdx;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold")}
              style={{
                backgroundColor: done ? "#D4A843" : active ? "#1A1A1A" : "#111",
                border: active ? "2px solid #D4A843" : done ? "none" : "1px solid #2A2A2A",
                color: done ? "#0A0A0A" : "#777",
              }}
            >
              {done ? <Check size={11} /> : i + 1}
            </div>
            <span
              className="text-xs"
              style={{ color: active ? "#fff" : done ? "#D4A843" : "#555" }}
            >
              {s.label}
              {active && <span className="ml-1 animate-pulse">…</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
      {report.loudnessPenalties.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium" style={{ color: "#777" }}>Platform loudness normalization</p>
          {report.loudnessPenalties.map((p) => (
            <div key={p.platform} className="flex justify-between text-[11px]">
              <span style={{ color: "#777" }}>{p.platform}</span>
              <span style={{ color: p.penalty > 3 ? "#ff6b6b" : "#777" }}>
                {p.penalty > 0 ? `-${p.penalty.toFixed(1)} dB` : "No reduction"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
