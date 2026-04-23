"use client";

/**
 * /mix-console/wizard — AI Mix Console guest wizard
 *
 * Steps: email → mode → upload → configure → payment → processing → direction → compare → export
 */

import { useState, useRef, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Upload, Loader2, ChevronRight, ChevronLeft, Check, Download,
  X, Zap, Mic, Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "email"
  | "mode"
  | "upload"
  | "configure"
  | "payment"
  | "processing"
  | "direction"
  | "compare"
  | "export";

type MixMode = "VOCAL_BEAT" | "TRACKED_STEMS";
type MixTier = "STANDARD" | "PREMIUM" | "PRO";

interface InputFile {
  url:   string;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_PRICES: Record<MixTier, string> = {
  STANDARD: "$59.99",
  PREMIUM:  "$79.99",
  PRO:      "$99.99",
};

const PROCESSING_TIPS = [
  "Claude reads your lyrics to find the perfect delay moments",
  "Your vocal is being cleaned of room reverb and background noise",
  "Section-aware processing means your chorus gets extra width",
  "Breath editing removes distracting breaths between phrases",
  "Volume riding smooths out uneven vocal performances automatically",
  "The instrumental gets dynamically EQ'd to carve space for your vocal",
  "All mix variations use the exact same 30-second preview window",
];

const card = "rounded-2xl border border-[#1A1A1A] p-8";

// ─── Wizard Component ─────────────────────────────────────────────────────────

export default function MixConsoleWizardClient() {
  const { data: session } = useSession();
  const searchParams      = useSearchParams();

  // ── State ──
  const [step, setStep]   = useState<Step>("email");
  const [email, setEmail] = useState("");

  const [mode, setMode] = useState<MixMode>("VOCAL_BEAT");
  const [tier, setTier] = useState<MixTier>(() => {
    const t = searchParams.get("tier")?.toUpperCase();
    return (t === "STANDARD" || t === "PREMIUM" || t === "PRO") ? t : "STANDARD";
  });

  // Upload — VOCAL_BEAT: vocal layers + beat; TRACKED_STEMS: multi
  const [vocalFiles,      setVocalFiles]      = useState<{ key: string; label: string; files: File[] }[]>([
    { key: "main",      label: "Main Vocal",  files: [] },
    { key: "adlibs",    label: "Ad-libs",     files: [] },
    { key: "insouts",   label: "Ins & Outs",  files: [] },
    { key: "doubles",   label: "Doubles",     files: [] },
    { key: "harmonies", label: "Harmonies",   files: [] },
  ]);
  const [beatFile,        setBeatFile]        = useState<File | null>(null);
  const [stemFiles,       setStemFiles]       = useState<{ file: File; label: string }[]>([]);
  const [vocalDragging,   setVocalDragging]   = useState<string | null>(null);
  const [beatDragging,    setBeatDragging]    = useState(false);
  const [stemsDragging,   setStemsDragging]   = useState(false);

  // Configure
  const [genre,             setGenre]             = useState("AUTO");
  const [breathEditing,     setBreathEditing]     = useState("SUBTLE");
  const [pitchCorrection,   setPitchCorrection]   = useState("SUBTLE");
  const [delayStyle,        setDelayStyle]        = useState("STANDARD");
  const [mixVibe,           setMixVibe]           = useState("POLISHED");
  const [vocalStylePreset,  setVocalStylePreset]  = useState("AUTO");
  const [reverbStyle,       setReverbStyle]       = useState("PLATE");
  const [fadeOut,           setFadeOut]           = useState("AUTO");
  const [beatPolish,        setBeatPolish]        = useState(false);
  const [customDirection,   setCustomDirection]   = useState("");

  // Reference track (Premium/Pro)
  const [refUrl,          setRefUrl]          = useState<string | null>(null);
  const [refFileName,     setRefFileName]     = useState<string | null>(null);
  const [refUploading,    setRefUploading]    = useState(false);

  // Job state
  const [jobId,     setJobId]     = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("PENDING");
  const [jobData,   setJobData]   = useState<Record<string, unknown> | null>(null);

  // Direction step
  const [directionInput,  setDirectionInput]  = useState("");
  const [directionMode,   setDirectionMode]   = useState<"accept" | "modify" | "skip" | null>(null);
  const [directionLoading,setDirectionLoading]= useState(false);

  // Compare step
  const [selectedVersion, setSelectedVersion] = useState<string>("clean");
  const [selectedFormat,  setSelectedFormat]  = useState<string>("wav_24_44");
  const [revisionOpen,    setRevisionOpen]    = useState(false);
  const [revisionFeedback,setRevisionFeedback]= useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [emailSent,       setEmailSent]       = useState(false);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Processing tip rotation
  const [tipIdx,  setTipIdx]  = useState(0);
  const [msgIdx,  setMsgIdx]  = useState(0);

  // Refs
  const vocalInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const beatInputRef   = useRef<HTMLInputElement | null>(null);
  const stemsInputRef = useRef<HTMLInputElement | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // Compare step: tracks which source ("original" | "mixed" | null) is playing
  const [comparePlayingSource, setComparePlayingSource] = useState<"original" | "mixed" | null>(null);

  // ── Auto-advance email if logged in ──
  useEffect(() => {
    if (session?.user?.email && step === "email") {
      setEmail(session.user.email);
      setStep("mode");
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to top on every step change ──
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  // ── Genre presets — auto-configure other params when genre changes ──
  useEffect(() => {
    if (genre === "AUTO") return;
    switch (genre) {
      case "HIP_HOP":
        setPitchCorrection("SUBTLE");
        setDelayStyle("STANDARD");
        setMixVibe("POLISHED");
        setVocalStylePreset("AUTO");
        setReverbStyle("PLATE");
        setBreathEditing("SUBTLE");
        break;
      case "TRAP":
        setPitchCorrection("HARD");
        setDelayStyle("HEAVY");
        setMixVibe("DARK");
        setVocalStylePreset("RAW_UPFRONT");
        setReverbStyle("ROOM");
        setBreathEditing("TIGHT");
        break;
      case "RNB":
        setPitchCorrection("SUBTLE");
        setDelayStyle("SUBTLE");
        setMixVibe("POLISHED");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("PLATE");
        setBreathEditing("SUBTLE");
        break;
      case "POP":
        setPitchCorrection("TIGHT");
        setDelayStyle("SUBTLE");
        setMixVibe("BRIGHT");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("PLATE");
        setBreathEditing("TIGHT");
        break;
      case "AFROBEATS":
        setPitchCorrection("SUBTLE");
        setDelayStyle("STANDARD");
        setMixVibe("BRIGHT");
        setVocalStylePreset("AUTO");
        setReverbStyle("ROOM");
        setBreathEditing("SUBTLE");
        break;
      case "LATIN":
        setPitchCorrection("SUBTLE");
        setDelayStyle("SUBTLE");
        setMixVibe("BRIGHT");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("HALL");
        setBreathEditing("SUBTLE");
        break;
      case "ROCK":
        setPitchCorrection("OFF");
        setDelayStyle("STANDARD");
        setMixVibe("RAW");
        setVocalStylePreset("RAW_UPFRONT");
        setReverbStyle("ROOM");
        setBreathEditing("OFF");
        break;
      case "ELECTRONIC":
        setPitchCorrection("HARD");
        setDelayStyle("HEAVY");
        setMixVibe("BRIGHT");
        setVocalStylePreset("AIRY_SPACIOUS");
        setReverbStyle("HALL");
        setBreathEditing("CLEAN");
        break;
      case "ACOUSTIC":
        setPitchCorrection("OFF");
        setDelayStyle("OFF");
        setMixVibe("CLEAN");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("ROOM");
        setBreathEditing("SUBTLE");
        break;
      case "LO_FI":
        setPitchCorrection("OFF");
        setDelayStyle("SUBTLE");
        setMixVibe("DARK");
        setVocalStylePreset("LOFI_GRITTY");
        setReverbStyle("ROOM");
        setBreathEditing("OFF");
        break;
      case "GOSPEL":
        setPitchCorrection("SUBTLE");
        setDelayStyle("SUBTLE");
        setMixVibe("POLISHED");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("CATHEDRAL");
        setBreathEditing("SUBTLE");
        break;
      case "COUNTRY":
        setPitchCorrection("OFF");
        setDelayStyle("OFF");
        setMixVibe("CLEAN");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("HALL");
        setBreathEditing("SUBTLE");
        break;
      case "NEO_SOUL":
        setPitchCorrection("SUBTLE");
        setDelayStyle("SUBTLE");
        setMixVibe("POLISHED");
        setVocalStylePreset("CLEAN_NATURAL");
        setReverbStyle("PLATE");
        setBreathEditing("SUBTLE");
        break;
    }
  }, [genre]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tip rotation ──
  useEffect(() => {
    if (step !== "processing") return;
    const id = setInterval(() => setTipIdx((i) => (i + 1) % PROCESSING_TIPS.length), 6000);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== "processing") return;
    const id = setInterval(() => setMsgIdx((i) => i + 1), 4000);
    return () => clearInterval(id);
  }, [step]);

  // ── Status polling ──
  useEffect(() => {
    if (!jobId || step !== "processing") return;

    const timeoutId = setTimeout(() => {
      clearInterval(pollRef.current!);
      setError("Processing timed out. Please try again.");
      setJobStatus("FAILED");
    }, 12 * 60 * 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/mix-console/job/${jobId}`);
        const pollText = await res.text();
        if (!pollText) return;
        const data = JSON.parse(pollText) as Record<string, unknown>;
        const status = data.status as string;
        setJobStatus(status);

        if (status === "AWAITING_DIRECTION") {
          clearInterval(pollRef.current!);
          setJobData(data);
          const rec = (data.directionRecommendation as string | null) ?? "";
          setDirectionInput(rec);
          setStep("direction");
        } else if (status === "COMPLETE") {
          clearTimeout(timeoutId);
          clearInterval(pollRef.current!);
          setJobData(data);
          // Default to first available version
          const previewPaths = data.previewFilePaths as Record<string, string> | null;
          if (previewPaths) {
            const firstKey = Object.keys(previewPaths)[0];
            if (firstKey) setSelectedVersion(firstKey);
          }
          setStep("compare");
        } else if (status === "FAILED") {
          clearTimeout(timeoutId);
          clearInterval(pollRef.current!);
          const analysisData = data.analysisData as Record<string, unknown> | null;
          const errMsg = (analysisData?.error as string | null) ?? null;
          setError(errMsg ? `Processing failed: ${errMsg}` : "Processing failed. Please try again.");
        }
      } catch { /* retry */ }
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload helper ──
  async function uploadFile(file: File): Promise<string> {
    const res = await fetch("/api/upload/presign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filename: file.name, contentType: file.type, folder: "mix-console" }),
    });
    const text = await res.text();
    if (!res.ok || !text) throw new Error(`Upload failed (${res.status}): ${text || "empty response"}`);
    const { uploadUrl, accessUrl } = JSON.parse(text) as { uploadUrl: string; accessUrl: string };
    if (!uploadUrl || !accessUrl) throw new Error("Upload service returned invalid response. Please try again.");
    const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!putRes.ok) throw new Error(`File upload failed (${putRes.status}). Please try again.`);
    return accessUrl;
  }

  // ── Start job ──
  async function startJob() {
    setError(null);
    setUploading(true);
    try {
      let inputFiles: InputFile[] = [];

      if (mode === "VOCAL_BEAT") {
        const mainSlot = vocalFiles.find((v) => v.key === "main");
        if (!mainSlot || mainSlot.files.length === 0 || !beatFile) throw new Error("Please upload your main vocal and beat.");
        // Expand each slot: multiple files in a slot get indexed labels (vocal_adlibs_0, vocal_adlibs_1, etc.)
        const filesToUpload: { file: File; label: string }[] = [];
        for (const slot of vocalFiles) {
          slot.files.forEach((f, idx) => {
            const label = slot.files.length === 1
              ? `vocal_${slot.key}`
              : `vocal_${slot.key}_${idx}`;
            filesToUpload.push({ file: f, label });
          });
        }
        filesToUpload.push({ file: beatFile, label: "beat" });
        const uploaded = await Promise.all(
          filesToUpload.map(async (s) => ({ url: await uploadFile(s.file), label: s.label }))
        );
        inputFiles = uploaded;
      } else {
        if (stemFiles.length < 2) throw new Error("Please upload at least 2 stems.");
        const uploaded = await Promise.all(
          stemFiles.map(async (s) => ({ url: await uploadFile(s.file), label: s.label }))
        );
        inputFiles = uploaded;
      }

      const res = await fetch("/api/mix-console/job", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode,
          tier,
          inputFiles,
          genre:           genre          !== "AUTO" ? genre : undefined,
          breathEditing:   breathEditing  !== "OFF"  ? breathEditing  : undefined,
          pitchCorrection: pitchCorrection !== "OFF"  ? pitchCorrection : undefined,
          delayStyle:      delayStyle     !== "OFF"  ? delayStyle     : undefined,
          mixVibe:          mixVibe             || undefined,
          vocalStylePreset: vocalStylePreset !== "AUTO" ? vocalStylePreset : undefined,
          beatPolish:       beatPolish || undefined,
          reverbStyle:      reverbStyle        || undefined,
          fadeOut:          fadeOut            || undefined,
          customDirection: customDirection.trim() || undefined,
          referenceTrackUrl: refUrl       || undefined,
          referenceFileName: refFileName  || undefined,
          guestEmail:      email,
        }),
      });
      const resText = await res.text();
      if (!resText) throw new Error(`Server returned empty body (HTTP ${res.status} ${res.url}). Please try again.`);
      let resData: { jobId?: string; error?: string };
      try { resData = JSON.parse(resText); } catch { throw new Error(`Bad JSON from server (HTTP ${res.status}): ${resText.slice(0, 200)}`); }
      if (!res.ok || !resData.jobId) throw new Error(resData.error ?? `HTTP ${res.status}: Failed to start mix job.`);

      document.cookie = `indiethis_guest_email=${encodeURIComponent(email)}; path=/; max-age=604800`;
      setJobId(resData.jobId);
      setJobStatus("PENDING");
      setStep("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  function addStemFile(file: File) {
    if (stemFiles.length >= 16) return;
    setStemFiles((prev) => [...prev, { file, label: file.name.replace(/\.[^.]+$/, "") }]);
  }

  function updateStemLabel(idx: number, label: string) {
    setStemFiles((prev) => prev.map((s, i) => i === idx ? { ...s, label } : s));
  }

  function togglePreviewPlay(url: string) {
    if (audioPlaying) {
      audioRef.current?.pause();
      setAudioPlaying(false);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setAudioPlaying(false);
      setAudioPlaying(true);
    }
  }

  function downloadFile(version: string, format: string) {
    const a = document.createElement("a");
    a.href = `/api/mix-console/job/${jobId}/download?version=${version}&format=${format}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!emailSent) {
      setEmailSent(true);
      // Email results link silently
      fetch(`/api/mix-console/job/${jobId}/email-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }

  // ─── Processing stage display ───────────────────────────────────────────────

  const STAGE_MESSAGES: Record<string, string[]> = {
    PENDING:            ["Queuing your job…", "Warming up the engine…"],
    SEPARATING:         ["Isolating your beat into stems…", "Separating drums, bass, and instruments…"],
    ANALYZING:          ["Analyzing frequency balance…", "Detecting BPM and key…", "Classifying vocal roles…", "Measuring loudness…"],
    AWAITING_DIRECTION: ["Analysis complete…"],
    MIXING:             ["Applying vocal chain…", "Cleaning room reverb…", "Section-aware compression…", "Balancing stereo image…"],
    PREVIEWING:         ["Finding highest-energy window…", "Generating 30-second preview…"],
    REVISING:           ["Applying your feedback…", "Re-processing vocal chain…", "Rebuilding mix with revisions…"],
  };

  const STAGE_DOTS = [
    { key: "PENDING",    label: "Queued"    },
    { key: "SEPARATING", label: "Separating" },
    { key: "ANALYZING",  label: "Analyzing"  },
    { key: "MIXING",     label: "Mixing"     },
    { key: "PREVIEWING", label: "Preview"    },
  ];

  const STAGE_PCT: Record<string, number> = {
    PENDING:            5,
    SEPARATING:         20,
    ANALYZING:          40,
    AWAITING_DIRECTION: 55,
    MIXING:             75,
    REVISING:           78,
    PREVIEWING:         92,
  };

  const pct     = STAGE_PCT[jobStatus] ?? 5;
  const dotIdx  = STAGE_DOTS.findIndex((s) => s.key === jobStatus);
  const stageMessages = STAGE_MESSAGES[jobStatus] ?? STAGE_MESSAGES.MIXING;
  const currentMsg    = stageMessages[msgIdx % stageMessages.length];
  const BAR_COUNT     = 28;
  const barHeights    = [40,60,80,55,90,70,45,85,65,75,50,95,60,80,45,70,85,55,90,65,75,50,80,60,70,45,85,55];

  // ─── Preview file paths ─────────────────────────────────────────────────────
  const previewFilePaths  = (jobData?.previewFilePaths  as Record<string, string>  | null) ?? null;
  const revisionCount     = (jobData?.revisionCount     as number) ?? 0;
  const maxRevisions      = (jobData?.maxRevisions      as number) ?? 0;
  const directionRec      = (jobData?.directionRecommendation as string | null) ?? null;

  // Versions available for Standard
  const standardVersions = [
    { key: "clean",      label: "Clean",      desc: "Balanced, natural reference" },
    { key: "polished",   label: "Polished",   desc: "Radio-ready shine" },
    { key: "aggressive", label: "Aggressive", desc: "Forward, punchy character" },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Back to landing */}
        {step === "email" && (
          <Link
            href="/mix-console"
            className="flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors mb-8 no-underline"
          >
            <ChevronLeft size={15} /> Back
          </Link>
        )}

        {/* ── STEP: Email ─────────────────────────────────────────────────────── */}
        {step === "email" && (
          <div className={card}>
            <h2 className="text-xl font-bold mb-1">Where should we send your mix?</h2>
            <p className="text-sm mb-6" style={{ color: "#777" }}>
              Sign in for one-click access, or drop your email below.
            </p>

            <div className="space-y-3">
              {/* Google OAuth */}
              <button
                onClick={() => signIn("google", { callbackUrl: "/mix-console/wizard" })}
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
                onClick={() => signIn("facebook", { callbackUrl: "/mix-console/wizard" })}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1877F2", color: "#fff" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A2A2A" }} />
                <span className="text-xs" style={{ color: "#555" }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A2A2A" }} />
              </div>

              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.includes("@")) {
                    setError(null);
                    setStep("mode");
                  }
                }}
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
                style={{ backgroundColor: "#E8735A", color: "#fff" }}
              >
                Continue <ChevronRight size={16} />
              </button>

              <p className="text-center text-xs" style={{ color: "#555" }}>
                We&apos;ll email you when your mix is ready.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Mode ──────────────────────────────────────────────────────── */}
        {step === "mode" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-2">What are you starting with?</h2>

            {[
              {
                value: "VOCAL_BEAT" as MixMode,
                label: "Vocal + Beat",
                description: "I have a vocal recording and a beat / instrumental",
                icon: <Mic size={20} style={{ color: "#D4A843" }} />,
              },
              {
                value: "TRACKED_STEMS" as MixMode,
                label: "Tracked-out Stems",
                description: "I have 2–16 individual stems (kick, snare, bass, etc.)",
                icon: <Sliders size={20} style={{ color: "#D4A843" }} />,
              },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all",
                  mode === opt.value
                    ? "border-[#D4A843] bg-[#D4A843]/8"
                    : "border-[#2A2A2A] hover:border-[#444]",
                )}
              >
                {opt.icon}
                <div className="flex-1">
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#777" }}>{opt.description}</div>
                </div>
                {mode === opt.value && <Check size={15} style={{ color: "#D4A843" }} />}
              </button>
            ))}

            {/* Tier selector */}
            <div className="mt-4">
              <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Tier</p>
              <div className="grid grid-cols-3 gap-2">
                {(["STANDARD", "PREMIUM", "PRO"] as MixTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all text-xs",
                      tier === t
                        ? "border-[#D4A843] bg-[#D4A843]/8"
                        : "border-[#2A2A2A] hover:border-[#444]",
                    )}
                  >
                    <div className="font-bold" style={{ color: tier === t ? "#D4A843" : "#fff" }}>
                      {TIER_PRICES[t]}
                    </div>
                    <div className="mt-0.5 capitalize" style={{ color: "#777" }}>{t.toLowerCase()}</div>
                    {t === "PREMIUM" && (
                      <div className="mt-1 text-[9px] font-bold" style={{ color: "#D4A843" }}>Most Popular</div>
                    )}
                  </button>
                ))}
              </div>
              {/* Tier descriptions */}
              <div className="mt-3 rounded-xl border border-[#1A1A1A] p-3 text-xs" style={{ color: "#666" }}>
                {tier === "STANDARD" && "3 mix variations (Clean / Polished / Aggressive), full vocal chain, breath editing, pitch correction"}
                {tier === "PREMIUM" && "AI-recommended mix + 2 revision rounds, delay throws, reverb, section-aware processing, reference track matching"}
                {tier === "PRO" && "Everything in Premium + Claude identifies delay words from lyrics, 3 revision rounds, per-word delay requests"}
              </div>
            </div>

            <button
              onClick={() => setStep("upload")}
              className="w-full py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ backgroundColor: "#E8735A", color: "#fff" }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP: Upload ─────────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setStep("mode")}
                className="text-[#555] hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-lg font-bold">
                {mode === "VOCAL_BEAT" ? "Upload your files" : "Upload your stems"}
              </h2>
            </div>

            {mode === "VOCAL_BEAT" ? (
              <div className="space-y-4">
                {/* Vocal layers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: "#777" }}>Vocal Layers</p>
                    <p className="text-[10px]" style={{ color: "#555" }}>Main required · others optional</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {vocalFiles.map((vSlot) => {
                      const isMain     = vSlot.key === "main";
                      const isDragging = vocalDragging === vSlot.key;
                      const hasFiles   = vSlot.files.length > 0;
                      return (
                        <div key={vSlot.key} className="space-y-1">
                          {/* Drop zone row */}
                          <div
                            onDragEnter={(e) => { e.preventDefault(); setVocalDragging(vSlot.key); }}
                            onDragOver={(e)  => { e.preventDefault(); setVocalDragging(vSlot.key); }}
                            onDragLeave={() => setVocalDragging(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setVocalDragging(null);
                              const dropped = Array.from(e.dataTransfer.files);
                              if (dropped.length) setVocalFiles((prev) => prev.map((v) => v.key === vSlot.key ? { ...v, files: [...v.files, ...dropped] } : v));
                            }}
                            onClick={() => vocalInputRefs.current[vSlot.key]?.click()}
                            className={cn(
                              "rounded-xl border border-dashed px-4 py-3 flex items-center gap-3 cursor-pointer transition-all",
                              hasFiles   ? "border-[#D4A843]" :
                              isDragging ? "border-[#D4A843]" :
                              isMain     ? "border-[#333] hover:border-[#555]" :
                                           "border-[#222] hover:border-[#333]",
                            )}
                            style={isDragging ? { backgroundColor: "rgba(212,168,67,0.05)" } : undefined}
                          >
                            <input
                              ref={(el) => { vocalInputRefs.current[vSlot.key] = el; }}
                              type="file"
                              accept=".wav,.aif,.aiff,.flac,.mp3"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const picked = Array.from(e.target.files ?? []);
                                if (picked.length) setVocalFiles((prev) => prev.map((v) => v.key === vSlot.key ? { ...v, files: [...v.files, ...picked] } : v));
                              }}
                            />
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: hasFiles ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)" }}
                            >
                              {hasFiles
                                ? <Check size={13} style={{ color: "#D4A843" }} />
                                : <Upload size={13} style={{ color: isMain ? "#888" : "#444" }} />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: hasFiles ? "#D4A843" : isMain ? "#ccc" : "#666" }}>
                                {vSlot.label}
                                {isMain && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>REQUIRED</span>}
                              </p>
                              <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>
                                {hasFiles ? `${vSlot.files.length} file${vSlot.files.length > 1 ? "s" : ""} · click to add more` : "Drop files or click to browse · multiple takes OK"}
                              </p>
                            </div>
                          </div>
                          {/* File chips */}
                          {hasFiles && (
                            <div className="flex flex-wrap gap-1 pl-1">
                              {vSlot.files.map((f, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                                  {f.name.length > 24 ? f.name.slice(0, 21) + "…" : f.name}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVocalFiles((prev) => prev.map((v) => v.key === vSlot.key ? { ...v, files: v.files.filter((_, i) => i !== idx) } : v));
                                    }}
                                    className="hover:text-red-400 transition-colors ml-0.5"
                                  >
                                    <X size={9} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Beat upload */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "#777" }}>Your Beat / Instrumental</p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setBeatDragging(true); }}
                    onDragLeave={() => setBeatDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setBeatDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) setBeatFile(f);
                    }}
                    onClick={() => beatInputRef.current?.click()}
                    className={cn(
                      "rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
                      beatFile ? "border-[#D4A843]" : beatDragging ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]",
                    )}
                    style={beatDragging ? { backgroundColor: "rgba(212,168,67,0.05)" } : undefined}
                  >
                    <input
                      ref={beatInputRef}
                      type="file"
                      accept=".wav,.aif,.aiff,.flac,.mp3"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setBeatFile(f); }}
                    />
                    <Upload size={20} className="mx-auto mb-2" style={{ color: beatFile ? "#D4A843" : "#555" }} />
                    {beatFile ? (
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#D4A843" }}>{beatFile.name}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setBeatFile(null); }}
                          className="text-[10px] mt-1 hover:text-red-400 transition-colors"
                          style={{ color: "#555" }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Drop your beat or instrumental</p>
                        <p className="text-xs mt-1" style={{ color: "#555" }}>WAV or MP3 · Max 500 MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Tracked stems */
              <div className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setStemsDragging(true); }}
                  onDragLeave={() => setStemsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setStemsDragging(false);
                    Array.from(e.dataTransfer.files).forEach(addStemFile);
                  }}
                  onClick={() => stemsInputRef.current?.click()}
                  className={cn(
                    "rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
                    stemFiles.length > 0 ? "border-[#D4A843]" : stemsDragging ? "border-[#D4A843]" : "border-[#2A2A2A] hover:border-[#444]",
                  )}
                  style={stemsDragging ? { backgroundColor: "rgba(212,168,67,0.05)" } : undefined}
                >
                  <input
                    ref={stemsInputRef}
                    type="file"
                    accept=".wav,.aif,.aiff,.flac,.mp3"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) Array.from(e.target.files).forEach(addStemFile);
                    }}
                  />
                  <Upload size={20} className="mx-auto mb-2" style={{ color: stemFiles.length ? "#D4A843" : "#555" }} />
                  <p className="text-sm font-medium">Drop stems or click to browse</p>
                  <p className="text-xs mt-1" style={{ color: "#555" }}>
                    {stemFiles.length > 0
                      ? `${stemFiles.length} / 16 files added`
                      : "2–16 stems · WAV or MP3 · Max 500 MB each"}
                  </p>
                </div>

                {stemFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {stemFiles.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-3 py-2">
                        <Check size={12} style={{ color: "#D4A843", flexShrink: 0 }} />
                        <span className="flex-1 text-xs truncate" style={{ color: "#aaa" }}>{s.file.name}</span>
                        <input
                          type="text"
                          value={s.label}
                          onChange={(e) => updateStemLabel(i, e.target.value)}
                          placeholder="label"
                          className="w-24 bg-transparent border border-[#2A2A2A] rounded-lg px-2 py-0.5 text-xs outline-none focus:border-[#D4A843] transition-colors"
                          style={{ color: "#aaa" }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={() => setStemFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="text-[#555] hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={() => setStep("configure")}
              disabled={
                mode === "VOCAL_BEAT"
                  ? (vocalFiles.find((v) => v.key === "main")?.files.length ?? 0) === 0 || !beatFile
                  : stemFiles.length < 2
              }
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP: Configure ──────────────────────────────────────────────────── */}
        {step === "configure" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep("upload")} className="text-[#555] hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-lg font-bold">Configure your mix</h2>
            </div>

            {/* Dropdowns helper */}
            {(
              [
                {
                  label: "Genre",
                  value: genre,
                  set: setGenre,
                  options: [
                    { v: "AUTO",       l: "Auto-detect" },
                    { v: "HIP_HOP",    l: "Hip-Hop" },
                    { v: "TRAP",       l: "Trap" },
                    { v: "RNB",        l: "R&B" },
                    { v: "POP",        l: "Pop" },
                    { v: "AFROBEATS",  l: "Afrobeats" },
                    { v: "LATIN",      l: "Latin" },
                    { v: "ROCK",       l: "Rock" },
                    { v: "ELECTRONIC", l: "Electronic" },
                    { v: "ACOUSTIC",   l: "Acoustic" },
                    { v: "LO_FI",      l: "Lo-Fi" },
                    { v: "GOSPEL",     l: "Gospel" },
                    { v: "COUNTRY",    l: "Country" },
                    { v: "NEO_SOUL",   l: "Neo Soul" },
                  ],
                },
                {
                  label: "Breath Editing",
                  value: breathEditing,
                  set: setBreathEditing,
                  options: [
                    { v: "OFF",    l: "Off" },
                    { v: "SUBTLE", l: "Subtle (−6–12dB)" },
                    { v: "CLEAN",  l: "Clean (remove, leave gaps)" },
                    { v: "TIGHT",  l: "Tight (remove, close gaps)" },
                  ],
                },
                {
                  label: "Pitch Correction",
                  value: pitchCorrection,
                  set: setPitchCorrection,
                  options: [
                    { v: "OFF",    l: "Off" },
                    { v: "SUBTLE", l: "Subtle" },
                    { v: "TIGHT",  l: "Tight" },
                    { v: "HARD",   l: "Hard (Auto-Tune effect)" },
                  ],
                },
                {
                  label: "Delay Style",
                  value: delayStyle,
                  set: setDelayStyle,
                  options: [
                    { v: "OFF",      l: "Off" },
                    { v: "SUBTLE",   l: "Subtle" },
                    { v: "STANDARD", l: "Standard" },
                    { v: "HEAVY",    l: "Heavy" },
                  ],
                },
                {
                  label: "Mix Vibe",
                  value: mixVibe,
                  set: setMixVibe,
                  options: [
                    { v: "CLEAN",    l: "Clean & natural" },
                    { v: "POLISHED", l: "Polished radio-ready" },
                    { v: "DARK",     l: "Dark & moody" },
                    { v: "BRIGHT",   l: "Bright & airy" },
                    { v: "RAW",      l: "Raw & gritty" },
                  ],
                },
                {
                  label: "Vocal Style",
                  value: vocalStylePreset,
                  set: setVocalStylePreset,
                  options: [
                    { v: "AUTO",          l: "Auto (genre-based)" },
                    { v: "CLEAN_NATURAL", l: "Clean & natural" },
                    { v: "LOFI_GRITTY",   l: "Lo-fi & gritty" },
                    { v: "AIRY_SPACIOUS", l: "Airy & spacious" },
                    { v: "RAW_UPFRONT",   l: "Raw & upfront" },
                  ],
                },
                {
                  label: "Reverb Style",
                  value: reverbStyle,
                  set: setReverbStyle,
                  options: [
                    { v: "DRY",       l: "Dry" },
                    { v: "ROOM",      l: "Room" },
                    { v: "PLATE",     l: "Plate" },
                    { v: "HALL",      l: "Hall" },
                    { v: "CATHEDRAL", l: "Cathedral" },
                  ],
                },
                {
                  label: "Fade Out",
                  value: fadeOut,
                  set: setFadeOut,
                  options: [
                    { v: "AUTO", l: "Auto-detect" },
                    { v: "3S",   l: "Yes (3 seconds)" },
                    { v: "5S",   l: "Yes (5 seconds)" },
                    { v: "8S",   l: "Yes (8 seconds)" },
                    { v: "NO",   l: "No fade" },
                  ],
                },
              ] as { label: string; value: string; set: (v: string) => void; options: { v: string; l: string }[] }[]
            ).map(({ label, value, set, options }) => (
              <div key={label}>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#777" }}>{label}</label>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full bg-[#111] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#D4A843] transition-colors appearance-none cursor-pointer"
                  style={{ color: "#ccc" }}
                >
                  {options.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>
            ))}

            {/* Beat Polish add-on — VOCAL_BEAT only */}
            {mode === "VOCAL_BEAT" && (
              <label className="flex items-start gap-3 rounded-xl border border-[#2A2A2A] px-4 py-3 cursor-pointer hover:border-[#3A3A3A] transition-colors">
                <input
                  type="checkbox"
                  checked={beatPolish}
                  onChange={(e) => setBeatPolish(e.target.checked)}
                  className="mt-0.5 accent-[#D4A843]"
                />
                <div>
                  <p className="text-sm font-semibold">
                    Polish your beat around your vocals
                    <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#1A1A1A", color: "#D4A843" }}>+$19.99</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#555" }}>
                    We'll separate your instrumental into drums, bass, and melodics, then optimize each element to sit perfectly with your vocals.
                  </p>
                </div>
              </label>
            )}

            {/* Custom direction — Premium/Pro */}
            {(tier === "PREMIUM" || tier === "PRO") && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#777" }}>
                  Custom direction{" "}
                  <span style={{ color: "#555" }}>(optional)</span>
                </label>
                <div className="rounded-xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                  <div className="flex items-start gap-2 px-3 pt-2.5 pb-1">
                    <Zap size={13} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                    <textarea
                      placeholder="e.g. keep the vocal dark and intimate, heavy bass in the chorus, wide reverb on the bridge..."
                      value={customDirection}
                      onChange={(e) => setCustomDirection(e.target.value)}
                      rows={3}
                      className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reference track — Premium/Pro */}
            {(tier === "PREMIUM" || tier === "PRO") && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#777" }}>
                  Reference track <span style={{ color: "#555" }}>(optional)</span>
                </label>
                {refUrl ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#2A2A2A] px-4 py-3">
                    <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                      <Check size={12} className="inline mr-1.5" />
                      {refFileName ?? "Reference uploaded"}
                    </p>
                    <button
                      onClick={() => { setRefUrl(null); setRefFileName(null); }}
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
                    refUploading && "opacity-60 pointer-events-none",
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
                          setRefUrl(url);
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
                      : <><Upload size={14} className="shrink-0" style={{ color: "#555" }} /><span className="text-xs" style={{ color: "#777" }}>Upload a commercial reference track (WAV or MP3)</span></>
                    }
                  </label>
                )}
              </div>
            )}

            <button
              onClick={() => setStep("payment")}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Review order <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP: Payment ────────────────────────────────────────────────────── */}
        {step === "payment" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep("configure")} className="text-[#555] hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-lg font-bold">Order summary</h2>
            </div>

            <div className="rounded-2xl border border-[#1A1A1A] p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: "#777" }}>Mode</span>
                <span>{mode === "VOCAL_BEAT" ? "Vocal + Beat" : "Tracked Stems"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "#777" }}>Tier</span>
                <span className="capitalize">{tier.toLowerCase()}</span>
              </div>
              {tier === "PREMIUM" && (
                <div className="flex justify-between text-xs" style={{ color: "#777" }}>
                  <span>Revision rounds</span>
                  <span>2</span>
                </div>
              )}
              {tier === "PRO" && (
                <div className="flex justify-between text-xs" style={{ color: "#777" }}>
                  <span>Revision rounds</span>
                  <span>3</span>
                </div>
              )}
              <div className="h-px" style={{ backgroundColor: "#1A1A1A" }} />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span style={{ color: "#D4A843" }}>{TIER_PRICES[tier]}</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* Test mode bypass */}
            <button
              onClick={startJob}
              disabled={uploading}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ backgroundColor: "#E8735A", color: "#fff" }}
            >
              {uploading
                ? <><Loader2 size={15} className="animate-spin" /> Uploading files…</>
                : <>Pay {TIER_PRICES[tier]} — Mix My Track <ChevronRight size={16} /></>
              }
            </button>

            {/* Test bypass — remove before launch */}
            <button
              onClick={startJob}
              disabled={uploading}
              className="w-full py-2 rounded-xl text-xs border border-[#2A2A2A] hover:border-[#444] transition-colors"
              style={{ color: "#555" }}
            >
              Continue (Test Mode — skip payment)
            </button>
          </div>
        )}

        {/* ── STEP: Processing ─────────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="py-10 space-y-7">
            <div className="text-center space-y-1">
              <p className="font-semibold" style={{ color: "#aaa" }}>
                {jobStatus === "PENDING" ? "Queued…" :
                 jobStatus === "SEPARATING" ? "Separating stems…" :
                 jobStatus === "ANALYZING" ? "Analyzing your tracks…" :
                 jobStatus === "MIXING" ? "Mixing your track…" :
                 jobStatus === "PREVIEWING" ? "Generating preview…" :
                 "Processing…"}
              </p>
              <p className="text-3xl font-bold tracking-tight" style={{ color: "#D4A843" }}>{pct}%</p>
            </div>

            {/* Waveform visualizer */}
            <div className="flex items-end justify-center gap-[3px]" style={{ height: 60 }}>
              {Array.from({ length: BAR_COUNT }).map((_, i) => {
                const baseH  = barHeights[i % barHeights.length];
                const filled = (i / BAR_COUNT) * 100 <= pct;
                return (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: `${baseH}%`,
                      borderRadius: 3,
                      backgroundColor: filled ? "#D4A843" : "#2A2A2A",
                      animation: filled ? `mixPulse ${0.6 + (i % 5) * 0.15}s ease-in-out infinite alternate` : "none",
                      opacity: filled ? 1 : 0.4,
                      transition: "background-color 0.4s ease",
                    }}
                  />
                );
              })}
            </div>

            {/* Stage dots */}
            <div className="flex justify-between px-1">
              {(mode === "VOCAL_BEAT" ? STAGE_DOTS : STAGE_DOTS.filter((s) => s.key !== "SEPARATING")).map((s, i) => {
                const done   = i < dotIdx;
                const active = i === dotIdx;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: done || active ? "#D4A843" : "#2A2A2A",
                        boxShadow: active ? "0 0 6px #D4A843" : "none",
                      }}
                    />
                    <span className="text-[9px]" style={{ color: active ? "#D4A843" : done ? "#666" : "#333" }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <style>{`
              @keyframes mixPulse {
                from { transform: scaleY(0.6); }
                to   { transform: scaleY(1.15); }
              }
              @keyframes mixFade {
                0%   { opacity: 0; transform: translateY(6px); }
                12%  { opacity: 1; transform: translateY(0); }
                88%  { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-4px); }
              }
            `}</style>

            {/* Engine message */}
            <div className="text-center" style={{ minHeight: 28 }}>
              <p
                key={`msg-${msgIdx}`}
                className="text-xs font-mono tracking-wide"
                style={{ color: "#555", animation: "mixFade 4s ease-in-out forwards" }}
              >
                <span style={{ color: "#D4A843", marginRight: 6 }}>▸</span>
                {currentMsg}
              </p>
            </div>

            {/* Rotating tip */}
            <div
              key={`tip-${tipIdx}`}
              className="rounded-xl border border-[#1A1A1A] px-4 py-3 text-center"
              style={{ animation: "mixFade 6s ease-in-out forwards" }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                <span style={{ color: "#D4A843" }}>💡 </span>
                {PROCESSING_TIPS[tipIdx]}
              </p>
            </div>

            <p className="text-center text-[11px]" style={{ color: "#444" }}>
              We&apos;ll email <span style={{ color: "#666" }}>{email}</span> when it&apos;s ready
            </p>

            {/* Failed state */}
            {jobStatus === "FAILED" && error && (
              <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Direction ──────────────────────────────────────────────────── */}
        {step === "direction" && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold">AI Mix Direction</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                Based on your track analysis, here&apos;s what I&apos;d recommend:
              </p>
            </div>

            {/* Recommendation display */}
            {directionRec && directionMode !== "modify" && (
              <div
                className="rounded-2xl border border-[#D4A843]/40 p-5"
                style={{ backgroundColor: "rgba(212,168,67,0.05)" }}
              >
                <div className="flex items-start gap-3">
                  <Zap size={16} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                  <p className="text-sm leading-relaxed" style={{ color: "#ccc" }}>{directionRec}</p>
                </div>
              </div>
            )}

            {/* Modify textarea */}
            {directionMode === "modify" && (
              <div className="rounded-2xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                <div className="px-3 pt-2.5 pb-2">
                  <textarea
                    value={directionInput}
                    onChange={(e) => setDirectionInput(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Describe what you want from the mix…"
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444]"
                  />
                </div>
              </div>
            )}

            {/* Pro: per-word delay */}
            {tier === "PRO" && (
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: "#777" }}>
                  Per-word delay requests <span style={{ color: "#555" }}>(Pro — optional)</span>
                </p>
                <div className="rounded-xl border border-[#2A2A2A] focus-within:border-[#D4A843] transition-colors p-0.5">
                  <textarea
                    placeholder={`Put delay on "tonight" in the chorus. Keep the bridge dry.`}
                    rows={2}
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#444] px-3 pt-2.5 pb-2"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="space-y-2">
              {/* Accept */}
              {directionMode !== "modify" && (
                <button
                  disabled={directionLoading}
                  onClick={async () => {
                    setDirectionLoading(true);
                    setError(null);
                    try {
                      await fetch(`/api/mix-console/job/${jobId}/confirm-direction`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({ direction: directionRec }),
                      });
                      setJobStatus("MIXING");
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
                  Looks good, proceed
                </button>
              )}

              {/* Modify / Apply */}
              {directionMode !== "modify" ? (
                <button
                  onClick={() => setDirectionMode("modify")}
                  className="w-full py-3 rounded-xl text-sm font-semibold border border-[#2A2A2A] hover:border-[#444] transition-colors"
                  style={{ color: "#ccc" }}
                >
                  ✏ Modify
                </button>
              ) : (
                <button
                  disabled={directionLoading}
                  onClick={async () => {
                    setDirectionLoading(true);
                    setError(null);
                    try {
                      await fetch(`/api/mix-console/job/${jobId}/confirm-direction`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({ direction: directionInput.trim() || null }),
                      });
                      setJobStatus("MIXING");
                      setStep("processing");
                    } catch {
                      setError("Failed to apply direction. Please try again.");
                    } finally {
                      setDirectionLoading(false);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {directionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Apply &amp; Mix
                </button>
              )}

              {/* Skip */}
              <button
                disabled={directionLoading}
                onClick={async () => {
                  setDirectionLoading(true);
                  setError(null);
                  try {
                    await fetch(`/api/mix-console/job/${jobId}/confirm-direction`, {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body:    JSON.stringify({ direction: null }),
                    });
                    setJobStatus("MIXING");
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
                Skip → mix without direction
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Compare ────────────────────────────────────────────────────── */}
        {step === "compare" && jobData && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold">Your mix is ready</h2>
              <p className="text-xs mt-1" style={{ color: "#777" }}>
                {tier === "STANDARD"
                  ? "Pick your preferred variation below"
                  : "AI-selected mix — compare vs original"}
              </p>
            </div>

            {/* Version selector (Standard only) */}
            {tier === "STANDARD" && (
              <div className="space-y-2">
                {standardVersions.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => {
                      setSelectedVersion(v.key);
                      // Stop any playing audio when switching version
                      audioRef.current?.pause();
                      setComparePlayingSource(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      selectedVersion === v.key
                        ? "border-[#D4A843] bg-[#D4A843]/8"
                        : "border-[#2A2A2A] hover:border-[#444]",
                    )}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: selectedVersion === v.key ? "#D4A843" : "#fff" }}>
                        {v.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#666" }}>{v.desc}</p>
                    </div>
                    {selectedVersion === v.key && <Check size={14} style={{ color: "#D4A843" }} />}
                  </button>
                ))}
              </div>
            )}

            {/* Preview player */}
            {previewFilePaths && (
              <div className="rounded-2xl border border-[#1A1A1A] p-4">
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: "#555" }}>
                  30-second preview
                </p>
                {(() => {
                  const previewUrl = previewFilePaths[selectedVersion] ?? Object.values(previewFilePaths)[0];
                  const originalUrl = (jobData.previewFilePaths as Record<string,string> | null)?.original ?? null;
                  return (
                    <div className="space-y-3">
                      {/* A/B toggle */}
                      {originalUrl && (
                        <div className="flex rounded-lg overflow-hidden border border-[#2A2A2A]">
                          <button
                            onClick={() => {
                              if (comparePlayingSource === "original") {
                                // Already playing original — pause it
                                audioRef.current?.pause();
                                setComparePlayingSource(null);
                              } else {
                                // Start playing original
                                audioRef.current?.pause();
                                const a = new Audio(originalUrl);
                                a.play().catch(() => {});
                                a.onended = () => setComparePlayingSource(null);
                                audioRef.current = a;
                                setComparePlayingSource("original");
                              }
                            }}
                            className="flex-1 py-2 text-xs font-semibold transition-colors"
                            style={{
                              backgroundColor: comparePlayingSource === "original" ? "#333" : "#1A1A1A",
                              color: comparePlayingSource === "original" ? "#D4A843" : "#777",
                            }}
                          >
                            {comparePlayingSource === "original" ? "⏸ Original" : "▶ Original"}
                          </button>
                          <button
                            onClick={() => {
                              if (comparePlayingSource === "mixed") {
                                // Already playing mixed — pause it
                                audioRef.current?.pause();
                                setComparePlayingSource(null);
                              } else {
                                // Start playing mixed
                                audioRef.current?.pause();
                                const a = new Audio(previewUrl);
                                a.play().catch(() => {});
                                a.onended = () => setComparePlayingSource(null);
                                audioRef.current = a;
                                setComparePlayingSource("mixed");
                              }
                            }}
                            className="flex-1 py-2 text-xs font-semibold transition-colors"
                            style={{
                              backgroundColor: "#D4A843",
                              color: "#0A0A0A",
                            }}
                          >
                            {comparePlayingSource === "mixed" ? "⏸ Mixed" : "▶ Mixed"}
                          </button>
                        </div>
                      )}

                      {/* Simple play button if no original */}
                      {!originalUrl && (
                        <button
                          onClick={() => togglePreviewPlay(previewUrl)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                          style={{ backgroundColor: "#1A1A1A", color: audioPlaying ? "#D4A843" : "#ccc" }}
                        >
                          {audioPlaying
                            ? <><span>⏸</span> Pause preview</>
                            : <><span>▶</span> Play 30-second preview</>
                          }
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Format selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#777" }}>
                Choose file format
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "wav_24_44",  label: "WAV 24-bit",  sub: "44.1kHz · Studio master" },
                  { id: "wav_24_48",  label: "WAV 24-bit",  sub: "48kHz · Video / broadcast" },
                  { id: "wav_16_44",  label: "WAV 16-bit",  sub: "44.1kHz · CD quality" },
                  { id: "mp3_320",    label: "MP3 320kbps", sub: "Streaming & social" },
                  { id: "flac",       label: "FLAC 24-bit", sub: "Lossless archive" },
                  { id: "aiff",       label: "AIFF 24-bit", sub: "Apple / Logic" },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-all",
                      selectedFormat === fmt.id
                        ? "border-[#D4A843] bg-[#D4A843]/8"
                        : "border-[#2A2A2A] hover:border-[#444]",
                    )}
                  >
                    <p className="text-xs font-bold" style={{ color: selectedFormat === fmt.id ? "#D4A843" : "#ccc" }}>
                      {fmt.label}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{fmt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Download */}
            <button
              onClick={() => downloadFile(selectedVersion, selectedFormat)}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Download size={15} />
              Download {selectedVersion.charAt(0).toUpperCase() + selectedVersion.slice(1)} · {
                selectedFormat === "mp3_320" ? "MP3"
                : selectedFormat.startsWith("wav") ? "WAV"
                : selectedFormat.startsWith("flac") ? "FLAC"
                : "AIFF"
              }
            </button>

            {/* Revision panel (Premium/Pro) */}
            {(tier === "PREMIUM" || tier === "PRO") && revisionCount < maxRevisions && (
              <div className="rounded-2xl border border-[#1A1A1A] overflow-hidden">
                <button
                  onClick={() => setRevisionOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm text-left hover:bg-[#111] transition-colors"
                >
                  <span style={{ color: "#888" }}>Not satisfied?</span>
                  <span className="text-xs" style={{ color: "#555" }}>
                    {maxRevisions - revisionCount} revision{maxRevisions - revisionCount !== 1 ? "s" : ""} remaining
                  </span>
                </button>
                {revisionOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-[#1A1A1A]" style={{ paddingTop: 16 }}>
                    <textarea
                      value={revisionFeedback}
                      onChange={(e) => setRevisionFeedback(e.target.value)}
                      rows={3}
                      placeholder="Describe what to change — more high end, less reverb, push the vocal forward..."
                      className="w-full bg-transparent border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#D4A843] transition-colors resize-none placeholder:text-[#444]"
                    />
                    <button
                      disabled={revisionLoading || !revisionFeedback.trim()}
                      onClick={async () => {
                        setRevisionLoading(true);
                        setError(null);
                        try {
                          const res = await fetch(`/api/mix-console/job/${jobId}/revise`, {
                            method:  "POST",
                            headers: { "Content-Type": "application/json" },
                            body:    JSON.stringify({ feedback: revisionFeedback }),
                          });
                          if (!res.ok) throw new Error("Revision request failed.");
                          setRevisionFeedback("");
                          setRevisionOpen(false);
                          setJobStatus("REVISING");
                          setStep("processing");
                        } catch {
                          setError("Failed to submit revision. Please try again.");
                        } finally {
                          setRevisionLoading(false);
                        }
                      }}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                      style={{ backgroundColor: "#E8735A", color: "#fff" }}
                    >
                      {revisionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      Submit Revision
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Master CTA */}
            <div
              className="rounded-2xl border border-[#1A1A1A] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-semibold mb-0.5">Ready to master?</p>
                <p className="text-xs" style={{ color: "#777" }}>Take your mix to release-ready with 4 mastered versions.</p>
              </div>
              <Link
                href="/master"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 no-underline"
                style={{ backgroundColor: "#E8735A", color: "#fff" }}
              >
                Master for $7.99 →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
