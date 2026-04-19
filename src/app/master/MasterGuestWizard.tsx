"use client";

/**
 * MasterGuestWizard — public wizard for non-subscribers
 *
 * Same flow as the dashboard wizard but:
 * - Captures guest email before processing (cookie + DB)
 * - Redirects subscribers who log in mid-flow
 * - Shows upgrade upsell after job completion
 * - Pay first, then all 4 mastered versions generated for comparison
 */

import { useState, useRef, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  Upload, Loader2, ChevronRight, ChevronLeft, Check, Download,
  Play, Pause, Zap, Info, X, Music, Wand2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "email" | "mode" | "upload" | "configure" | "payment" | "processing" | "compare" | "export";
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
  STANDARD: { MASTER_ONLY: "$7.99",  MIX_AND_MASTER: "$7.99"  },
  PREMIUM:  { MASTER_ONLY: "$14.99", MIX_AND_MASTER: "$14.99" },
  PRO:      { MASTER_ONLY: "$24.99", MIX_AND_MASTER: "$24.99" },
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
  resumeJobId = null,
  onBack,
}: {
  initialTier:  string;
  initialMode:  Mode;
  resumeJobId?: string | null;
  onBack:       () => void;
}) {
  const { data: session } = useSession();

  const [step,       setStep]       = useState<Step>("email");
  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [mode,       setMode]       = useState<Mode>(initialMode);
  const [tier,       setTier]       = useState<Tier>(initialTier as Tier);
  const [mood,       setMood]       = useState<Mood>("CLEAN");
  const [platforms,  setPlatforms]  = useState(["spotify", "apple_music", "youtube", "wav_master"]);
  const [nlPrompt,   setNlPrompt]   = useState("");

  const [stereoFile,    setStereoFile]    = useState<File | null>(null);
  const [stems,         setStems]         = useState<{ file: File; name: string; type?: string }[]>([]);
  const [uploadedRefUrl, setUploadedRefUrl] = useState<string | null>(null);
  const [refFileName,   setRefFileName]   = useState<string | null>(null);
  const [refUploading,  setRefUploading]  = useState(false);

  const [jobId,      setJobId]      = useState<string | null>(null);
  const [jobStatus,  setJobStatus]  = useState("PENDING");
  const [result,     setResult]     = useState<JobResult | null>(null);
  const [selected,   setSelected]   = useState<VersionName | null>(null);
  const [playing,    setPlaying]    = useState<VersionName | "reference" | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [stereoDragging, setStereoDragging] = useState(false);
  const [stemsDragging,  setStemsDragging]  = useState(false);

  interface TrendingTrack { id: string; title: string; artistName: string; coverUrl: string | null; slug: string; }
  const [trendingTracks, setTrendingTracks] = useState<TrendingTrack[]>([]);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef    = useRef<HTMLInputElement | null>(null);
  const stemsRef    = useRef<HTMLInputElement | null>(null);

  // ── Download all — triggers all 6 format files + all platform exports ──────
  function downloadAllFiles() {
    if (!result || !jobId) return;
    const FORMAT_KEYS = ["mp3_320", "wav_16_44", "wav_24_44", "wav_24_48", "flac_24_44", "aiff_24_44"];
    const allItems: { href: string }[] = [
      ...FORMAT_KEYS.map((fmt) => ({
        href: `/api/mastering/job/${jobId}/download?format=${fmt}&version=${selected ?? "Warm"}`,
      })),
      ...result.exports.map((ex) => ({ href: ex.url })),
    ];
    allItems.forEach(({ href }, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = href;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 700);
    });
  }

  // ── Auto-advance past email if user has a session ─────────────────────────
  useEffect(() => {
    if (session?.user?.email && step === "email") {
      setEmail(session.user.email);
      setName(session.user.name ?? "");
      setStep("mode");
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch trending tracks for post-delivery section ───────────────────────
  useEffect(() => {
    if (step !== "export") return;
    fetch("/api/explore/trending?limit=4")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (Array.isArray(d?.tracks)) setTrendingTracks(d.tracks.slice(0, 4)); })
      .catch(() => {});
  }, [step]);

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
          reportData?: MasterReport & { error?: string };
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
          const errDetail = (data.reportData as any)?.error;
          setError(errDetail ? `Processing failed: ${errDetail}` : "Processing failed. Please try again.");
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
    const { uploadUrl, accessUrl } = await res.json() as { uploadUrl: string; fileUrl: string; accessUrl: string };
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    return accessUrl;
  }

  // ── Full job start (post-payment or included credit) ──────────────────────
  async function startProcessing(paymentIntentId?: string, creditsUsed?: boolean) {
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
          platforms,
          referenceTrackUrl:     uploadedRefUrl ?? undefined,
          referenceFileName:     refFileName ?? undefined,
          naturalLanguagePrompt: nlPrompt.trim() || undefined,
          stripePaymentId:       paymentIntentId,
          creditsUsed:           creditsUsed ?? false,
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
      const checkoutData = await checkoutRes.json() as {
        creditsUsed?: boolean;
        clientSecret?: string;
      };

      // Subscriber used an included credit — skip Stripe entirely
      if (checkoutData.creditsUsed) {
        await startProcessing(undefined, true);
        return;
      }

      const { clientSecret } = checkoutData;
      if (!clientSecret) throw new Error("Checkout failed — no payment intent.");

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
            {/* Welcome back banner — shown when arriving via abandoned-cart email */}
            {resumeJobId && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: "#1A1A1A", border: "1px solid #D4A843", color: "#D4A843" }}>
                Welcome back — pick up where you left off.
              </div>
            )}
            <h2 className="text-xl font-bold mb-1">Where should we send your master?</h2>
            <p className="text-sm mb-6" style={{ color: "#777" }}>
              Sign in for one-click access, or drop your email below.
            </p>
            <div className="space-y-3">

              {/* Google OAuth */}
              <button
                onClick={() => signIn("google", { callbackUrl: "/master" })}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[#2A2A2A] text-sm font-medium hover:border-[#444] transition-colors"
                style={{ backgroundColor: "#fff", color: "#111" }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Facebook OAuth */}
              <button
                onClick={() => signIn("facebook", { callbackUrl: "/master" })}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1877F2", color: "#fff" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A2A2A" }} />
                <span className="text-xs" style={{ color: "#555" }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A2A2A" }} />
              </div>

              {/* Email field */}
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#D4A843] transition-colors"
              />

              {/* Name field */}
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

              <a
                href="/explore"
                className="block text-center hover:text-white transition-colors"
                style={{ color: "#888", fontSize: 13 }}
              >
                Just want to listen? Explore music →
              </a>
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
                onDragOver={(e) => { e.preventDefault(); setStereoDragging(true); }}
                onDragLeave={() => setStereoDragging(false)}
                onDrop={(e) => { e.preventDefault(); setStereoDragging(false); const f = e.dataTransfer.files[0]; if (f) setStereoFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={cn("rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all", stereoFile ? "border-[#D4A843]" : stereoDragging ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]")}
                style={stereoDragging ? { backgroundColor: "rgba(212,168,67,0.05)" } : undefined}
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
                  onDragOver={(e) => { e.preventDefault(); setStemsDragging(true); }}
                  onDragLeave={() => setStemsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setStemsDragging(false); if (e.dataTransfer.files) addStemFiles(e.dataTransfer.files); }}
                  onClick={() => stemsRef.current?.click()}
                  className={cn("rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all", stemsDragging ? "border-[#D4A843]" : stems.length ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]")}
                  style={stemsDragging ? { backgroundColor: "rgba(212,168,67,0.05)" } : undefined}
                >
                  <input ref={stemsRef} type="file" accept=".wav,.aiff,.aif,.flac,.mp3" multiple className="hidden" onChange={(e) => { if (e.target.files) addStemFiles(e.target.files); }} />
                  <Upload size={22} className="mx-auto mb-2" style={{ color: stems.length ? "#D4A843" : "#555" }} />
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

            {/* Reference track — Premium/Pro only */}
            {(tier === "PREMIUM" || tier === "PRO") && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>
                  Reference track <span style={{ color: "#555" }}>(optional — match loudness &amp; tone)</span>
                </p>
                {uploadedRefUrl ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#2A2A2A] px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                        <Check size={12} className="inline mr-1.5" />
                        {refFileName ?? "Reference uploaded"}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>
                        Matchering will align your master to this track
                      </p>
                    </div>
                    <button
                      onClick={() => { setUploadedRefUrl(null); setRefFileName(null); }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-[#2A2A2A] hover:border-[#444] transition-colors"
                      style={{ color: "#666" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    "flex items-center gap-3 rounded-xl border border-[#2A2A2A] px-4 py-3 cursor-pointer",
                    "hover:border-[#444] transition-colors",
                    refUploading && "opacity-60 pointer-events-none"
                  )}>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.aiff,.aif"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setRefUploading(true);
                        try {
                          const url = await uploadFile(file);
                          setUploadedRefUrl(url);
                          setRefFileName(file.name);
                        } catch {
                          setError("Failed to upload reference track.");
                        } finally {
                          setRefUploading(false);
                        }
                      }}
                    />
                    {refUploading
                      ? <><Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#D4A843" }} /><span className="text-xs" style={{ color: "#777" }}>Uploading…</span></>
                      : <><Upload size={14} className="shrink-0" style={{ color: "#555" }} /><span className="text-xs" style={{ color: "#777" }}>Drop a commercial reference track (WAV or MP3)</span></>
                    }
                  </label>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep("mode")} className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm border border-[#2A2A2A] hover:border-[#444] transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handlePayment}
                disabled={uploading || (mode === "MASTER_ONLY" ? !stereoFile : stems.length < 2)}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {uploading
                  ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                  : <>Pay &amp; Master — {TIER_PRICES[tier][mode]} <ChevronRight size={16} /></>
                }
              </button>
            </div>
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

            {/* Compare to reference */}
            {uploadedRefUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2A2A]">
                <button
                  onClick={() => {
                    if (playing === "reference") {
                      audioRef.current?.pause();
                      setPlaying(null);
                    } else {
                      audioRef.current?.pause();
                      audioRef.current = new Audio(uploadedRefUrl);
                      audioRef.current.play();
                      audioRef.current.onended = () => setPlaying(null);
                      setPlaying("reference");
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#1A1A1A", border: "1px solid #333" }}
                >
                  {playing === "reference"
                    ? <Pause size={12} style={{ color: "#D4A843" }} />
                    : <Play  size={12} style={{ color: "#D4A843" }} />
                  }
                </button>
                <div>
                  <p className="text-xs font-semibold">Reference track</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#777" }}>
                    {refFileName ?? "Your reference"} — compare loudness &amp; tone
                  </p>
                </div>
              </div>
            )}

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

            {/* Format downloads */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A843" }}>Format Downloads</p>
                <button
                  onClick={downloadAllFiles}
                  className="text-xs font-semibold hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ color: "#D4A843" }}
                >
                  <Download size={11} /> Download All
                </button>
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
              {result.exports.map((ex) => {
                const p = PLATFORMS.find((x) => x.id === ex.platform);
                return (
                  <div key={ex.platform} className="flex items-center justify-between p-4 rounded-xl border border-[#2A2A2A] mb-2">
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
            </div>

            {/* Post-delivery upsell */}
            <div className="rounded-2xl border border-[#D4A843]/30 p-5 text-center">
              <p className="font-bold mb-1">Like your master?</p>
              <p className="text-sm mb-4" style={{ color: "#777" }}>IndieThis subscribers save up to 50% on every track — plus full studio tools.</p>
              <a href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
                Start your subscription <ChevronRight size={15} />
              </a>
            </div>

            {/* Post-delivery: Discover more music */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Discover more music on IndieThis</p>
                <a
                  href="/explore"
                  className="flex items-center gap-1 text-xs hover:text-white transition-colors"
                  style={{ color: "#D4A843" }}
                >
                  Explore all <ExternalLink size={11} />
                </a>
              </div>
              {trendingTracks.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                  {trendingTracks.map((t) => (
                    <a
                      key={t.id}
                      href={`/${t.slug}`}
                      className="shrink-0 w-36 rounded-xl border border-[#2A2A2A] overflow-hidden hover:border-[#444] transition-colors"
                      style={{ backgroundColor: "#111" }}
                    >
                      <div className="w-full h-28 bg-[#1A1A1A] flex items-center justify-center overflow-hidden">
                        {t.coverUrl ? (
                          <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music size={20} style={{ color: "#333" }} />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold truncate">{t.title}</p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "#777" }}>{t.artistName}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href="/explore"
                  className="flex items-center justify-center gap-2 p-4 rounded-xl border border-[#2A2A2A] text-sm hover:border-[#444] transition-colors"
                  style={{ color: "#777" }}
                >
                  <Music size={15} /> Browse independent artists on IndieThis
                </a>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
