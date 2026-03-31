"use client";

/**
 * /dashboard/merch/create — Merch creation wizard
 *
 * Mode picker → two flows:
 *
 * POD (Print-on-demand, Printful):
 *   Step 1 — Choose product type (catalog grid)
 *   Step 2 — Upload design + placement + DesignPositioner
 *   Step 3 — Generate + approve mockup
 *   Step 4 — Select colors & sizes to offer
 *   Step 5 — Set retail price per cost tier (with live profit calculator)
 *   Step 6 — Product details (title, description) + publish / save as draft
 *
 * Self-Fulfilled (artist ships):
 *   SF Step 1 — Pick generic category
 *   SF Step 2 — Upload product photos (up to 5)
 *   SF Step 3 — Add variants (size, color, price, stock qty)
 *   SF Step 4 — Return policy + processing days
 *   SF Step 5 — Title, description + publish / save as draft
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Search, Loader2, CheckCircle2, ImageIcon, RefreshCw,
  ArrowRight, ArrowLeft, Upload, X, DollarSign, ShoppingBag,
  Eye, EyeOff, Package, Truck, Plus, Trash2,
} from "lucide-react";
import { useMerchCatalog, type CatalogEntry } from "@/hooks/queries";
import { useUploadThing } from "@/lib/uploadthing-client";
import DesignPositioner, { type PrintPosition } from "@/components/merch/DesignPositioner";
import type { PrintfulVariant } from "@/lib/printful";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "All", "T-Shirts", "Hoodies & Sweatshirts", "Hats",
  "Posters & Art Prints", "Mugs", "Phone Cases", "Stickers & Accessories",
] as const;

type Placement = "front" | "back" | "front_and_back";
const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "front",          label: "Front"        },
  { value: "back",           label: "Back"         },
  { value: "front_and_back", label: "Front & Back" },
];

const SIZE_ORDER = ["XS","S","M","L","XL","2XL","3XL","4XL","5XL","One Size","OS","OSFA"];

/** IndieThis platform fee: 15% of gross profit */
const INDIETHIS_FEE_RATE = 0.15;

const SF_CATEGORIES = ["T-Shirt", "Hoodie", "Poster", "Vinyl", "Other"] as const;
type SFCategory = typeof SF_CATEGORIES[number];

type SFVariant = { id: number; size: string; color: string; colorCode: string; price: string; stockQty: string };

// ─── Profit calculator ────────────────────────────────────────────────────────

