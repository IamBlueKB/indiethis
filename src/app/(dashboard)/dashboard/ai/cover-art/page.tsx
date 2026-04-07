"use client";

/**
 * /dashboard/ai/cover-art — Cover Art Studio (subscriber version)
 *
 * Multi-phase wizard:
 *   Phase 0 — Tier selection (Standard / Premium / Pro)
 *   Phase 1 — Style picker (15 presets, category filter tabs)
 *   Phase 2 — Track + prompt + reference image
 *   Phase 3 — Generating (polling)
 *   Phase 4 — Variation grid + selection
 *   Phase 5 — Pro: refinement round UI
 *   Phase 6 — Final actions (download, Canvas Video, Music Video, track cover)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter }                from "next/navigation";
import {
  Sparkles, Download, Loader2, AlertCircle, RotateCcw,
  Check, X, ZoomIn, ChevronRight, ChevronLeft, Film,
  Music2, Wand2, Star, Image as ImageIcon, Upload,
  RefreshCw, Play, ExternalLink,
} from "lucide-react";
import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import { CATEGORY_LABELS } from "@/lib/cover-art/styles-seed";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier   = "STANDARD" | "PREMIUM" | "PRO";
type Phase  = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
  prompt?:           string;
  createdAt?:        string;
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

interface CreditInfo {
  used:  number;
  limit: number;
  left:  number;
  tier:  string;
}

interface PricingInfo {
  STANDARD: string;
  PREMIUM:  string;
  PRO:      string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_INFO = {
  STANDARD: {
    label:      "Standard",
    badge:      null,
    price_key:  "STANDARD",
    variations: 4,
    features:   ["4 variations", "Genre-matched prompt", "Uses monthly credit or $4.99"],
  },
  PREMIUM: {
    label:      "Premium",
    badge:      "POPULAR",
    price_key:  "PREMIUM",
    variations: 8,
    features:   ["8 variations", "Reference image upload", "Higher quality model"],
  },
  PRO: {
    label:      "Pro",
    badge:      "BEST",
    price_key:  "PRO",
    variations: 8,
    features:   ["8 variations", "2 refinement rounds", "Art director experience"],
  },
} as const;

const ALL_CATEGORIES = ["ALL", "MINIMAL", "DARK", "VIBRANT", "CLASSIC", "EXPERIMENTAL"] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoverArtStudioPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Phase + wizard state ──────────────────────────────────────────────────
  const [phase,          setPhase]          = useState<Phase>(0);
  const [tier,           setTier]           = useState<Tier>("STANDARD");
  const [selectedStyle,  setSelectedStyle]  = useState<StyleItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [prompt,         setPrompt]         = useState("");
  const [trackId,        setTrackId]        = useState<string | null>(null);
  const [refImageUrl,    setRefImageUrl]    = useState<string | null>(null);
  const [refImageName,   setRefImageName]   = useState<string | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  // ── Styles ────────────────────────────────────────────────────────────────
  const [styles, setStyles] = useState<StyleItem[]>([]);

  // ── Track list ────────────────────────────────────────────────────────────
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);

  // ── Generation state ──────────────────────────────────────────────────────
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [activeJobId,   setActiveJobId]   = useState<string | null>(null);
  const [jobStatus,     setJobStatus]     = useState<JobStatus | null>(null);
  const [selectedVar,   setSelectedVar]   = useState<string | null>(null);

  // ── Pro refinement ────────────────────────────────────────────────────────
  const [refInstruction, setRefInstruction] = useState("");
  const [refining,       setRefining]       = useState(false);
  const [refineError,    setRefineError]    = useState<string | null>(null);

  // ── Fullscreen preview ────────────────────────────────────────────────────
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  // ── Credits / pricing ─────────────────────────────────────────────────────
  const [credits,  setCredits]  = useState<CreditInfo | null>(null);
  const [pricing,  setPricing]  = useState<PricingInfo>({
    STANDARD: PRICING_DEFAULTS.AI_COVER_ART_STANDARD.display,
    PREMIUM:  PRICING_DEFAULTS.AI_COVER_ART_PREMIUM.display,
    PRO:      PRICING_DEFAULTS.AI_COVER_ART_PRO.display,
  });

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<JobStatus[]>([]);

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    // Styles
    fetch("/api/cover-art/styles")
      .then(r => r.ok ? r.json() : { styles: [] })
      .then(d => setStyles(d.styles ?? []));

    // History + credits + pricing
    fetch("/api/dashboard/ai/cover-art")
      .then(r => r.ok ? r.json() : {})
      .then((d: { jobs?: JobStatus[]; credits?: CreditInfo; pricing?: PricingInfo }) => {
        setHistory(d.jobs ?? []);
        setCredits(d.credits ?? null);
        if (d.pricing) setPricing(d.pricing);
      });

    // Track list
    fetch("/api/dashboard/tracks")
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then((d: { tracks?: { id: string; title: string }[] }) =>
        setTracks((d.tracks ?? []).map(t => ({ id: t.id, title: t.title })))
      );
  }, []);

  // ── Handle return from Stripe checkout ─────────────────────────────────
  useEffect(() => {
    const paid  = searchParams.get("paid");
    const jobId = searchParams.get("jobId");
    if (paid !== "1" || !jobId) return;

    // Mark this job as started (priceAlreadyCharged = true)
    fetch("/api/dashboard/ai/cover-art", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ priceAlreadyCharged: true, jobId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.jobId) {
          setActiveJobId(d.jobId);
          setPhase(3);
        }
      })
      .catch(console.error);

    // Clean URL
    router.replace("/dashboard/ai/cover-art");
  }, [searchParams, router]);

  // ── Polling ───────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!activeJobId) return;
    try {
      const res = await fetch(`/api/cover-art/${activeJobId}/status`);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJobStatus(data);

      if (data.status === "COMPLETE") {
        if (data.refinementRound > 0) {
          // Returned from refinement — show new variations
          setPhase(5);
        } else {
          setPhase(4);
        }
      } else if (data.status === "FAILED") {
        setPhase(3); // stays on generating phase to show error
      }
    } catch { /* transient */ }
  }, [activeJobId]);

  useEffect(() => {
    if (!activeJobId) return;
    if (jobStatus?.status === "COMPLETE" || jobStatus?.status === "FAILED") return;
    const t = setInterval(poll, 4000);
    poll(); // immediate first poll
    return () => clearInterval(t);
  }, [activeJobId, jobStatus?.status, poll]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!prompt.trim() || !selectedStyle) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res  = await fetch("/api/dashboard/ai/cover-art", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tier,
          styleId:           selectedStyle.id,
          prompt:            prompt.trim(),
          trackId:           trackId ?? undefined,
          referenceImageUrl: refImageUrl ?? undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to start generation");
        return;
      }

      if (data.requiresPayment && data.url) {
        window.location.href = data.url;
        return;
      }

      setActiveJobId(data.jobId);
      setPhase(3);
    } catch {
      setSubmitError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Select variation ──────────────────────────────────────────────────────
  async function handleSelectVariation(url: string) {
    setSelectedVar(url);
    if (!activeJobId) return;
    await fetch(`/api/dashboard/ai/cover-art/${activeJobId}/select`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ selectedUrl: url }),
    });

    if (tier === "PRO" && jobStatus && jobStatus.refinementRound < 2) {
      setPhase(5); // go to refinement
    } else {
      setPhase(6); // go to final actions
    }
  }

  // ── Handle refinement variation selection (during refine phase) ──────────
  async function handleSelectRefinementVar(url: string, round: number) {
    setSelectedVar(url);
    if (!activeJobId) return;
    await fetch(`/api/dashboard/ai/cover-art/${activeJobId}/select`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ selectedUrl: url, round }),
    });

    const currentRound = jobStatus?.refinementRound ?? 0;
    if (currentRound < 2) {
      // Can still do one more refinement round — stay on phase 5
      setJobStatus(prev => prev ? { ...prev, selectedUrl: url } : null);
    } else {
      setPhase(6);
    }
  }

  // ── Start refinement round ────────────────────────────────────────────────
  async function handleRefine(round: number) {
    if (!refInstruction.trim() || !selectedVar || !activeJobId) return;
    setRefining(true);
    setRefineError(null);

    try {
      const res = await fetch(`/api/dashboard/ai/cover-art/${activeJobId}/refine`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          selectedUrl:            selectedVar,
          refinementInstruction:  refInstruction.trim(),
          round,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRefineError(data.error ?? "Failed to refine"); return; }

      // Back to generating while we wait
      setJobStatus(prev => prev ? { ...prev, status: "GENERATING" } : null);
      setPhase(3);
      setRefInstruction("");
    } catch {
      setRefineError("Connection error. Please try again.");
    } finally {
      setRefining(false);
    }
  }

  // ── Set as track cover ────────────────────────────────────────────────────
  async function handleSetTrackCover() {
    if (!activeJobId || !selectedVar || !trackId) return;
    await fetch(`/api/dashboard/ai/cover-art/${activeJobId}/select`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ selectedUrl: selectedVar, setAsTrackCover: true }),
    });
  }

  // ── Reference image upload ────────────────────────────────────────────────
  async function handleRefImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Use a FormData upload to UploadThing
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploadthing/cover-art-ref", {
        method: "POST",
        body:   formData,
      });
      if (res.ok) {
        const d = await res.json() as { url?: string; ufsUrl?: string };
        const url = d.ufsUrl ?? d.url;
        if (url) {
          setRefImageUrl(url);
          setRefImageName(file.name);
        }
      }
    } catch {
      // silent — user can proceed without reference image
    } finally {
      setUploading(false);
    }
  }

  // ── Reset to start new generation ────────────────────────────────────────
  function handleReset() {
    setPhase(0);
    setSelectedStyle(null);
    setPrompt("");
    setTrackId(null);
    setRefImageUrl(null);
    setRefImageName(null);
    setActiveJobId(null);
    setJobStatus(null);
    setSelectedVar(null);
    setRefInstruction("");
    setSubmitError(null);
    // Reload history
    fetch("/api/dashboard/ai/cover-art")
      .then(r => r.ok ? r.json() : {})
      .then((d: { jobs?: JobStatus[] }) => setHistory(d.jobs ?? []));
  }

  // ── Filtered styles ───────────────────────────────────────────────────────
  const filteredStyles = categoryFilter === "ALL"
    ? styles
    : styles.filter(s => s.category === categoryFilter);

  // ── Current refinement round data ─────────────────────────────────────────
  const currentRound    = jobStatus?.refinementRound ?? 0;
  const latestRefinement = Array.isArray(jobStatus?.refinementHistory) && jobStatus!.refinementHistory.length > 0
    ? jobStatus!.refinementHistory[jobStatus!.refinementHistory.length - 1]
    : null;

  const displayVariations = latestRefinement?.urls ?? jobStatus?.variationUrls ?? [];

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cover Art Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered album cover art with genre-matched prompt enhancement.
          </p>
        </div>
        {phase > 0 && phase < 6 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            <RotateCcw size={12} /> Start over
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 0 — Tier Selection
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 0 && (
        <div className="space-y-5">
          <p className="text-sm font-semibold" style={{ color: "#888" }}>
            Choose your tier
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["STANDARD", "PREMIUM", "PRO"] as Tier[]).map(t => {
              const info      = TIER_INFO[t];
              const isSelected = tier === t;
              const priceDisplay = pricing[t];
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="relative text-left rounded-2xl border p-5 transition-all flex flex-col gap-3"
                  style={{
                    borderColor:     isSelected ? "#D4A843" : "var(--border)",
                    backgroundColor: isSelected ? "rgba(212,168,67,0.06)" : "var(--card)",
                    boxShadow:       isSelected ? "0 0 0 1px rgba(212,168,67,0.25)" : "none",
                  }}
                >
                  {info.badge && (
                    <span
                      className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: info.badge === "BEST" ? "rgba(232,93,74,0.15)" : "rgba(212,168,67,0.15)",
                        color:           info.badge === "BEST" ? "#E85D4A" : "#D4A843",
                      }}
                    >
                      {info.badge}
                    </span>
                  )}
                  <div>
                    <p className="text-base font-bold" style={{ color: isSelected ? "#D4A843" : "var(--foreground)" }}>
                      {info.label}
                    </p>
                    <p className="text-lg font-black mt-0.5" style={{ color: isSelected ? "#D4A843" : "var(--foreground)" }}>
                      {priceDisplay}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {info.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "#888" }}>
                        <Check size={10} style={{ color: isSelected ? "#D4A843" : "#555" }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isSelected && (
                    <div className="mt-auto pt-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
                        <Check size={11} style={{ color: "#0A0A0A" }} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Credit notice for Standard */}
          {tier === "STANDARD" && credits && credits.left > 0 && (
            <p className="text-xs" style={{ color: "#888" }}>
              You have <span style={{ color: "#D4A843" }}>{credits.left} free generation{credits.left !== 1 ? "s" : ""}</span> remaining this month.
            </p>
          )}

          <button
            onClick={() => setPhase(1)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Choose Style <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 1 — Style Picker
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 1 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase(0)} className="text-muted-foreground hover:text-foreground transition">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p className="text-sm font-semibold text-foreground">Choose a style</p>
              <p className="text-xs text-muted-foreground">This becomes the visual DNA of your cover art.</p>
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: categoryFilter === cat ? "#D4A843" : "var(--card)",
                  color:           categoryFilter === cat ? "#0A0A0A" : "var(--muted-foreground)",
                  border:          `1px solid ${categoryFilter === cat ? "#D4A843" : "var(--border)"}`,
                }}
              >
                {cat === "ALL" ? "All" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Style grid — 5 cols desktop, 3 tablet, 2 mobile */}
          {styles.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 size={20} className="animate-spin mx-auto mb-3" style={{ color: "#D4A843" }} />
              <p className="text-sm text-muted-foreground">Loading styles…</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredStyles.map(style => {
                const isSelected = selectedStyle?.id === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className="group relative rounded-xl overflow-hidden aspect-square transition-all"
                    style={{
                      outline:        isSelected ? "2px solid #D4A843" : "2px solid transparent",
                      outlineOffset:  "2px",
                      boxShadow:      isSelected ? "0 0 0 3px rgba(212,168,67,0.2)" : "none",
                    }}
                  >
                    {style.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={style.previewUrl}
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: "#1A1A1A" }}
                      >
                        <ImageIcon size={24} style={{ color: "#444" }} />
                      </div>
                    )}

                    {/* Hover overlay with style name */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-end p-2 transition-opacity"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)",
                        opacity:    isSelected ? 1 : 0,
                      }}
                    >
                      <p className="text-xs font-semibold text-white text-center leading-tight">{style.name}</p>
                    </div>

                    {/* Always-visible name label below */}
                    <style>{`.style-hover-${style.id}:hover .style-overlay-${style.id} { opacity: 1 !important; }`}</style>

                    {/* Selected check */}
                    {isSelected && (
                      <div
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#D4A843" }}
                      >
                        <Check size={10} style={{ color: "#0A0A0A" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Style name labels row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredStyles.map(style => (
              <p
                key={style.id}
                className="text-[10px] text-center font-medium truncate"
                style={{ color: selectedStyle?.id === style.id ? "#D4A843" : "var(--muted-foreground)" }}
              >
                {style.name}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            {selectedStyle && (
              <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                ✓ {selectedStyle.name} selected
              </p>
            )}
            <button
              onClick={() => { if (selectedStyle) setPhase(2); }}
              disabled={!selectedStyle}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ml-auto"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Describe Your Vision <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 2 — Track + Prompt + Reference Image
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase(1)} className="text-muted-foreground hover:text-foreground transition">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p className="text-sm font-semibold text-foreground">Describe your vision</p>
              <p className="text-xs text-muted-foreground">
                Style: <span style={{ color: "#D4A843" }}>{selectedStyle?.name}</span> · Tier: {tier.charAt(0) + tier.slice(1).toLowerCase()}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>

            {/* Track selection */}
            {tracks.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Link to a track <span className="normal-case font-normal text-muted-foreground">(optional — improves prompt)</span>
                </label>
                <select
                  value={trackId ?? ""}
                  onChange={e => setTrackId(e.target.value || null)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">No track selected</option>
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Vision prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Describe your cover art *
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="A lone figure standing on a rooftop at sunset, city skyline behind them, orange and purple sky…"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-yellow-400/30 resize-none"
                style={{ borderColor: "var(--border)" }}
              />
              <p className="text-right text-[10px] text-muted-foreground">{prompt.length}/500</p>
            </div>

            {/* Reference image — Premium / Pro only */}
            {(tier === "PREMIUM" || tier === "PRO") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference image <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  A photo of yourself, a mood image, or existing artwork. The AI draws inspiration from it at 40% influence — not a copy.
                </p>
                {refImageUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={refImageUrl} alt="Reference" className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{refImageName}</p>
                      <p className="text-xs text-muted-foreground">Will guide the AI's composition</p>
                    </div>
                    <button
                      onClick={() => { setRefImageUrl(null); setRefImageName(null); }}
                      className="text-muted-foreground hover:text-foreground transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => refInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-40"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Uploading…" : "Upload reference image (JPG, PNG, WebP · max 10MB)"}
                  </button>
                )}
                <input
                  ref={refInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleRefImageUpload}
                />
              </div>
            )}

            {submitError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} /> {submitError}
              </p>
            )}

            {/* Generate button */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {tier === "STANDARD" && credits && credits.left > 0
                  ? `Uses 1 of your ${credits.left} remaining monthly credits`
                  : `${pricing[tier]} — pay per use`
                }
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting || !prompt.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
                  : <><Sparkles size={14} /> Generate Cover Art — {pricing[tier]}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 3 — Generating
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 3 && (
        <div className="rounded-2xl border p-8 flex flex-col items-center gap-5 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {jobStatus?.status === "FAILED" ? (
            <>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(232,93,74,0.1)" }}>
                <AlertCircle size={24} style={{ color: "#E85D4A" }} />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Generation failed</p>
                <p className="text-sm text-muted-foreground mt-1">{jobStatus.errorMessage ?? "Something went wrong. Please try again."}</p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <RefreshCw size={13} /> Try Again
              </button>
            </>
          ) : (
            <>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
              >
                <Sparkles size={26} style={{ color: "#D4A843" }} className="animate-pulse" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                  <Loader2 size={11} className="animate-spin" />
                  {jobStatus?.refinementRound ? `Refining — Round ${jobStatus.refinementRound}…` : "AI is generating your cover art"}
                </div>
                <p className="text-lg font-bold text-foreground">
                  {jobStatus?.refinementRound ? "Applying your refinements" : `Creating ${tier === "STANDARD" ? 4 : 8} variations`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Claude is optimizing your prompt, then generating images in parallel. ~30–60 seconds.
                </p>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: tier === "STANDARD" ? 4 : 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-lg animate-pulse"
                    style={{ backgroundColor: "#1A1A1A", animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">You can stay on this page — it will update automatically.</p>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 4 — Variation Grid + Selection
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 4 && jobStatus && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-foreground">Choose your favorite</p>
              <p className="text-sm text-muted-foreground">
                {jobStatus.variationUrls.length} variations generated · Tap to preview, then select.
              </p>
            </div>
            <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RotateCcw size={11} /> New generation
            </button>
          </div>

          {/* 2×2 or 2×4 grid */}
          <div className={`grid gap-4 ${tier === "STANDARD" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
            {jobStatus.variationUrls.map((url, i) => (
              <VariationCard
                key={i}
                url={url}
                index={i}
                isSelected={selectedVar === url}
                onPreview={() => setPreviewUrl(url)}
                onSelect={() => handleSelectVariation(url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 5 — Pro Refinement Round
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 5 && jobStatus && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ borderColor: "rgba(212,168,67,0.3)", backgroundColor: "rgba(212,168,67,0.04)" }}>
            <Star size={16} style={{ color: "#D4A843" }} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold" style={{ color: "#D4A843" }}>
                Pro Refinement — Round {currentRound + 1} of 2
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select your current favorite, describe what you want changed, and get 4 more targeted variations.
              </p>
            </div>
          </div>

          {/* Show current variations to select from */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {latestRefinement ? `Round ${latestRefinement.round} results — pick your favorite to refine` : "Initial variations — pick your favorite to refine"}
            </p>
            <div className={`grid gap-3 ${displayVariations.length <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
              {displayVariations.map((url, i) => (
                <VariationCard
                  key={i}
                  url={url}
                  index={i}
                  isSelected={selectedVar === url}
                  onPreview={() => setPreviewUrl(url)}
                  onSelect={() => setSelectedVar(url)}
                  selectLabel="Use this"
                />
              ))}
            </div>
          </div>

          {/* Refinement instruction */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What would you like to change?
              </label>
              <input
                type="text"
                value={refInstruction}
                onChange={e => setRefInstruction(e.target.value)}
                placeholder="Make it darker, add more contrast, zoom in on the face, change sky to deep purple…"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-yellow-400/30"
                style={{ borderColor: "var(--border)" }}
                disabled={refining}
              />
            </div>
            {refineError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={11} /> {refineError}</p>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPhase(6)}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Skip refinement → use current
              </button>
              <button
                onClick={() => handleRefine(currentRound + 1)}
                disabled={refining || !refInstruction.trim() || !selectedVar}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {refining
                  ? <><Loader2 size={13} className="animate-spin" /> Refining…</>
                  : <><Wand2 size={13} /> Refine — Round {currentRound + 1} of 2</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 6 — Final Actions
          ════════════════════════════════════════════════════════════════════════ */}
      {phase === 6 && selectedVar && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
            >
              <Check size={18} style={{ color: "#34C759" }} />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Your cover art is ready</p>
              <p className="text-sm text-muted-foreground">Download it or connect it to your next creative step.</p>
            </div>
          </div>

          {/* Selected cover art large preview */}
          <div className="flex gap-6 items-start">
            <div className="relative shrink-0 group cursor-pointer" onClick={() => setPreviewUrl(selectedVar)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedVar}
                alt="Selected cover art"
                className="w-48 h-48 rounded-2xl object-cover border"
                style={{ borderColor: "var(--border)" }}
              />
              <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <ZoomIn size={20} style={{ color: "#fff" }} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 flex-1">
              <a
                href={selectedVar}
                download="cover-art.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <Download size={14} /> Download Cover Art
              </a>

              <a
                href={`/dashboard/ai/canvas?refImageUrl=${encodeURIComponent(selectedVar)}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Play size={14} style={{ color: "#D4A843" }} /> Use for Canvas Video — $1.99
              </a>

              <a
                href={`/video-studio?coverArtUrl=${encodeURIComponent(selectedVar)}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Film size={14} style={{ color: "#A78BFA" }} /> Use for Music Video
              </a>

              {trackId && (
                <button
                  onClick={handleSetTrackCover}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Music2 size={14} style={{ color: "#60A5FA" }} /> Set as Track Cover
                </button>
              )}

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mt-1"
              >
                <RotateCcw size={11} /> Generate another cover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          HISTORY — shown when not generating
          ════════════════════════════════════════════════════════════════════════ */}
      {(phase === 0) && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Generations</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.slice(0, 5).map((job, idx) => {
              const urls = (job.variationUrls ?? []) as string[];
              return (
                <div
                  key={job.id}
                  className="p-4 border-b last:border-b-0 flex items-start gap-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Thumbnail strip */}
                  {urls.length > 0 && (
                    <div className="flex gap-1.5 shrink-0">
                      {urls.slice(0, 4).map((url, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                          style={{ opacity: job.selectedUrl === url ? 1 : 0.6 }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{job.prompt ?? "Cover art"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {job.tier} · {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  {job.selectedUrl && (
                    <a
                      href={job.selectedUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition shrink-0"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          FULLSCREEN PREVIEW
          ════════════════════════════════════════════════════════════════════════ */}
      {previewUrl && (
        <FullscreenPreview
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VariationCard({
  url,
  index,
  isSelected,
  onPreview,
  onSelect,
  selectLabel = "Select",
}: {
  url:          string;
  index:        number;
  isSelected:   boolean;
  onPreview:    () => void;
  onSelect:     () => void;
  selectLabel?: string;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border transition-all"
      style={{
        borderColor:     isSelected ? "#D4A843" : "var(--border)",
        boxShadow:       isSelected ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
      }}
    >
      {/* Image */}
      <div className="relative group aspect-square cursor-pointer" onClick={onPreview}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Variation ${index + 1}`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          <ZoomIn size={18} style={{ color: "#fff" }} />
        </div>
        {isSelected && (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#D4A843" }}
          >
            <Check size={12} style={{ color: "#0A0A0A" }} />
          </div>
        )}
      </div>

      {/* Select button */}
      <button
        onClick={onSelect}
        className="w-full py-2 text-xs font-semibold transition-all"
        style={{
          backgroundColor: isSelected ? "#D4A843" : "var(--card)",
          color:           isSelected ? "#0A0A0A" : "var(--muted-foreground)",
        }}
      >
        {isSelected ? <span className="flex items-center justify-center gap-1"><Check size={10} /> Selected</span> : selectLabel}
      </button>
    </div>
  );
}

function FullscreenPreview({
  url,
  onClose,
}: {
  url:     string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-xl w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Full preview"
          className="w-full rounded-2xl shadow-2xl"
        />

        {/* Simulated album cover text overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-2xl p-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
        >
          <p className="text-white font-black text-xl leading-tight">Track Title</p>
          <p className="text-white/70 text-sm font-medium mt-0.5">Artist Name</p>
        </div>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex gap-2">
          <a
            href={url}
            download="cover-art.png"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          >
            <Download size={14} style={{ color: "#fff" }} />
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <X size={14} style={{ color: "#fff" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
