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

type Step = "email" | "mode" | "upload" | "configure" | "payment" | "processing" | "direction" | "compare";
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
  reportData:      MasterReport | null;
  previewUrl:      string;
  originalUrl:     string | null;
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
  const [nlPrompt,       setNlPrompt]       = useState("");
  const [selectedFormat, setSelectedFormat] = useState<string>("wav_24_44");
  const [emailSent, setEmailSent] = useState(false);

  // Direction dropdowns (v2 spec)
  const [vibeDirection,   setVibeDirection]   = useState<string>("");
  const [platformTarget,  setPlatformTarget]  = useState<string>("");
  const [customDirection, setCustomDirection] = useState<string>("");
  const [mixDirection,    setMixDirection]    = useState<string>("");

  const [stereoFile,    setStereoFile]    = useState<File | null>(null);
  const [stems,         setStems]         = useState<{ file: File; name: string; type?: string }[]>([]);
  const [uploadedRefUrl, setUploadedRefUrl] = useState<string | null>(null);
  const [refFileName,   setRefFileName]   = useState<string | null>(null);
  const [refUploading,  setRefUploading]  = useState(false);

  const [jobId,      setJobId]      = useState<string | null>(null);
  const [jobStatus,  setJobStatus]  = useState("PENDING");
  const [result,     setResult]     = useState<JobResult | null>(null);
  const [selected,   setSelected]   = useState<VersionName | null>(null);
  const [playing,    setPlaying]    = useState<VersionName | "reference" | "original" | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [stereoDragging, setStereoDragging] = useState(false);
  const [stemsDragging,  setStemsDragging]  = useState(false);

  // Direction assistant state
  const [directionRec,       setDirectionRec]       = useState<string | null>(null);
  const [directionCustom,    setDirectionCustom]    = useState("");
  const [directionModifying, setDirectionModifying] = useState(false);
  const [directionLoading,   setDirectionLoading]   = useState(false);

  // Processing screen rotating content — separate timers for messages vs cards
  const [msgIdx,  setMsgIdx]  = useState(0);  // engine status messages, cycles every 4s
  const [cardIdx, setCardIdx] = useState(0);  // feature cards, cycles every 8s

  interface TrendingTrack { id: string; title: string; artistName: string; coverUrl: string | null; slug: string; }
  const [trendingTracks, setTrendingTracks] = useState<TrendingTrack[]>([]);

  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef      = useRef<HTMLInputElement | null>(null);
  const stemsRef      = useRef<HTMLInputElement | null>(null);
  const discoverRef   = useRef<HTMLDivElement | null>(null);

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
    if (step !== "compare") return;
    fetch("/api/explore/trending?limit=4")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (Array.isArray(d?.tracks)) setTrendingTracks(d.tracks.slice(0, 4)); })
      .catch(() => {});
  }, [step]);

  // ── Engine status messages per stage ──────────────────────────────────────
  const ENGINE_MESSAGES: Record<string, string[]> = {
    PENDING:    ["Queuing your job…", "Warming up the engine…"],
    ANALYZING:  ["Analyzing frequency balance…", "Detecting BPM and key…", "Measuring loudness levels…", "Identifying genre characteristics…"],
    SEPARATING: ["Isolating vocal track…", "Separating drums and bass…", "Extracting instrument layers…"],
    MIXING:     ["Applying vocal presence boost…", "Tightening low end compression…", "Balancing stereo field…"],
    MASTERING:  ["Applying warm EQ curve…", "Shaping punch dynamics…", "Normalizing to -14 LUFS…", "Generating 4 master versions…"],
    PREVIEWING: ["Finding highest energy section…", "Applying fade transitions…"],
  };

  // Engine status messages — cycle every 4s while processing
  useEffect(() => {
    if (step !== "processing") return;
    const id = setInterval(() => setMsgIdx((i) => i + 1), 4000);
    return () => clearInterval(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feature discovery cards — cycle every 8s while processing
  useEffect(() => {
    if (step !== "processing") return;
    const id = setInterval(() => setCardIdx((i) => (i + 1) % 7), 8000);
    return () => clearInterval(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Status polling ────────────────────────────────────────────────────────
  // Dep array is [jobId, step] — NOT jobStatus.
  // Using jobStatus as a dep caused the effect to re-subscribe every time the
  // status updated, creating an infinite re-subscription loop when AWAITING_DIRECTION
  // was detected (handler clears interval → jobStatus change → effect re-runs →
  // new interval immediately sees AWAITING_DIRECTION again → loop).
  // Now: the effect only starts when we enter the processing step, and cleans up
  // when we leave it (direction step, compare step, etc).
  useEffect(() => {
    if (!jobId || step !== "processing") return;

    // Hard timeout — if no result after 9 min the Vercel function timed out
    const timeoutId = setTimeout(() => {
      clearInterval(pollRef.current!);
      setError("Processing timed out. Please try again — warm server runs are faster.");
      setJobStatus("FAILED");
    }, 9 * 60 * 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mastering/job/${jobId}/status`);
        const data = await res.json() as {
          status:        string;
          versions?:     MasterVersion[];
          exports?:      { platform: string; lufs: number; format: string; url: string }[];
          reportData?:   MasterReport & { error?: string };
          previewUrl?:   string;
          inputFileUrl?: string;
          analysisData?: Record<string, unknown>;
        };
        setJobStatus(data.status);
        if (data.status === "AWAITING_DIRECTION") {
          clearInterval(pollRef.current!);
          // Extract Claude's recommendation from analysisData
          const rec = (data.analysisData?.directionRecommendation as string | null) ?? null;
          setDirectionRec(rec);
          setDirectionCustom(rec ?? "");
          setStep("direction");   // leaves processing → effect cleanup fires
        } else if (data.status === "COMPLETE") {
          clearTimeout(timeoutId);
          clearInterval(pollRef.current!);
          setResult({
            versions:        Array.isArray(data.versions) ? data.versions : [],
            exports:         Array.isArray(data.exports)  ? data.exports  : [],
            reportData:      data.reportData ?? null,
            previewUrl:      data.previewUrl ?? "",
            originalUrl:     data.inputFileUrl ?? null,
            selectedVersion: null,
          });
          setStep("compare");
        } else if (data.status === "FAILED") {
          clearTimeout(timeoutId);
          clearInterval(pollRef.current!);
          const errDetail = (data.reportData as any)?.error;
          setError(errDetail ? `Processing failed: ${errDetail}` : "Processing failed. Please try again.");
        }
      } catch { /* retry on next tick */ }
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, step]); // eslint-disable-line react-hooks/exhaustive-deps

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
          vibeDirection:         vibeDirection  || undefined,
          platformTarget:        platformTarget || undefined,
          customDirection:       customDirection.trim() || undefined,
          mixDirection:          mixDirection   || undefined,
          stripePaymentId:       paymentIntentId,
          creditsUsed:           creditsUsed ?? false,
          guestEmail:            email,
          guestName:             name || undefined,
        }),
      });
      const resData = await res.json() as { jobId?: string; error?: string };
      if (!res.ok || !resData.jobId) throw new Error(resData.error ?? "Failed to start mastering job.");
      const id = resData.jobId;

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
    PENDING:             "Queued…",
    ANALYZING:           "Analyzing your audio…",
    SEPARATING:          "Separating stems…",
    MIXING:              "Applying processing chain…",
    MASTERING:           "Mastering — generating 4 versions…",
    AWAITING_DIRECTION:  "Analysis complete…",
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

            {/* Direction — Vibe + Platform dropdowns */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium" style={{ color: "#777" }}>Direction <span style={{ color: "#555" }}>(optional)</span></p>

              {/* Vibe Direction */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: "#555" }}>Vibe</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { value: "warm_full",            label: "Warm & full",          desc: "Low shelf boost, gentle high roll-off, light compression" },
                    { value: "bright_crisp",         label: "Bright & crisp",       desc: "High shelf boost, mid-high presence, clean limiting" },
                    { value: "punchy_loud",          label: "Punchy & loud",        desc: "Mid presence boost, aggressive compression, pushed LUFS" },
                    { value: "lofi_vintage",         label: "Lo-fi / vintage",      desc: "Subtle saturation, rolled highs, relaxed dynamics" },
                    { value: "natural_transparent",  label: "Natural / transparent", desc: "Minimal processing, preserve original character" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVibeDirection(vibeDirection === opt.value ? "" : opt.value)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all text-xs",
                        vibeDirection === opt.value
                          ? "border-[#D4A843] bg-[#D4A843]/8"
                          : "border-[#2A2A2A] hover:border-[#444]"
                      )}
                    >
                      <span className="font-medium" style={{ color: vibeDirection === opt.value ? "#D4A843" : "#ccc" }}>{opt.label}</span>
                      <span className="text-[10px] ml-3 text-right" style={{ color: "#555" }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Target */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: "#555" }}>Platform ready</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: "spotify",      label: "Spotify",        lufs: "−14 LUFS" },
                    { value: "apple_music",  label: "Apple Music",    lufs: "−16 LUFS" },
                    { value: "youtube",      label: "YouTube",        lufs: "−14 LUFS" },
                    { value: "club_dj",      label: "Club / DJ",      lufs: "−8 to −10" },
                    { value: "radio",        label: "Radio ready",    lufs: "−12 LUFS" },
                    { value: "tiktok",       label: "TikTok / Reels", lufs: "−14 LUFS" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPlatformTarget(platformTarget === opt.value ? "" : opt.value)}
                      className={cn(
                        "flex flex-col rounded-lg border px-3 py-2 text-left transition-all",
                        platformTarget === opt.value
                          ? "border-[#D4A843] bg-[#D4A843]/8"
                          : "border-[#2A2A2A] hover:border-[#444]"
                      )}
                    >
                      <span className="text-xs font-medium" style={{ color: platformTarget === opt.value ? "#D4A843" : "#ccc" }}>{opt.label}</span>
                      <span className="text-[10px]" style={{ color: "#555" }}>{opt.lufs}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mix direction — stems mode only */}
              {mode === "MIX_AND_MASTER" && (
                <div>
                  <p className="text-[10px] mb-1.5" style={{ color: "#555" }}>Mix direction</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: "vocal_forward",  label: "Vocal forward",  desc: "Boost vocals, duck competing freqs" },
                      { value: "bass_heavy",     label: "Bass heavy",     desc: "Sub boost, tighten kick" },
                      { value: "balanced_mix",   label: "Balanced mix",   desc: "Even stem levels, gentle processing" },
                      { value: "drum_focused",   label: "Drum focused",   desc: "Punch kicks/snares, tighten cymbals" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMixDirection(mixDirection === opt.value ? "" : opt.value)}
                        className={cn(
                          "flex flex-col rounded-lg border px-3 py-2 text-left transition-all",
                          mixDirection === opt.value
                            ? "border-[#D4A843] bg-[#D4A843]/8"
                            : "border-[#2A2A2A] hover:border-[#444]"
                        )}
                      >
                        <span className="text-xs font-medium" style={{ color: mixDirection === opt.value ? "#D4A843" : "#ccc" }}>{opt.label}</span>
                        <span className="text-[10px]" style={{ color: "#555" }}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom direction — Premium/Pro only */}
              {(tier === "PREMIUM" || tier === "PRO") && (
                <div>
                  <p className="text-[10px] mb-1.5" style={{ color: "#555" }}>Custom notes <span style={{ color: "#444" }}>(Premium)</span></p>
                  <div className="rounded-xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                    <div className="flex items-start gap-2 px-3 pt-2.5 pb-1">
                      <Zap size={13} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                      <textarea
                        placeholder="Add specific notes — e.g. more low end, wider stereo, brighter vocals."
                        value={customDirection}
                        onChange={(e) => setCustomDirection(e.target.value)}
                        rows={2}
                        className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                      />
                    </div>
                  </div>
                </div>
              )}
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
        {step === "processing" && (() => {
          const stages = [
            { key: "PENDING",             label: "Queued",     pct: 5  },
            { key: "ANALYZING",           label: "Analyzing",  pct: 30 },
            { key: "AWAITING_DIRECTION",  label: "Analyzing",  pct: 30 }, // same visual slot as analyze
            { key: "MASTERING",           label: "Mastering",  pct: 75 },
            { key: "PREVIEWING",          label: "Preview",    pct: 92 },
          ];
          // Dot labels for display (no AWAITING_DIRECTION shown — it's invisible to the user)
          const dotStages = [
            { key: "PENDING",    label: "Queued"   },
            { key: "ANALYZING",  label: "Analyzing"},
            { key: "MASTERING",  label: "Mastering"},
            { key: "PREVIEWING", label: "Preview"  },
          ];
          const currentIdx = stages.findIndex(s => s.key === jobStatus);
          const pct = currentIdx >= 0 ? stages[currentIdx].pct : (jobStatus === "COMPLETE" ? 100 : 5);
          // For dot highlight: treat AWAITING_DIRECTION same as ANALYZING
          const dotStatus = jobStatus === "AWAITING_DIRECTION" ? "ANALYZING" : jobStatus;
          const dotIdx = dotStages.findIndex(s => s.key === dotStatus);
          const label = statusLabels[jobStatus] ?? "Processing…";
          // 28 bars for the waveform visualizer
          const BAR_COUNT = 28;
          const barHeights = [40,60,80,55,90,70,45,85,65,75,50,95,60,80,45,70,85,55,90,65,75,50,80,60,70,45,85,55];
          return (
            <div className="py-10 space-y-7">
              <div className="text-center space-y-1">
                <p className="font-semibold" style={{ color: "#aaa" }}>{label}</p>
                <p className="text-3xl font-bold tracking-tight" style={{ color: "#D4A843" }}>{pct}%</p>
              </div>

              {/* Waveform visualizer */}
              <div className="flex items-end justify-center gap-[3px]" style={{ height: 60 }}>
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                  const baseH = barHeights[i % barHeights.length];
                  const filled = (i / BAR_COUNT) * 100 <= pct;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 5,
                        height: `${baseH}%`,
                        borderRadius: 3,
                        backgroundColor: filled ? "#D4A843" : "#2A2A2A",
                        animation: filled ? `masterPulse ${0.6 + (i % 5) * 0.15}s ease-in-out infinite alternate` : "none",
                        opacity: filled ? 1 : 0.4,
                        transition: "background-color 0.4s ease",
                      }}
                    />
                  );
                })}
              </div>

              {/* Stage dots under bar */}
              <div className="flex justify-between px-1">
                {dotStages.map((s, i) => {
                  const done   = i < dotIdx;
                  const active = i === dotIdx;
                  return (
                    <div key={s.key} className="flex flex-col items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{
                        backgroundColor: done || active ? "#D4A843" : "#2A2A2A",
                        boxShadow: active ? "0 0 6px #D4A843" : "none",
                      }} />
                      <span className="text-[9px]" style={{ color: active ? "#D4A843" : done ? "#666" : "#333" }}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <style>{`
                @keyframes masterPulse {
                  from { transform: scaleY(0.6); }
                  to   { transform: scaleY(1.15); }
                }
                @keyframes itemFade {
                  0%   { opacity: 0; transform: translateY(6px); }
                  12%  { opacity: 1; transform: translateY(0); }
                  88%  { opacity: 1; transform: translateY(0); }
                  100% { opacity: 0; transform: translateY(-4px); }
                }
              `}</style>

              {/* Engine status messages — what the AI is doing right now */}
              {(() => {
                const stageMessages = ENGINE_MESSAGES[jobStatus] ?? ENGINE_MESSAGES.MASTERING;
                const msg = stageMessages[msgIdx % stageMessages.length];
                return (
                  <div className="text-center" style={{ minHeight: 28 }}>
                    <p key={`msg-${msgIdx}`} className="text-xs font-mono tracking-wide" style={{ color: "#555", animation: "itemFade 4s ease-in-out forwards" }}>
                      <span style={{ color: "#D4A843", marginRight: 6 }}>▸</span>
                      {msg}
                    </p>
                  </div>
                );
              })()}

              <p className="text-center text-[11px]" style={{ color: "#444" }}>
                We'll email <span style={{ color: "#666" }}>{email}</span> when it's ready
              </p>

              {/* Feature discovery cards — separate section below */}
              {(() => {
                const FEATURE_CARDS = [
                  // Card 0 — Video Studio: full-bleed gold, icon left
                  <div key="video" className="rounded-2xl overflow-hidden" style={{ background: "#D4A843" }}>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span style={{ fontSize: 28 }}>🎬</span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#0A0A0A", opacity: 0.6 }}>Video Studio</p>
                        <p className="font-bold text-sm leading-tight mt-0.5" style={{ color: "#0A0A0A" }}>Turn this track into a cinematic music video</p>
                      </div>
                    </div>
                  </div>,

                  // Card 1 — Cover Art: dark with glow border, centered
                  <div key="cover" className="rounded-2xl text-center py-5 px-4" style={{ background: "#0D0D0D", border: "1px solid #D4A843", boxShadow: "0 0 20px rgba(212,168,67,0.15)" }}>
                    <p style={{ fontSize: 26 }}>🎨</p>
                    <p className="text-xs font-semibold mt-2 mb-1" style={{ color: "#D4A843" }}>Cover Art Generator</p>
                    <p className="text-sm font-bold" style={{ color: "#fff" }}>Your sound deserves a visual identity</p>
                  </div>,

                  // Card 2 — Lyric Video: split layout with divider
                  <div key="lyric" className="rounded-2xl overflow-hidden flex" style={{ background: "#111", border: "1px solid #222" }}>
                    <div className="flex items-center justify-center px-5" style={{ background: "#1A1A1A", borderRight: "1px solid #222" }}>
                      <span style={{ fontSize: 30 }}>✍️</span>
                    </div>
                    <div className="flex-1 px-4 py-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#555" }}>Lyric Video</p>
                      <p className="text-sm font-bold leading-snug" style={{ color: "#fff" }}>Words move when the beat drops</p>
                    </div>
                  </div>,

                  // Card 3 — Merch Store: gradient background
                  <div key="merch" className="rounded-2xl px-5 py-4" style={{ background: "linear-gradient(135deg, #1A0A00 0%, #2A1500 100%)", border: "1px solid #3A2000" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#D4A843" }}>Merch Store</p>
                        <p className="text-sm font-bold" style={{ color: "#fff" }}>Sell from your artist page</p>
                        <p className="text-xs mt-0.5" style={{ color: "#888" }}>Zero inventory required</p>
                      </div>
                      <span style={{ fontSize: 26 }}>👕</span>
                    </div>
                  </div>,

                  // Card 4 — Release Board: minimal single line with accent
                  <div key="release" className="rounded-2xl px-5 py-5" style={{ background: "#111", border: "1px solid #1A1A1A" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-10 rounded-full" style={{ background: "#D4A843" }} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#fff" }}>Release Board</p>
                        <p className="text-xs mt-0.5" style={{ color: "#666" }}>Package track + art + video into one release</p>
                      </div>
                      <span className="ml-auto" style={{ fontSize: 22 }}>🚀</span>
                    </div>
                  </div>,

                  // Card 5 — Studio Bounces: dark noise texture feel
                  <div key="bounces" className="rounded-2xl px-5 py-4" style={{ background: "#0A0A0A", border: "1px solid #2A2A2A" }}>
                    <p style={{ fontSize: 22 }}>🎙️</p>
                    <p className="text-xs uppercase tracking-widest font-bold mt-2 mb-1" style={{ color: "#555" }}>Studio Bounces</p>
                    <p className="text-sm font-bold" style={{ color: "#D4A843" }}>Show fans the creative process</p>
                    <p className="text-[11px] mt-1" style={{ color: "#555" }}>Upload session clips to your artist page</p>
                  </div>,

                  // Card 6 — Beat Marketplace: bold two-tone
                  <div key="beats" className="rounded-2xl overflow-hidden" style={{ background: "#111" }}>
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#555" }}>Beat Marketplace</p>
                        <span style={{ fontSize: 18 }}>💰</span>
                      </div>
                      <p className="text-base font-black" style={{ color: "#fff" }}>Your beats are worth something</p>
                    </div>
                    <div className="px-5 py-2" style={{ background: "#D4A843" }}>
                      <p className="text-[11px] font-bold" style={{ color: "#0A0A0A" }}>License tracks directly from your page →</p>
                    </div>
                  </div>,
                ];
                return (
                  <div key={`card-${cardIdx}`} style={{ animation: "itemFade 8s ease-in-out forwards" }}>
                    {FEATURE_CARDS[cardIdx]}
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {/* ── STEP: Direction assistant ─────────────────────────────── */}
        {step === "direction" && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold">Mastering direction</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                Based on your track analysis, here's what I'd recommend:
              </p>
            </div>

            {directionRec && !directionModifying && (
              <div className="rounded-2xl border border-[#D4A843]/40 p-5" style={{ backgroundColor: "rgba(212,168,67,0.05)" }}>
                <div className="flex items-start gap-3">
                  <Zap size={16} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                  <p className="text-sm leading-relaxed" style={{ color: "#ccc" }}>{directionRec}</p>
                </div>
              </div>
            )}

            {directionModifying && (
              <div className="rounded-2xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                <div className="px-3 pt-2.5 pb-2">
                  <textarea
                    value={directionCustom}
                    onChange={(e) => setDirectionCustom(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Describe what you want from the master…"
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="space-y-2">
              {/* Accept */}
              {!directionModifying && (
                <button
                  disabled={directionLoading}
                  onClick={async () => {
                    setDirectionLoading(true);
                    setError(null);
                    try {
                      await fetch(`/api/mastering/job/${jobId}/confirm-direction`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({ direction: directionRec }),
                      });
                      setJobStatus("MASTERING");
                      setStep("processing");
                    } catch {
                      setError("Failed to confirm direction. Please try again.");
                    } finally {
                      setDirectionLoading(false);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {directionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Apply this direction
                </button>
              )}

              {/* Modify */}
              {!directionModifying ? (
                <button
                  onClick={() => setDirectionModifying(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold border border-[#2A2A2A] hover:border-[#444] transition-colors"
                  style={{ color: "#ccc" }}
                >
                  Modify
                </button>
              ) : (
                <button
                  disabled={directionLoading}
                  onClick={async () => {
                    setDirectionLoading(true);
                    setError(null);
                    try {
                      await fetch(`/api/mastering/job/${jobId}/confirm-direction`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({ direction: directionCustom.trim() || null }),
                      });
                      setJobStatus("MASTERING");
                      setStep("processing");
                    } catch {
                      setError("Failed to confirm direction. Please try again.");
                    } finally {
                      setDirectionLoading(false);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {directionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Apply my direction
                </button>
              )}

              {/* Skip */}
              <button
                disabled={directionLoading}
                onClick={async () => {
                  setDirectionLoading(true);
                  setError(null);
                  try {
                    await fetch(`/api/mastering/job/${jobId}/confirm-direction`, {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body:    JSON.stringify({ direction: null }),
                    });
                    setJobStatus("MASTERING");
                    setStep("processing");
                  } catch {
                    setError("Failed to skip direction. Please try again.");
                  } finally {
                    setDirectionLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-xs hover:opacity-70 transition-opacity"
                style={{ color: "#555" }}
              >
                Skip — master without direction
              </button>
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

            {/* A/B toggle: Original ↔ Selected mastered version */}
            {result.originalUrl && (
              <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
                {/* Toggle bar */}
                <div className="grid grid-cols-2" style={{ backgroundColor: "#111" }}>
                  {(["original", "mastered"] as const).map((side) => {
                    const active = side === "original" ? (playing === "original") : (playing !== null && playing !== "original" && playing !== "reference");
                    const isOrig = side === "original";
                    return (
                      <button
                        key={side}
                        onClick={() => {
                          audioRef.current?.pause();
                          if (isOrig) {
                            audioRef.current = new Audio(result.originalUrl!);
                            audioRef.current.play();
                            audioRef.current.onended = () => setPlaying(null);
                            setPlaying("original");
                          } else {
                            const v = result.versions.find(v => v.name === (selected ?? result.versions[0]?.name));
                            if (v?.url) {
                              audioRef.current = new Audio(v.url);
                              audioRef.current.play();
                              audioRef.current.onended = () => setPlaying(null);
                              setPlaying(v.name as VersionName);
                            }
                          }
                        }}
                        className="py-2.5 text-xs font-semibold transition-all"
                        style={{
                          color: active ? "#0A0A0A" : "#777",
                          backgroundColor: active ? "#D4A843" : "transparent",
                        }}
                      >
                        {isOrig ? "Original" : `Mastered${selected ? ` · ${selected}` : ""}`}
                      </button>
                    );
                  })}
                </div>
                {/* Status line */}
                <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: "#0D0D0D" }}>
                  {(playing === "original" || (playing && playing !== "reference")) && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#D4A843" }} />
                  )}
                  <span className="text-[10px]" style={{ color: "#555" }}>
                    {playing === "original" ? "Playing original…" : playing && playing !== "reference" ? `Playing ${playing}…` : "Tap Original or Mastered to compare"}
                  </span>
                </div>
              </div>
            )}

            {/* Reference track */}
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

            {/* Format picker + Download — inline, no separate step */}
            {selected && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#777" }}>Choose file format</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "wav_24_44",   label: "WAV 24-bit",    sub: "44.1kHz · Studio master" },
                    { id: "wav_24_48",   label: "WAV 24-bit",    sub: "48kHz · Video / broadcast" },
                    { id: "wav_16_44",   label: "WAV 16-bit",    sub: "44.1kHz · CD quality" },
                    { id: "mp3_320",     label: "MP3 320kbps",   sub: "Streaming & social" },
                    { id: "flac_24_44",  label: "FLAC 24-bit",   sub: "Lossless archive" },
                    { id: "aiff_24_44",  label: "AIFF 24-bit",   sub: "Apple / Logic" },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-all",
                        selectedFormat === fmt.id
                          ? "border-[#D4A843] bg-[#D4A843]/8"
                          : "border-[#2A2A2A] hover:border-[#444]"
                      )}
                    >
                      <p className="text-xs font-bold" style={{ color: selectedFormat === fmt.id ? "#D4A843" : "#ccc" }}>{fmt.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{fmt.sub}</p>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Trigger file download
                    const a = document.createElement("a");
                    a.href = `/api/mastering/job/${jobId}/download?format=${selectedFormat}&version=${selected}`;
                    a.download = "";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    // Silently email the results link in the background
                    if (!emailSent) {
                      setEmailSent(true);
                      fetch(`/api/mastering/job/${jobId}/email-results`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({}),
                      }).catch(() => {});
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <Download size={15} />
                  Download {selected} · {selectedFormat === "mp3_320" ? "MP3" : selectedFormat.startsWith("wav") ? "WAV" : selectedFormat.startsWith("flac") ? "FLAC" : "AIFF"}
                </button>
              </div>
            )}

            {/* Upsell */}
            <div className="rounded-xl border border-[#D4A843]/30 p-4 text-center">
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>Get up to 50% off every master</p>
              <p className="text-xs mt-1 mb-3" style={{ color: "#777" }}>Subscribe to IndieThis and never pay full price again.</p>
              <a href="/pricing" className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                See subscriber pricing <ChevronRight size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Export step removed — format picker + download is now inline in compare step */}

      </div>
    </div>
  );
}
