"use client";

/**
 * /dashboard/merch/create
 *
 * Step 4 of the merch build: design upload + mockup preview.
 *
 * Wizard steps:
 *   1 — Pick product from curated catalog
 *   2 — Upload design, select placement, position on product
 *   3 — Generate + approve mockup
 *
 * Steps 4–6 (variants, pricing, publish) are added in Step 5 of the build.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Search, Loader2, CheckCircle2, ImageIcon, RefreshCw,
  ArrowRight, ArrowLeft, Upload, X,
} from "lucide-react";
import { useMerchCatalog, type CatalogEntry } from "@/hooks/queries";
import { useUploadThing } from "@/lib/uploadthing-client";
import DesignPositioner, { type PrintPosition } from "@/components/merch/DesignPositioner";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "All",
  "T-Shirts",
  "Hoodies & Sweatshirts",
  "Hats",
  "Posters & Art Prints",
  "Mugs",
  "Phone Cases",
  "Stickers & Accessories",
] as const;

type Placement = "front" | "back" | "front_and_back";

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "front",         label: "Front" },
  { value: "back",          label: "Back"  },
  { value: "front_and_back", label: "Front & Back" },
];

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Choose Product", "Upload Design", "Preview Mockup"];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const n      = (i + 1) as 1 | 2 | 3;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  backgroundColor: done || active ? "#D4A843"         : "var(--background)",
                  color:           done || active ? "#0A0A0A"          : "var(--muted-foreground)",
                  border:          done || active ? "none"             : "1px solid var(--border)",
                }}
              >
                {done ? <CheckCircle2 size={12} /> : n}
              </div>
              <span
                className="text-xs font-semibold hidden sm:block"
                style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-px mx-2"
                style={{ backgroundColor: done ? "#D4A843" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchCreatePage() {
  const router = useRouter();

  const [step,      setStep     ] = useState<1 | 2 | 3>(1);

  // Step 1
  const [selected,       setSelected      ] = useState<CatalogEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search,         setSearch        ] = useState("");

  // Step 2
  const [designUrl,     setDesignUrl    ] = useState("");
  const [placement,     setPlacement    ] = useState<Placement>("front");
  const [printPosition, setPrintPosition] = useState<PrintPosition | null>(null);
  const [uploadError,   setUploadError  ] = useState("");

  // Step 3
  const [mockups,         setMockups        ] = useState<{ placement: string; url: string }[]>([]);
  const [mockupLoading,   setMockupLoading  ] = useState(false);
  const [mockupError,     setMockupError    ] = useState("");
  const [mockupGenerated, setMockupGenerated] = useState(false);

  // Catalog data
  const { data: catalog = [], isLoading: loadingCatalog } = useMerchCatalog(true);

  const filtered = catalog.filter((e) => {
    const matchCat    = categoryFilter === "All" || e.category === categoryFilter;
    const matchSearch = !search || e.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── UploadThing ─────────────────────────────────────────────────────────
  const { startUpload, isUploading } = useUploadThing("merchDesign", {
    onClientUploadComplete: (files) => {
      const url = files[0]?.url;
      if (url) { setDesignUrl(url); setUploadError(""); }
    },
    onUploadError: (err) => {
      setUploadError(err.message ?? "Upload failed. Please try again.");
    },
  });

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  function selectProduct(entry: CatalogEntry) {
    setSelected(entry);
    setStep(2);
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setUploadError("Only PNG or JPG files are supported.");
      return;
    }
    setUploadError("");
    startUpload([file]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setUploadError("Only PNG or JPG files are supported.");
      return;
    }
    setUploadError("");
    startUpload([file]);
  }

  const handlePositionChange = useCallback((pos: PrintPosition) => {
    setPrintPosition(pos);
  }, []);

  // ── Step 3 handlers ──────────────────────────────────────────────────────
  async function generateMockup() {
    if (!selected || !designUrl) return;
    setMockupLoading(true);
    setMockupError("");
    setMockups([]);

    // Pick up to 5 representative variant IDs (first of each unique color)
    const representativeIds = selected.variants
      .filter((v, i, arr) => arr.findIndex((x) => x.color === v.color) === i)
      .slice(0, 5)
      .map((v) => v.id);

    try {
      const res = await fetch("/api/merch/mockup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          printfulProductId: selected.printfulProductId,
          variantIds:        representativeIds,
          designUrl,
          placement,
          position:          printPosition ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate mockup");
      }

      const data = await res.json() as { mockups: { placement: string; url: string }[] };
      setMockups(data.mockups);
      setMockupGenerated(true);
    } catch (err) {
      setMockupError(err instanceof Error ? err.message : "Mockup generation failed.");
    } finally {
      setMockupLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => step === 1 ? router.push("/dashboard/merch") : setStep((s) => (s - 1) as 1 | 2 | 3)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Merch Product</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Print-on-demand — Printful fulfills every order</p>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* ── Step 1: Pick product ─────────────────────────────────────────── */}
        {step === 1 && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-bold text-foreground">Choose a product type</h2>

              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm outline-none"
                  style={{
                    backgroundColor: "var(--background)",
                    borderColor:     "var(--border)",
                    color:           "var(--foreground)",
                  }}
                />
              </div>

              {/* Category pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
                    style={
                      categoryFilter === cat
                        ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                        : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product grid */}
            <div className="p-5">
              {loadingCatalog ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
                  <p className="text-xs text-muted-foreground">Loading catalog…</p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">No products match.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filtered.map((entry) => (
                    <button
                      key={entry.printfulProductId}
                      onClick={() => selectProduct(entry)}
                      className="text-left rounded-2xl border overflow-hidden transition-all hover:border-accent group"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.image}
                        alt={entry.label}
                        className="w-full aspect-square object-cover group-hover:opacity-85 transition-opacity"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3C/svg%3E";
                        }}
                      />
                      <div className="p-3 space-y-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                          {entry.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{entry.variantCount} variants</p>
                        {entry.variants[0] && (
                          <p className="text-xs font-bold" style={{ color: "#D4A843" }}>
                            From ${parseFloat(entry.variants[0].price).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Upload + position ────────────────────────────────────── */}
        {step === 2 && selected && (
          <div className="space-y-5">

            {/* Selected product reminder */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image}
                alt={selected.label}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3C/svg%3E";
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{selected.label}</p>
                <p className="text-xs text-muted-foreground">{selected.category}</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline shrink-0"
              >
                Change
              </button>
            </div>

            {/* Two-column layout: positioner + controls */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_280px]">

              {/* Left: Design positioner */}
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold text-foreground">Position your design</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Drag to move · corner handle to resize</p>
                </div>
                <div className="p-3">
                  <DesignPositioner
                    productImage={selected.image}
                    designUrl={designUrl}
                    onChange={handlePositionChange}
                  />
                </div>
              </div>

              {/* Right: Upload + placement */}
              <div className="space-y-4">

                {/* Design upload zone */}
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold text-foreground">Upload design</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">PNG or JPG · 300 DPI+ · max 50MB</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {designUrl ? (
                      <div className="space-y-2">
                        {/* Preview */}
                        <div
                          className="w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: "var(--background)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={designUrl}
                            alt="Uploaded design"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        {/* Replace button */}
                        <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                          style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                          <RefreshCw size={12} /> Replace design
                          <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={handleFileInput} />
                        </label>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 transition-colors cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
                            <p className="text-xs text-muted-foreground">Uploading…</p>
                          </>
                        ) : (
                          <>
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
                            >
                              <Upload size={18} style={{ color: "#D4A843" }} />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-semibold text-foreground">Drop design here</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">or click to browse</p>
                            </div>
                            <label className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                              Browse files
                              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={handleFileInput} />
                            </label>
                          </>
                        )}
                      </div>
                    )}

                    {uploadError && (
                      <p className="text-xs text-red-400">{uploadError}</p>
                    )}
                  </div>
                </div>

                {/* Placement selector */}
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold text-foreground">Placement</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {PLACEMENTS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPlacement(p.value)}
                        className="px-2 py-2 rounded-xl text-xs font-semibold transition-colors text-center"
                        style={
                          placement === p.value
                            ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                            : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <button
                  onClick={() => setStep(3)}
                  disabled={!designUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <ImageIcon size={14} /> Generate Mockup <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Mockup preview ───────────────────────────────────────── */}
        {step === 3 && selected && (
          <div className="space-y-5">

            {/* Auto-generate on mount */}
            <MountEffect onMount={generateMockup} />

            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Mockup Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.label}</p>
                </div>
                {mockupGenerated && !mockupLoading && (
                  <button
                    onClick={generateMockup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                    style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                  >
                    <RefreshCw size={11} /> Regenerate
                  </button>
                )}
              </div>

              <div className="p-5">
                {mockupLoading ? (
                  <div className="py-20 flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-2 border-accent border-t-transparent animate-spin" style={{ borderColor: "rgba(212,168,67,0.3)", borderTopColor: "#D4A843" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Generating your mockup…</p>
                      <p className="text-xs text-muted-foreground mt-1">This usually takes 10–30 seconds</p>
                    </div>
                  </div>
                ) : mockupError ? (
                  <div className="py-14 text-center space-y-3">
                    <X size={28} className="mx-auto text-red-400 opacity-60" />
                    <p className="text-sm font-semibold text-foreground">Generation failed</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">{mockupError}</p>
                    <button
                      onClick={generateMockup}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mt-2 transition-colors"
                      style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                    >
                      <RefreshCw size={13} /> Try again
                    </button>
                  </div>
                ) : mockups.length > 0 ? (
                  <div className="space-y-4">
                    {/* Mockup grid */}
                    <div className={`grid gap-4 ${mockups.length === 1 ? "" : "grid-cols-2"}`}>
                      {mockups.map((m) => (
                        <div key={m.placement} className="space-y-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url}
                            alt={`${m.placement} mockup`}
                            className="w-full rounded-xl object-contain"
                            style={{ backgroundColor: "#f0ede8", aspectRatio: "1/1" }}
                          />
                          <p className="text-[11px] text-center text-muted-foreground capitalize font-medium">
                            {m.placement.replace(/_/g, " ")}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Approval note */}
                    <div
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ backgroundColor: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.2)" }}
                    >
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#D4A843" }} />
                      <p className="text-xs text-muted-foreground">
                        This is how your product will look to fans. Happy with it? Continue to select
                        colors, sizes, and set your pricing.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                <ArrowLeft size={13} /> Edit Design
              </button>

              {mockups.length > 0 && (
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  onClick={() => {
                    // Step 5 will wire this to the full wizard
                    // Pass state via sessionStorage so the create page can continue
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem("merch_create_state", JSON.stringify({
                        printfulProductId: selected.printfulProductId,
                        productLabel:      selected.label,
                        productImage:      selected.image,
                        designUrl,
                        placement,
                        printPosition,
                        mockupUrls:        mockups.map((m) => m.url),
                        variants:          selected.variants,
                      }));
                    }
                    // Step 5 builds the next page — for now show confirmation
                    router.push("/dashboard/merch");
                  }}
                >
                  Looks good — Continue <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MountEffect — run callback once on mount ─────────────────────────────────

function MountEffect({ onMount }: { onMount: () => void }) {
  const ref = useRef(onMount);
  ref.current = onMount;
  useEffect(() => { ref.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