function calcProfit(retail: number, base: number) {
  const gross  = retail - base;
  const fee    = gross * INDIETHIS_FEE_RATE;
  const profit = gross - fee;
  return { gross, fee, profit };
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const POD_STEP_LABELS = ["Product","Design","Mockup","Variants","Pricing","Publish"];
const SF_STEP_LABELS  = ["Category","Photos","Variants","Details","Publish"];

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-hide">
      {labels.map((label, i) => {
        const n      = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center shrink-0">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: done || active ? "#D4A843" : "var(--background)",
                  color:           done || active ? "#0A0A0A"  : "var(--muted-foreground)",
                  border:          done || active ? "none"     : "1px solid var(--border)",
                }}
              >
                {done ? <CheckCircle2 size={10} /> : n}
              </div>
              <span
                className="text-[11px] font-semibold hidden sm:block whitespace-nowrap"
                style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className="w-5 sm:w-7 h-px mx-1.5" style={{ backgroundColor: done ? "#D4A843" : "var(--border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

let sfVarCounter = 0;

export default function MerchCreatePage() {
  const router = useRouter();

  // ── Mode picker ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"pod" | "self" | null>(null);

  // ── POD state ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

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
  const [mockups,       setMockups      ] = useState<{ placement: string; url: string }[]>([]);
  const [mockupLoading, setMockupLoading] = useState(false);
  const [mockupError,   setMockupError  ] = useState("");
  const [mockupDone,    setMockupDone   ] = useState(false);

  // Step 4
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes,  setSelectedSizes ] = useState<Set<string>>(new Set());

  // Step 5 — Map<basePrice, retailPriceString>
  const [pricing, setPricing] = useState<Map<number, string>>(new Map());

  // Step 6
  const [productTitle,  setProductTitle ] = useState("");
  const [productDesc,   setProductDesc  ] = useState("");
  const [submitting,    setSubmitting   ] = useState(false);
  const [submitError,   setSubmitError  ] = useState("");

  // ── Self-fulfilled state ─────────────────────────────────────────────────────
  const [sfStep,           setSfStep          ] = useState(1);
  const [sfCategory,       setSfCategory      ] = useState<SFCategory | null>(null);
  const [sfPhotos,         setSfPhotos        ] = useState<string[]>([]);
  const [sfPhotoUploading, setSfPhotoUploading] = useState(false);
  const [sfPhotoError,     setSfPhotoError    ] = useState("");
  const [sfVariants,       setSfVariants      ] = useState<SFVariant[]>([
    { id: ++sfVarCounter, size: "", color: "", colorCode: "#000000", price: "", stockQty: "" },
  ]);
  const [sfReturnPolicy,   setSfReturnPolicy  ] = useState("");
  const [sfProcessingDays, setSfProcessingDays] = useState("3");
  const [sfTitle,          setSfTitle         ] = useState("");
  const [sfDesc,           setSfDesc          ] = useState("");
  const [sfSubmitting,     setSfSubmitting    ] = useState(false);
  const [sfSubmitError,    setSfSubmitError   ] = useState("");

  // ── Catalog ─────────────────────────────────────────────────────────────────
  const { data: catalog = [], isLoading: loadingCatalog } = useMerchCatalog(mode === "pod");

  const filtered = catalog.filter((e) => {
    const matchCat    = categoryFilter === "All" || e.category === categoryFilter;
    const matchSearch = !search || e.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Derived variant data (POD) ───────────────────────────────────────────────
  const allColors = useMemo(() => {
    if (!selected) return [];
    const seen = new Set<string>();
    const out: { color: string; colorCode: string }[] = [];
    for (const v of selected.variants) {
      if (!seen.has(v.color)) {
        seen.add(v.color);
        out.push({ color: v.color, colorCode: v.color_code });
      }
    }
    return out;
  }, [selected]);

  const allSizes = useMemo(() => {
    if (!selected) return [];
    const seen = new Set<string>();
    for (const v of selected.variants) seen.add(v.size);
    return [...seen].sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [selected]);

  const chosenVariants = useMemo(() => {
    if (!selected) return [] as PrintfulVariant[];
    return selected.variants.filter(
      (v) => selectedColors.has(v.color) && selectedSizes.has(v.size),
    );
  }, [selected, selectedColors, selectedSizes]);

  const pricingTiers = useMemo(() => {
    const tiers = new Map<number, { basePrice: number; sizes: string[] }>();
    for (const v of chosenVariants) {
      const bp = parseFloat(v.price);
      if (!tiers.has(bp)) tiers.set(bp, { basePrice: bp, sizes: [] });
      const t = tiers.get(bp)!;
      if (!t.sizes.includes(v.size)) t.sizes.push(v.size);
    }
    return [...tiers.values()].sort((a, b) => a.basePrice - b.basePrice);
  }, [chosenVariants]);

  // ── UploadThing (POD design) ─────────────────────────────────────────────────
  const { startUpload, isUploading } = useUploadThing("merchDesign", {
    onClientUploadComplete: (files) => {
      const url = files[0]?.url;
      if (url) { setDesignUrl(url); setUploadError(""); }
    },
    onUploadError: (err) => setUploadError(err.message ?? "Upload failed."),
  });

  // ── UploadThing (self-fulfilled photos) ────────────────────────────────────
  const { startUpload: startPhotoUpload } = useUploadThing("selfFulfilledProductImages", {
    onClientUploadComplete: (files) => {
      const newUrls = files.map((f) => f.url);
      setSfPhotos((prev) => [...prev, ...newUrls].slice(0, 5));
      setSfPhotoUploading(false);
      setSfPhotoError("");
    },
    onUploadError: (err) => {
      setSfPhotoError(err.message ?? "Upload failed.");
      setSfPhotoUploading(false);
    },
  });

  const handlePositionChange = useCallback((pos: PrintPosition) => {
    setPrintPosition(pos);
  }, []);

  // ── POD Navigation ───────────────────────────────────────────────────────────
  function goBack() {
    if (mode === null) {
      router.push("/dashboard/merch");
    } else if (mode === "self") {
      if (sfStep === 1) setMode(null);
      else setSfStep((s) => s - 1);
    } else {
      if (step === 1) setMode(null);
      else setStep((s) => s - 1);
    }
  }

  function selectProduct(entry: CatalogEntry) {
    setSelected(entry);
    setProductTitle(entry.label);
    setProductDesc(entry.description ?? "");
    setSelectedColors(new Set(entry.variants.map((v) => v.color)));
    setSelectedSizes(new Set(entry.variants.map((v) => v.size)));
    setStep(2);
  }

  function goToStep5() {
    if (chosenVariants.length === 0) return;
    const map = new Map<number, string>();
    for (const tier of pricingTiers) {
      if (!pricing.has(tier.basePrice)) {
        map.set(tier.basePrice, (tier.basePrice + 15).toFixed(2));
      } else {
        map.set(tier.basePrice, pricing.get(tier.basePrice)!);
      }
    }
    setPricing(map);
    setStep(5);
  }

  // ── POD Mockup generation ────────────────────────────────────────────────────
  async function generateMockup() {
    if (!selected || !designUrl) return;
    setMockupLoading(true);
    setMockupError("");
    setMockups([]);

    const repIds = selected.variants
      .filter((v, i, arr) => arr.findIndex((x) => x.color === v.color) === i)
      .slice(0, 5)
      .map((v) => v.id);

    try {
      const res = await fetch("/api/merch/mockup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          printfulProductId: selected.printfulProductId,
          variantIds:        repIds,
          designUrl,
          placement,
          position: printPosition ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to generate mockup");
      }
      const data = await res.json() as { mockups: { placement: string; url: string }[] };
      setMockups(data.mockups);
      setMockupDone(true);
    } catch (err) {
      setMockupError(err instanceof Error ? err.message : "Mockup generation failed.");
    } finally {
      setMockupLoading(false);
    }
  }

  // ── POD pricing validation ────────────────────────────────────────────────────
  const pricingValid = useMemo(() => {
    for (const tier of pricingTiers) {
      const retail = parseFloat(pricing.get(tier.basePrice) ?? "0");
      if (isNaN(retail) || retail <= tier.basePrice) return false;
    }
    return pricingTiers.length > 0;
  }, [pricing, pricingTiers]);

  // ── POD Submit ────────────────────────────────────────────────────────────────
  async function submitProduct(isActive: boolean) {
    if (!selected || !designUrl) return;
    setSubmitting(true);
    setSubmitError("");

    const variantPayload = chosenVariants.map((v) => {
      const bp = parseFloat(v.price);
      const retailStr = pricing.get(bp) ?? String(bp + 15);
      return {
        printfulVariantId: v.id,
        size:              v.size || "One Size",
        color:             v.color || "",
        colorCode:         v.color_code || "#000000",
        basePrice:         bp,
        retailPrice:       parseFloat(retailStr),
        imageUrl:          mockups[0]?.url ?? null,
      };
    });

    const mainImage = mockups[0]?.url ?? selected.image;

    try {
      const res = await fetch("/api/dashboard/merch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          fulfillmentType:   "POD",
          printfulProductId: selected.printfulProductId,
          title:             productTitle.trim(),
          description:       productDesc.trim(),
          imageUrl:          mainImage,
          designUrl,
          placement,
          isActive,
          variants:          variantPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to create product");
      }

      router.push("/dashboard/merch");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── SF variant helpers ────────────────────────────────────────────────────────
  function updateSfVariant(id: number, field: keyof SFVariant, value: string) {
    setSfVariants((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v));
  }

  function addSfVariant() {
    setSfVariants((prev) => [...prev, { id: ++sfVarCounter, size: "", color: "", colorCode: "#000000", price: "", stockQty: "" }]);
  }

  function removeSfVariant(id: number) {
    setSfVariants((prev) => prev.filter((v) => v.id !== id));
  }

  const sfVariantsValid = useMemo(() => {
    return sfVariants.length > 0 && sfVariants.every((v) => {
      const p = parseFloat(v.price);
      return v.size.trim() && !isNaN(p) && p > 0;
    });
  }, [sfVariants]);

  // ── SF Submit ─────────────────────────────────────────────────────────────────
  async function submitSelfFulfilled(isActive: boolean) {
    if (!sfTitle.trim() || !sfReturnPolicy.trim() || sfPhotos.length === 0) return;
    setSfSubmitting(true);
    setSfSubmitError("");

    try {
      const res = await fetch("/api/dashboard/merch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          fulfillmentType: "SELF_FULFILLED",
          title:           sfTitle.trim(),
          description:     sfDesc.trim(),
          imageUrl:        sfPhotos[0],
          imageUrls:       sfPhotos,
          returnPolicy:    sfReturnPolicy.trim(),
          processingDays:  parseInt(sfProcessingDays) || 3,
          isActive,
          variants:        sfVariants.map((v) => ({
            size:          v.size.trim() || "One Size",
            color:         v.color.trim() || "",
            colorCode:     v.colorCode || "#000000",
            basePrice:     0,
            retailPrice:   parseFloat(v.price),
            stockQuantity: v.stockQty ? parseInt(v.stockQty) : null,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to create product");
      }

      router.push("/dashboard/merch");
    } catch (err) {
      setSfSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSfSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 shrink-0"
            style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Merch Product</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "pod"  ? "Print-on-demand — Printful fulfills every order"  :
               mode === "self" ? "Self-fulfilled — you ship, IndieThis processes payment" :
               "Choose how you want to sell"}
            </p>
          </div>
        </div>

        {/* Step indicator (only after mode is chosen) */}
        {mode === "pod"  && <StepIndicator current={step}   labels={POD_STEP_LABELS} />}
        {mode === "self" && <StepIndicator current={sfStep} labels={SF_STEP_LABELS} />}

        {/* ══════════════════════════════════════════════════════════════════
            MODE PICKER
        ══════════════════════════════════════════════════════════════════ */}
        {mode === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode("pod")}
              className="text-left rounded-2xl border p-6 space-y-4 transition-all hover:border-[#D4A843] group"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Package size={22} style={{ color: "#D4A843" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Print-on-Demand</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Upload your design, we handle printing and shipping through Printful.
                  No inventory. No upfront cost.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingBag size={11} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">T-shirts, hoodies, mugs, posters &amp; more</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>
                  IndieThis takes 15% of your profit →
                </span>
              </div>
            </button>

            <button
              onClick={() => setMode("self")}
              className="text-left rounded-2xl border p-6 space-y-4 transition-all hover:border-[#D4A843] group"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Truck size={22} style={{ color: "#D4A843" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Self-Fulfilled</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  You have your own merch and will ship it yourself. We collect payment
                  and notify you with the buyer's shipping address.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign size={11} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Vinyl, custom apparel, handmade goods, etc.</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>
                  IndieThis takes 15% of full sale price →
                </span>
              </div>
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 1 — Choose product
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 1 && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-bold text-foreground">Choose a product type</h2>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
                    style={categoryFilter === cat
                      ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                      : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                  >{cat}</button>
                ))}
              </div>
            </div>
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
                    <button key={entry.printfulProductId} onClick={() => selectProduct(entry)}
                      className="text-left rounded-2xl border overflow-hidden transition-all hover:border-accent group"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.image} alt={entry.label}
                        className="w-full aspect-square object-cover group-hover:opacity-85 transition-opacity"
                        onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3C/svg%3E"; }}
                      />
                      <div className="p-3 space-y-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{entry.label}</p>
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

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 2 — Upload design + position
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 2 && selected && (
          <div className="space-y-4">
            <ProductPill product={selected} onChange={() => setStep(1)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_280px]">
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold text-foreground">Position your design</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Drag to move · corner handle to resize</p>
                </div>
                <div className="p-3">
                  <DesignPositioner productImage={selected.image} designUrl={designUrl} onChange={handlePositionChange} />
                </div>
              </div>

              <div className="space-y-4">
                <UploadZone
                  designUrl={designUrl}
                  isUploading={isUploading}
                  uploadError={uploadError}
                  onFileSelect={(file) => { setUploadError(""); startUpload([file]); }}
                  onReplace={(file)    => { setUploadError(""); startUpload([file]); }}
                />
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold text-foreground">Placement</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {PLACEMENTS.map((p) => (
                      <button key={p.value} onClick={() => setPlacement(p.value)}
                        className="px-2 py-2 rounded-xl text-xs font-semibold transition-colors text-center"
                        style={placement === p.value
                          ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                          : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                      >{p.label}</button>
                    ))}
                  </div>
                </div>
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

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 3 — Mockup preview
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 3 && selected && (
          <div className="space-y-4">
            <MountEffect onMount={generateMockup} />
            <ProductPill product={selected} onChange={() => setStep(1)} />
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Mockup Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Check how your design looks on the product</p>
                </div>
                {mockupDone && !mockupLoading && (
                  <button onClick={generateMockup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                  ><RefreshCw size={11} /> Regenerate</button>
                )}
              </div>
              <div className="p-5">
                {mockupLoading ? (
                  <div className="py-20 flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "rgba(212,168,67,0.3)", borderTopColor: "#D4A843" }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Generating mockup…</p>
                      <p className="text-xs text-muted-foreground mt-1">Usually 10–30 seconds</p>
                    </div>
                  </div>
                ) : mockupError ? (
                  <div className="py-14 text-center space-y-3">
                    <X size={28} className="mx-auto text-red-400 opacity-60" />
                    <p className="text-sm font-semibold text-foreground">Generation failed</p>
                    <p className="text-xs text-muted-foreground">{mockupError}</p>
                    <button onClick={generateMockup}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                    ><RefreshCw size={13} /> Try again</button>
                  </div>
                ) : mockups.length > 0 ? (
                  <div className="space-y-4">
                    <div className={`grid gap-4 ${mockups.length === 1 ? "" : "grid-cols-2"}`}>
                      {mockups.map((m) => (
                        <div key={m.placement} className="space-y-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt={`${m.placement} mockup`}
                            className="w-full rounded-xl object-contain"
                            style={{ backgroundColor: "#f0ede8", aspectRatio: "1/1" }}
                          />
                          <p className="text-[11px] text-center text-muted-foreground capitalize font-medium">
                            {m.placement.replace(/_/g, " ")}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ backgroundColor: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.2)" }}
                    >
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#D4A843" }} />
                      <p className="text-xs text-muted-foreground">
                        This is how your product will look to fans. Next, choose which colors and sizes to offer.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Edit Design</button>
              {mockups.length > 0 && (
                <button onClick={() => setStep(4)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >Looks good — Select Variants <ArrowRight size={13} /></button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 4 — Select colors + sizes
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 4 && selected && (
          <div className="space-y-4">
            <ProductPill product={selected} onChange={() => setStep(1)} />

            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-bold text-foreground">Colors</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedColors.size} of {allColors.length} selected</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedColors(new Set(allColors.map(c => c.color)))}
                    className="text-xs font-semibold transition-colors" style={{ color: "#D4A843" }}>All</button>
                  <button onClick={() => setSelectedColors(new Set())}
                    className="text-xs font-semibold transition-colors text-muted-foreground">None</button>
                </div>
              </div>
              <div className="p-5 flex flex-wrap gap-3">
                {allColors.map(({ color, colorCode }) => {
                  const active = selectedColors.has(color);
                  return (
                    <button key={color} onClick={() => {
                      setSelectedColors((prev) => {
                        const next = new Set(prev);
                        active ? next.delete(color) : next.add(color);
                        return next;
                      });
                    }}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className="relative w-9 h-9 rounded-full transition-all"
                        style={{
                          backgroundColor: colorCode || "#888",
                          border: active ? "3px solid #D4A843" : "2px solid var(--border)",
                          boxShadow: active ? "0 0 0 1px #D4A843" : "none",
                        }}
                      >
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckCircle2 size={14} style={{ color: isLight(colorCode) ? "#0A0A0A" : "#fff" }} />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground leading-tight max-w-[52px] text-center line-clamp-2">
                        {color}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-bold text-foreground">Sizes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedSizes.size} of {allSizes.length} selected</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedSizes(new Set(allSizes))}
                    className="text-xs font-semibold" style={{ color: "#D4A843" }}>All</button>
                  <button onClick={() => setSelectedSizes(new Set())}
                    className="text-xs font-semibold text-muted-foreground">None</button>
                </div>
              </div>
              <div className="p-5 flex flex-wrap gap-2">
                {allSizes.map((size) => {
                  const active = selectedSizes.has(size);
                  return (
                    <button key={size} onClick={() => {
                      setSelectedSizes((prev) => {
                        const next = new Set(prev);
                        active ? next.delete(size) : next.add(size);
                        return next;
                      });
                    }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                      style={active
                        ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                        : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                    >{size}</button>
                  );
                })}
              </div>
            </div>

            {chosenVariants.length > 0 && (
              <div className="rounded-2xl border px-5 py-4 space-y-2"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <p className="text-xs font-semibold text-foreground">{chosenVariants.length} variant{chosenVariants.length !== 1 ? "s" : ""} selected</p>
                {pricingTiers.map((t) => (
                  <div key={t.basePrice} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t.sizes.join(", ")}</span>
                    <span>Printful cost <span className="text-foreground font-semibold">${t.basePrice.toFixed(2)}</span></span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>
              <button onClick={goToStep5}
                disabled={chosenVariants.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >Set Pricing <ArrowRight size={13} /></button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 5 — Set pricing
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 5 && (
          <div className="space-y-4">
            {selected && <ProductPill product={selected} onChange={() => setStep(1)} />}

            {pricingTiers.map((tier) => {
              const retailStr  = pricing.get(tier.basePrice) ?? "";
              const retailNum  = parseFloat(retailStr);
              const valid      = !isNaN(retailNum) && retailNum > tier.basePrice;
              const { fee, profit } = valid ? calcProfit(retailNum, tier.basePrice) : { fee: 0, profit: 0 };

              return (
                <div key={tier.basePrice} className="rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm font-bold text-foreground">{tier.sizes.join(" · ")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Printful base cost: <span className="text-foreground font-semibold">${tier.basePrice.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Your Retail Price <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input
                          type="number"
                          min={tier.basePrice + 0.01}
                          step="0.01"
                          value={retailStr}
                          onChange={(e) => setPricing((prev) => new Map(prev).set(tier.basePrice, e.target.value))}
                          className="w-full pl-7 pr-4 py-3 rounded-xl border text-sm outline-none font-semibold"
                          style={{
                            backgroundColor: "var(--background)",
                            borderColor: !retailStr ? "var(--border)" : valid ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>
                      {retailStr && !valid && (
                        <p className="text-xs text-red-400">
                          Must be greater than Printful cost (${tier.basePrice.toFixed(2)})
                        </p>
                      )}
                    </div>

                    {valid && (
                      <div className="space-y-2 px-4 py-3 rounded-xl"
                        style={{ backgroundColor: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)" }}
                      >
                        <CalcRow label="Printful cost"             value={`-$${tier.basePrice.toFixed(2)}`} muted />
                        <CalcRow label={`IndieThis fee (${(INDIETHIS_FEE_RATE * 100).toFixed(0)}% of profit)`} value={`-$${fee.toFixed(2)}`} muted />
                        <CalcRow label="Shipping" value="Paid by buyer" muted />
                        <div className="border-t pt-2" style={{ borderColor: "rgba(212,168,67,0.2)" }}>
                          <CalcRow label="Your profit per sale" value={`$${profit.toFixed(2)}`} highlight />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!pricingValid && pricingTiers.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Set a retail price above Printful cost for each size group to continue.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(4)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>
              <button onClick={() => setStep(6)}
                disabled={!pricingValid}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >Product Details <ArrowRight size={13} /></button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            POD — STEP 6 — Product details + publish
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "pod" && step === 6 && selected && (
          <div className="space-y-4">
            <ProductPill product={selected} onChange={() => setStep(1)} />

            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-bold text-foreground">Product Details</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={productTitle}
                    onChange={(e) => setProductTitle(e.target.value)}
                    placeholder="e.g. My Band Tee — Summer 2026"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    placeholder="Tell fans about this product…"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>
            </div>

            {mockups.length > 0 && (
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-bold text-foreground">Mockup Review</p>
                </div>
                <div className={`p-5 grid gap-3 ${mockups.length === 1 ? "grid-cols-1 max-w-xs" : "grid-cols-2"}`}>
                  {mockups.map((m) => (
                    <div key={m.placement} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.placement}
                        className="w-full rounded-xl object-contain"
                        style={{ backgroundColor: "#f0ede8", aspectRatio: "1/1" }}
                      />
                      <p className="text-[10px] text-center text-muted-foreground capitalize">{m.placement.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border px-5 py-4 space-y-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <p className="text-xs font-semibold text-foreground">Summary</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{chosenVariants.length} variant{chosenVariants.length !== 1 ? "s" : ""} · {selectedColors.size} color{selectedColors.size !== 1 ? "s" : ""} · {selectedSizes.size} size{selectedSizes.size !== 1 ? "s" : ""}</p>
                {pricingTiers.map((t) => {
                  const retail = parseFloat(pricing.get(t.basePrice) ?? "0");
                  const { profit } = calcProfit(retail, t.basePrice);
                  return (
                    <p key={t.basePrice}>
                      {t.sizes.join(", ")}: <span className="text-foreground font-semibold">${retail.toFixed(2)}</span>
                      {" "}· <span className="text-emerald-400 font-semibold">${profit.toFixed(2)} profit</span>
                    </p>
                  );
                })}
              </div>
            </div>

            {submitError && <p className="text-xs text-red-400 font-semibold text-center">{submitError}</p>}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(5)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>

              <button onClick={() => submitProduct(false)}
                disabled={submitting || !productTitle.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                Save Draft
              </button>

              <button onClick={() => submitProduct(true)}
                disabled={submitting || !productTitle.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                Publish to Store
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SF — STEP 1 — Category
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "self" && sfStep === 1 && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-bold text-foreground">What type of product is this?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Just for categorization — fans won't see this label</p>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SF_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setSfCategory(cat); setSfStep(2); }}
                  className="py-4 rounded-2xl border text-sm font-semibold transition-all hover:border-[#D4A843]"
                  style={{
                    backgroundColor: sfCategory === cat ? "#D4A843" : "var(--background)",
                    color:           sfCategory === cat ? "#0A0A0A"  : "var(--foreground)",
                    borderColor:     sfCategory === cat ? "#D4A843"  : "var(--border)",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SF — STEP 2 — Product photos
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "self" && sfStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-sm font-bold text-foreground">Product photos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload up to 5 photos · PNG or JPG · max 16MB each · {sfPhotos.length}/5 uploaded
                </p>
              </div>
              <div className="p-5 space-y-4">
                {/* Thumbnails */}
                {sfPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {sfPhotos.map((url, i) => (
                      <div key={url} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Photo ${i + 1}`}
                          className="w-full aspect-square rounded-xl object-cover"
                          style={{ border: "1px solid var(--border)" }}
                        />
                        <button
                          onClick={() => setSfPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: "rgba(232,93,74,0.9)", color: "white" }}
                        >
                          <X size={10} />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>Main</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {sfPhotos.length < 5 && (
                  <div className="rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {sfPhotoUploading ? (
                      <><Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
                      <p className="text-xs text-muted-foreground">Uploading…</p></>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                          <Upload size={18} style={{ color: "#D4A843" }} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-foreground">Drop photos here</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            or click to browse · up to {5 - sfPhotos.length} more
                          </p>
                        </div>
                        <label className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                          Browse files
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []).slice(0, 5 - sfPhotos.length);
                              if (files.length === 0) return;
                              setSfPhotoUploading(true);
                              setSfPhotoError("");
                              startPhotoUpload(files);
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}
                {sfPhotoError && <p className="text-xs text-red-400">{sfPhotoError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setSfStep(1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>
              <button onClick={() => setSfStep(3)}
                disabled={sfPhotos.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >Add Variants <ArrowRight size={13} /></button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SF — STEP 3 — Variants
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "self" && sfStep === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-sm font-bold text-foreground">Variants</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add each size/color combination you're selling. Leave stock blank for unlimited.
                </p>
              </div>
              <div className="p-5 space-y-3">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Size</span>
                  <span>Color</span>
                  <span>Price</span>
                  <span>Stock</span>
                  <span></span>
                </div>

                {sfVariants.map((v) => (
                  <div key={v.id} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Size (e.g. M)"
                      value={v.size}
                      onChange={(e) => updateSfVariant(v.id, "size", e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={v.colorCode}
                        onChange={(e) => updateSfVariant(v.id, "colorCode", e.target.value)}
                        className="w-8 h-8 rounded-lg border cursor-pointer shrink-0"
                        style={{ borderColor: "var(--border)", padding: "2px" }}
                      />
                      <input
                        type="text"
                        placeholder="Color name"
                        value={v.color}
                        onChange={(e) => updateSfVariant(v.id, "color", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border text-xs outline-none min-w-0"
                        style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={v.price}
                        onChange={(e) => updateSfVariant(v.id, "price", e.target.value)}
                        className="w-full pl-6 pr-2 py-2 rounded-xl border text-xs outline-none"
                        style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                      />
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="∞"
                      value={v.stockQty}
                      onChange={(e) => updateSfVariant(v.id, "stockQty", e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => removeSfVariant(v.id)}
                      disabled={sfVariants.length <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addSfVariant}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold w-full justify-center mt-2"
                  style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}
                >
                  <Plus size={13} /> Add variant
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setSfStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>
              <button onClick={() => setSfStep(4)}
                disabled={!sfVariantsValid}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >Return Policy <ArrowRight size={13} /></button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SF — STEP 4 — Return policy + processing days
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "self" && sfStep === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-sm font-bold text-foreground">Fulfillment Details</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Shown to buyers at checkout</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Processing time (business days) <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {["1","2","3","5","7","14"].map((d) => (
                      <button key={d} onClick={() => setSfProcessingDays(d)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                        style={sfProcessingDays === d
                          ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                          : { backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                      >{d} day{d === "1" ? "" : "s"}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Return policy <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={sfReturnPolicy}
                    onChange={(e) => setSfReturnPolicy(e.target.value)}
                    placeholder="e.g. All sales are final. If your item arrives damaged, contact us within 7 days with photos and we'll make it right."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                  <p className="text-[11px] text-muted-foreground">Required — fans will see this before purchasing.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setSfStep(3)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>
              <button onClick={() => setSfStep(5)}
                disabled={!sfReturnPolicy.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >Product Details <ArrowRight size={13} /></button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SF — STEP 5 — Title, description + publish
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "self" && sfStep === 5 && (
          <div className="space-y-4">
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-bold text-foreground">Product Details</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={sfTitle}
                    onChange={(e) => setSfTitle(e.target.value)}
                    placeholder={`e.g. Signed ${sfCategory ?? "Item"} — Limited Run`}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea
                    value={sfDesc}
                    onChange={(e) => setSfDesc(e.target.value)}
                    placeholder="Tell fans about this item…"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>
            </div>

            {/* Photo preview */}
            {sfPhotos.length > 0 && (
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-bold text-foreground">Photos ({sfPhotos.length})</p>
                </div>
                <div className="p-5 flex gap-3 flex-wrap">
                  {sfPhotos.map((url, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={url} src={url} alt={`photo ${i + 1}`}
                      className="w-20 h-20 rounded-xl object-cover"
                      style={{ border: "1px solid var(--border)" }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-2xl border px-5 py-4 space-y-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <p className="text-xs font-semibold text-foreground">Summary</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Category: {sfCategory}</p>
                <p>{sfVariants.length} variant{sfVariants.length !== 1 ? "s" : ""}</p>
                <p>Processing: {sfProcessingDays} business day{sfProcessingDays === "1" ? "" : "s"}</p>
                {sfVariants.map((v) => {
                  const price = parseFloat(v.price);
                  if (isNaN(price)) return null;
                  const { profit } = calcProfit(price, 0);
                  return (
                    <p key={v.id}>
                      {v.size}{v.color ? ` / ${v.color}` : ""}:
                      {" "}<span className="text-foreground font-semibold">${price.toFixed(2)}</span>
                      {" "}· <span className="text-emerald-400 font-semibold">${profit.toFixed(2)} profit</span>
                      {v.stockQty ? ` · ${v.stockQty} in stock` : ""}
                    </p>
                  );
                })}
              </div>
            </div>

            {sfSubmitError && <p className="text-xs text-red-400 font-semibold text-center">{sfSubmitError}</p>}

            <div className="flex items-center gap-3">
              <button onClick={() => setSfStep(4)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              ><ArrowLeft size={13} /> Back</button>

              <button onClick={() => submitSelfFulfilled(false)}
                disabled={sfSubmitting || !sfTitle.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                {sfSubmitting ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                Save Draft
              </button>

              <button onClick={() => submitSelfFulfilled(true)}
                disabled={sfSubmitting || !sfTitle.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {sfSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                Publish to Store
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductPill({ product, onChange }: { product: CatalogEntry; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.image} alt={product.label}
        className="w-10 h-10 rounded-lg object-cover shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3C/svg%3E"; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{product.label}</p>
        <p className="text-xs text-muted-foreground">{product.category}</p>
      </div>
      <button onClick={onChange} className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">
        Change
      </button>
    </div>
  );
}

function UploadZone({ designUrl, isUploading, uploadError, onFileSelect, onReplace }: {
  designUrl:    string;
  isUploading:  boolean;
  uploadError:  string;
  onFileSelect: (f: File) => void;
  onReplace:    (f: File) => void;
}) {
  function pick(e: React.ChangeEvent<HTMLInputElement>, cb: (f: File) => void) {
    const f = e.target.files?.[0]; if (f) cb(f);
  }
  function drop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (!f) return;
    if (!["image/png","image/jpeg","image/jpg"].includes(f.type)) return;
    onFileSelect(f);
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold text-foreground">Upload design</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">PNG or JPG · 300 DPI+ · max 64MB</p>
      </div>
      <div className="p-4 space-y-3">
        {designUrl ? (
          <div className="space-y-2">
            <div className="w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: "var(--background)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={designUrl} alt="Design" className="max-w-full max-h-full object-contain" />
            </div>
            <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <RefreshCw size={12} /> Replace
              <input type="file" accept="image/png,image/jpeg" className="sr-only"
                onChange={(e) => pick(e, onReplace)} />
            </label>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            onDrop={drop} onDragOver={(e) => e.preventDefault()}
          >
            {isUploading ? (
              <><Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
              <p className="text-xs text-muted-foreground">Uploading…</p></>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                  <Upload size={18} style={{ color: "#D4A843" }} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">Drop design here</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">or click to browse</p>
                </div>
                <label className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  Browse files
                  <input type="file" accept="image/png,image/jpeg" className="sr-only"
                    onChange={(e) => pick(e, onFileSelect)} />
                </label>
              </>
            )}
          </div>
        )}
        {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
      </div>
    </div>
  );
}

function CalcRow({ label, value, muted, highlight }: {
  label: string; value: string; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "" : muted ? "text-muted-foreground" : "text-foreground"}`}
        style={highlight ? { color: "#D4A843" } : {}}
      >{value}</span>
    </div>
  );
}

function MountEffect({ onMount }: { onMount: () => void }) {
  const ref = useRef(onMount);
  ref.current = onMount;
  useEffect(() => { ref.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Returns true if a hex color is light enough to need dark text */
function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0,2),16);
  const g = parseInt(c.slice(2,4),16);
  const b = parseInt(c.slice(4,6),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
