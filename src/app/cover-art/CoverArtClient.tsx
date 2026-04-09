"use client";

/**
 * CoverArtClient — non-subscriber cover art wizard
 *
 * Phase 0 — Tier selection (STANDARD / PREMIUM / PRO)
 * Phase 1 — Style picker (category filter + 15 style grid)
 * Phase 2 — Prompt + reference image → pay via Stripe
 * Phase 3 — Generating (polling /api/cover-art/[id]/status)
 * Phase 4 — Variation grid + selection
 * Phase 5 — Pro: refinement round
 * Phase 6 — Final: download + explore + subscribe CTA
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams }                           from "next/navigation";
import {
  Sparkles, Download, Loader2, AlertCircle, Check,
  ZoomIn, X, Film, Music2, ChevronLeft, ChevronRight,
  Upload, Star, RefreshCw,
} from "lucide-react";
import { useUploadThing }    from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS }  from "@/lib/pricing";
import { CATEGORY_LABELS }   from "@/lib/cover-art/styles-seed";
import AvatarPicker, { type AvatarSelectPayload } from "@/components/avatar/AvatarPicker";
import StylePlaceholder from "@/components/cover-art/StylePlaceholder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier  = "STANDARD" | "PREMIUM" | "PRO";
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface StyleItem {
  id:         string;
  name:       string;
  category:   string;
  previewUrl: string;
}

interface JobStatus {
  id:                string;
  status:            "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";
  tier:              Tier;
  variationUrls:     string[];
  selectedUrl:       string | null;
  refinementRound:   number;
  refinementHistory: RefinementEntry[];
  errorMessage:      string | null;
}

interface RefinementEntry {
  round:       number;
  instruction: string;
  prompt:      string;
  urls:        string[];
  selectedUrl: string | null;
}

interface Props {
  guestEmail: string;
  artistName: string | null;
  userId:     string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_INFO = {
  STANDARD: {
    label:      "Standard",
    badge:      null,
    variations: 4,
    features:   ["4 AI variations", "AI-enhanced prompt", "Instant download"],
    priceKey:   "AI_COVER_ART_STANDARD_GUEST",
    default:    PRICING_DEFAULTS.AI_COVER_ART_STANDARD_GUEST.display,
  },
  PREMIUM: {
    label:      "Premium",
    badge:      "POPULAR",
    variations: 8,
    features:   ["8 AI variations", "Reference image upload", "Higher quality model"],
    priceKey:   "AI_COVER_ART_PREMIUM_GUEST",
    default:    PRICING_DEFAULTS.AI_COVER_ART_PREMIUM_GUEST.display,
  },
  PRO: {
    label:      "Pro",
    badge:      "BEST",
    variations: 8,
    features:   ["8 AI variations", "1 refinement round", "Art director experience"],
    priceKey:   "AI_COVER_ART_PRO_GUEST",
    default:    PRICING_DEFAULTS.AI_COVER_ART_PRO_GUEST.display,
  },
} as const;

const ALL_CATEGORIES = ["ALL", "MINIMAL", "DARK", "VIBRANT", "CLASSIC", "EXPERIMENTAL"] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function VariationCard({
  url,
  selected,
  onSelect,
  onFullscreen,
}: {
  url:         string;
  selected:    boolean;
  onSelect:    () => void;
  onFullscreen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        outline:     selected ? "3px solid #D4A843" : "3px solid transparent",
        aspectRatio: "1/1",
        cursor:      "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
      {hovered && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <button
            onClick={onFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
          >
            <ZoomIn size={12} /> Preview
          </button>
          <button
            onClick={onSelect}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Check size={12} /> Select
          </button>
        </div>
      )}
      {selected && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#D4A843" }}
        >
          <Check size={12} style={{ color: "#0A0A0A" }} />
        </div>
      )}
    </div>
  );
}

function FullscreenPreview({
  url,
  artistName,
  onClose,
}: {
  url:        string;
  artistName: string | null;
  onClose:    () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
      onClick={onClose}
    >
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="relative rounded-2xl overflow-hidden aspect-square">
          <img src={url} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute bottom-0 inset-x-0 px-4 py-5 text-center"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)" }}
          >
            <p className="text-white font-black text-lg leading-tight">Your Track Title</p>
            {artistName && <p className="text-white/70 text-sm mt-0.5">{artistName}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          <a
            href={url}
            download="cover-art.png"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Download size={14} /> Download
          </a>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#1A1A1A", color: "#888" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoverArtClient({ guestEmail, artistName, userId }: Props) {
  const searchParams = useSearchParams();

  // ── Phase + wizard state ───────────────────────────────────────────────────
  const [phase,          setPhase]          = useState<Phase>(0);
  const [tier,           setTier]           = useState<Tier>("STANDARD");
  const [selectedStyle,  setSelectedStyle]  = useState<StyleItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [prompt,         setPrompt]         = useState("");
  const [refImageUrl,    setRefImageUrl]    = useState<string | null>(null);
  const [refImageName,   setRefImageName]   = useState<string | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const [styles, setStyles] = useState<StyleItem[]>([]);

  // ── Generation state ───────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus,   setJobStatus]   = useState<JobStatus | null>(null);
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  // ── Pro refinement ─────────────────────────────────────────────────────────
  const [refInstruction, setRefInstruction] = useState("");
  const [refining,       setRefining]       = useState(false);
  const [refineError,    setRefineError]    = useState<string | null>(null);

  // ── Fullscreen preview ─────────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Pricing ────────────────────────────────────────────────────────────────
  const [pricing, setPricing] = useState<Record<string, string>>({
    AI_COVER_ART_STANDARD_GUEST: PRICING_DEFAULTS.AI_COVER_ART_STANDARD_GUEST.display,
    AI_COVER_ART_PREMIUM_GUEST:  PRICING_DEFAULTS.AI_COVER_ART_PREMIUM_GUEST.display,
    AI_COVER_ART_PRO_GUEST:      PRICING_DEFAULTS.AI_COVER_ART_PRO_GUEST.display,
  });

  // ── Load styles ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/cover-art/styles")
      .then(r => r.ok ? r.json() : { styles: [] })
      .then((d: { styles?: StyleItem[] }) => setStyles(d.styles ?? []));
  }, []);

  // ── Handle Stripe return (?paid=1&jobId=...) ───────────────────────────────
  useEffect(() => {
    const paid  = searchParams.get("paid");
    const jobId = searchParams.get("jobId");
    if (paid === "1" && jobId) {
      setActiveJobId(jobId);
      // Try to load existing tier from status
      fetch(`/api/cover-art/${jobId}/status`)
        .then(r => r.ok ? r.json() : null)
        .then((d: JobStatus | null) => {
          if (d?.tier) setTier(d.tier);
        })
        .catch(() => {});
      setPhase(3);
    }
  }, [searchParams]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    if (phase !== 3 || !activeJobId) { stopPolling(); return; }

    async function poll() {
      if (!activeJobId) return;
      try {
        const res  = await fetch(`/api/cover-art/${activeJobId}/status`);
        if (!res.ok) return;
        const data = await res.json() as JobStatus;
        setJobStatus(data);

        if (data.status === "COMPLETE") {
          stopPolling();
          setPhase(4);
        } else if (data.status === "FAILED") {
          stopPolling();
          setSubmitError(data.errorMessage ?? "Generation failed. Please try again.");
          setPhase(2);
        }
      } catch { /* ignore */ }
    }

    poll();
    pollRef.current = setInterval(poll, 4000);
    return stopPolling;
  }, [phase, activeJobId, stopPolling]);

  // ── Upload ref image ───────────────────────────────────────────────────────
  const { startUpload } = useUploadThing("coverArtRef", {
    onUploadBegin:       () => setUploading(true),
    onUploadError:       () => setUploading(false),
    onClientUploadComplete: (res) => {
      setUploading(false);
      const url = res[0]?.url;
      if (url) { setRefImageUrl(url); setRefImageName(res[0]?.name ?? "Reference image"); }
    },
  });

  // ── Submit: create job + Stripe checkout ──────────────────────────────────
  async function handleSubmit() {
    if (!selectedStyle || !prompt.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res  = await fetch("/api/cover-art/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tier,
          styleId:          selectedStyle.id,
          prompt:           prompt.trim(),
          guestEmail,
          referenceImageUrl: refImageUrl ?? undefined,
        }),
      });
      const data = await res.json() as { jobId?: string; url?: string; error?: string };

      if (!res.ok || !data.url) {
        setSubmitError(data.error ?? "Failed to start checkout");
        return;
      }

      window.location.href = data.url;
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Select variation ───────────────────────────────────────────────────────
  async function handleSelectVar(url: string) {
    setSelectedVar(url);
    if (!activeJobId) return;
    await fetch(`/api/cover-art/${activeJobId}/select`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ selectedUrl: url }),
    }).catch(() => {});

    if (tier === "PRO" && (jobStatus?.refinementRound ?? 0) < 1) {
      setPhase(5);
    } else {
      setPhase(6);
    }
  }

  // ── Pro refinement ─────────────────────────────────────────────────────────
  async function handleRefine() {
    if (!activeJobId || !selectedVar || !refInstruction.trim()) return;
    setRefining(true);
    setRefineError(null);

    try {
      const round = (jobStatus?.refinementRound ?? 0) + 1;
      const res   = await fetch(`/api/cover-art/${activeJobId}/refine`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          selectedUrl:            selectedVar,
          refinementInstruction:  refInstruction.trim(),
          round,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setRefineError(data.error ?? "Refinement failed");
        return;
      }
      setRefInstruction("");
      setPhase(3); // back to generating — polling picks up new variations
    } catch {
      setRefineError("Something went wrong. Please try again.");
    } finally {
      setRefining(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleReset() {
    setPhase(0); setTier("STANDARD"); setSelectedStyle(null);
    setPrompt(""); setRefImageUrl(null); setRefImageName(null);
    setActiveJobId(null); setJobStatus(null); setSelectedVar(null);
    setSubmitError(null); setRefInstruction("");
  }

  // ── Filtered styles ────────────────────────────────────────────────────────
  const filteredStyles = categoryFilter === "ALL"
    ? styles
    : styles.filter(s => s.category === categoryFilter);

  const variationCount = TIER_INFO[tier]?.variations ?? 4;
  const latestRefinement = Array.isArray(jobStatus?.refinementHistory) && jobStatus!.refinementHistory.length > 0
    ? jobStatus!.refinementHistory[jobStatus!.refinementHistory.length - 1]
    : null;
  const displayUrls = latestRefinement ? latestRefinement.urls : (jobStatus?.variationUrls ?? []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: "#1A1A1A", backdropFilter: "blur(12px)" }}
      >
        <a href="/cover-art" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Sparkles size={14} style={{ color: "#D4A843" }} />
          </div>
          <span className="text-sm font-bold text-white">Cover Art Studio</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>by IndieThis</span>
        </a>

        {phase > 0 && phase < 3 && (
          <button
            onClick={() => setPhase(prev => Math.max(0, prev - 1) as Phase)}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "#888" }}
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      {phase < 3 && (
        <div className="h-0.5 w-full" style={{ backgroundColor: "#1A1A1A" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${((phase + 1) / 3) * 100}%`, backgroundColor: "#D4A843" }}
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 0 — Tier selection
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">AI Cover Art</h1>
              <p className="text-sm mt-2" style={{ color: "#888" }}>
                Choose your quality tier. All tiers generate in under 2 minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["STANDARD", "PREMIUM", "PRO"] as Tier[]).map(t => {
                const info     = TIER_INFO[t];
                const isSelected = tier === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className="relative rounded-2xl border p-5 text-left transition-all"
                    style={{
                      borderColor:     isSelected ? "#D4A843" : "#2A2A2A",
                      backgroundColor: isSelected ? "rgba(212,168,67,0.06)" : "#111",
                    }}
                  >
                    {info.badge && (
                      <span
                        className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: info.badge === "BEST" ? "#D4A843" : "#2A2A2A",
                          color:           info.badge === "BEST" ? "#0A0A0A" : "#D4A843",
                        }}
                      >
                        {info.badge}
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#D4A843" }}>
                        <Check size={10} style={{ color: "#0A0A0A" }} />
                      </div>
                    )}
                    <p className="text-lg font-black text-white mt-1">{info.label}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: "#D4A843" }}>
                      {pricing[info.priceKey] ?? info.default}
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {info.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#CCC" }}>
                          <Check size={10} style={{ color: "#D4A843" }} /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPhase(1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Choose Style <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 1 — Style picker
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-black text-white">Choose a style</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Each style has a unique look and feel. You can always generate another.
              </p>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: categoryFilter === cat ? "#D4A843" : "#1A1A1A",
                    color:           categoryFilter === cat ? "#0A0A0A" : "#888",
                  }}
                >
                  {cat === "ALL" ? "All" : (CATEGORY_LABELS[cat] ?? cat)}
                </button>
              ))}
            </div>

            {/* Style grid */}
            {styles.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-white/40">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading styles…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {filteredStyles.map(s => {
                  const isSelected = selectedStyle?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s)}
                      className="relative rounded-xl overflow-hidden text-left transition-all"
                      style={{ outline: isSelected ? "2px solid #D4A843" : "2px solid transparent", aspectRatio: "1/1" }}
                    >
                      {s.previewUrl ? (
                        <img
                          src={s.previewUrl}
                          alt={s.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <StylePlaceholder name={s.name} category={s.category} />
                      )}
                      <div
                        className="absolute inset-0 flex flex-col justify-end p-2"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 40%, transparent)" }}
                      >
                        <p className="text-[10px] font-bold text-white leading-tight">{s.name}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#D4A843" }}>
                          <Check size={9} style={{ color: "#0A0A0A" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setPhase(0)} className="flex items-center gap-1.5 text-sm" style={{ color: "#888" }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => setPhase(2)}
                disabled={!selectedStyle}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 2 — Prompt + reference image + pay
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">Describe your vision</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                The more specific you are, the better the result.
              </p>
            </div>

            {/* Style reminder */}
            {selectedStyle && (
              <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#2A2A2A" }}>
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative">
                  {selectedStyle.previewUrl ? (
                    <img src={selectedStyle.previewUrl} alt={selectedStyle.name} className="w-full h-full object-cover" />
                  ) : (
                    <StylePlaceholder name={selectedStyle.name} category={selectedStyle.category} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/50 font-semibold uppercase tracking-wide">Style</p>
                  <p className="text-sm font-bold text-white truncate">{selectedStyle.name}</p>
                </div>
                <button onClick={() => setPhase(1)} className="text-xs" style={{ color: "#D4A843" }}>Change</button>
              </div>
            )}

            {/* Avatar reference (logged-in users) */}
            {userId && (
              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#1E1E1E", backgroundColor: "#111" }}>
                <p className="text-xs font-semibold text-white">Artist Reference</p>
                <p className="text-[11px]" style={{ color: "#666" }}>
                  Use your avatar as a character reference to appear in the cover art.
                </p>
                <AvatarPicker
                  compact
                  label="Artist Reference"
                  selectedUrl={refImageUrl ?? undefined}
                  onSelect={(p: AvatarSelectPayload) => { setRefImageUrl(p.url); setRefImageName("Avatar reference"); }}
                  onUploadUrl={(url: string) => { setRefImageUrl(url); setRefImageName("Uploaded reference"); }}
                />
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Describe your cover art
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, 500))}
                placeholder="e.g. A lone figure on a rooftop at sunset, city skyline glowing orange…"
                rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none resize-none transition-all"
                style={{ borderColor: "#2A2A2A" }}
                onFocus={e => (e.target.style.borderColor = "#D4A843")}
                onBlur={e => (e.target.style.borderColor = "#2A2A2A")}
              />
              <p className="text-[11px] text-right" style={{ color: "#555" }}>{prompt.length}/500</p>
            </div>

            {/* Reference image (Premium/Pro only) */}
            {(tier === "PREMIUM" || tier === "PRO") && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Reference image <span style={{ color: "#D4A843" }}>({tier})</span>
                </label>
                {refImageUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.05)" }}>
                    <img src={refImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    <p className="text-sm text-white flex-1 truncate">{refImageName}</p>
                    <button onClick={() => { setRefImageUrl(null); setRefImageName(null); }} style={{ color: "#888" }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition-colors"
                    style={{ borderColor: uploading ? "#D4A843" : "#2A2A2A" }}
                  >
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" style={{ color: "#D4A843" }} />
                        <span className="text-sm" style={{ color: "#D4A843" }}>Uploading…</span></>
                    ) : (
                      <><Upload size={16} style={{ color: "#888" }} />
                        <span className="text-sm" style={{ color: "#888" }}>Upload reference image (PNG, JPG, max 16MB)</span></>
                    )}
                    <input
                      ref={refInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) startUpload([file]);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: "#E85D4A", backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A" }}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setPhase(1)} className="flex items-center gap-1.5 text-sm" style={{ color: "#888" }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                  : <><Sparkles size={14} /> Pay & Generate — {pricing[TIER_INFO[tier].priceKey] ?? TIER_INFO[tier].default}</>}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 3 — Generating
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 3 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: variationCount }).map((_, i) => (
                <div
                  key={i}
                  className="w-16 h-16 rounded-xl animate-pulse"
                  style={{ backgroundColor: "#1A1A1A", animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">Generating your cover art…</p>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                This usually takes 60–90 seconds. Don&apos;t close this tab.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "#888" }}>
              <Loader2 size={16} className="animate-spin" />
              <span>AI is composing {variationCount} variations</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 4 — Variation grid
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">Choose your favourite</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Select one variation. Pro artists can refine it further.
              </p>
            </div>

            <div className={`grid gap-4 ${variationCount === 8 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
              {displayUrls.map((url, i) => (
                <VariationCard
                  key={i}
                  url={url}
                  selected={selectedVar === url}
                  onSelect={() => handleSelectVar(url)}
                  onFullscreen={() => setPreviewUrl(url)}
                />
              ))}
            </div>

            {selectedVar && (
              <div className="flex justify-end gap-3">
                {tier === "PRO" && (jobStatus?.refinementRound ?? 0) < 1 && (
                  <button
                    onClick={() => setPhase(5)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: "#D4A843", color: "#D4A843" }}
                  >
                    <Star size={14} /> Refine it
                  </button>
                )}
                <button
                  onClick={() => setPhase(6)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  Use this one <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 5 — Pro refinement
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">Refine your selection</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Tell the AI exactly what to change and it will regenerate 4 new variations.
              </p>
            </div>

            {selectedVar && (
              <div className="max-w-48">
                <img src={selectedVar} alt="" className="w-full rounded-2xl aspect-square object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#888" }}>
                What would you like to change?
              </label>
              <textarea
                value={refInstruction}
                onChange={e => setRefInstruction(e.target.value.slice(0, 300))}
                placeholder="e.g. Make it darker, add more purple tones, remove the text…"
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none resize-none"
                style={{ borderColor: "#2A2A2A" }}
                onFocus={e => (e.target.style.borderColor = "#D4A843")}
                onBlur={e => (e.target.style.borderColor = "#2A2A2A")}
              />
              <p className="text-[11px] text-right" style={{ color: "#555" }}>{refInstruction.length}/300</p>
            </div>

            {refineError && (
              <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: "#E85D4A", backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A" }}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {refineError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setPhase(6)} className="text-sm" style={{ color: "#888" }}>
                Skip refinement
              </button>
              <button
                onClick={handleRefine}
                disabled={!refInstruction.trim() || refining}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {refining ? <><Loader2 size={14} className="animate-spin" /> Refining…</>
                  : <><RefreshCw size={14} /> Generate Refinement</>}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 6 — Final
            ════════════════════════════════════════════════════════════════════ */}
        {phase === 6 && selectedVar && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">Your cover art is ready</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Download it, or explore more IndieThis tools.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {/* Large preview */}
              <div className="relative rounded-2xl overflow-hidden aspect-square">
                <img src={selectedVar} alt="" className="w-full h-full object-cover" />
                <div
                  className="absolute bottom-0 inset-x-0 px-4 py-5 text-center"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 60%, transparent)" }}
                >
                  <p className="text-white font-black text-lg leading-tight">Your Track</p>
                  {artistName && <p className="text-white/60 text-sm mt-0.5">{artistName}</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <a
                  href={selectedVar}
                  download="cover-art.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold w-full justify-center"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <Download size={14} /> Download Cover Art
                </a>

                <a
                  href={`/video-studio?coverArtUrl=${encodeURIComponent(selectedVar)}`}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border w-full justify-center transition hover:opacity-80"
                  style={{ borderColor: "#2A2A2A", color: "#CCC" }}
                >
                  <Film size={14} style={{ color: "#A78BFA" }} /> Make a Music Video
                </a>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border w-full justify-center transition hover:opacity-80"
                  style={{ borderColor: "#2A2A2A", color: "#CCC" }}
                >
                  <RefreshCw size={14} /> Generate Another
                </button>

                {/* Subscribe CTA */}
                <div
                  className="rounded-xl border p-4 space-y-2"
                  style={{ borderColor: "#2A2A2A", backgroundColor: "rgba(212,168,67,0.05)" }}
                >
                  <p className="text-sm font-bold text-white">Want more for free?</p>
                  <p className="text-xs" style={{ color: "#888" }}>
                    Subscribers get monthly cover art credits, AI mastering, bio generator, press kit tools, and more.
                  </p>
                  <a
                    href="/pricing"
                    className="flex items-center gap-1.5 text-xs font-bold transition"
                    style={{ color: "#D4A843" }}
                  >
                    View plans <ChevronRight size={12} />
                  </a>
                </div>

                {/* Explore link */}
                <a
                  href="/explore"
                  className="flex items-center gap-1.5 text-xs justify-center transition hover:opacity-80"
                  style={{ color: "#666" }}
                >
                  <Music2 size={12} /> Explore IndieThis artists
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Fullscreen preview ─────────────────────────────────────────────── */}
      {previewUrl && (
        <FullscreenPreview
          url={previewUrl}
          artistName={artistName}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}
