"use client";

import { useState } from "react";
import { ShoppingBag, X, Loader2, Plus, Minus, ChevronRight } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type MerchProduct = {
  id:           string;
  title:        string;
  imageUrl:     string;
  basePrice:    number;
  artistMarkup: number;
  productType:  string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  TSHIRT:    "T-Shirt",
  HOODIE:    "Hoodie",
  POSTER:    "Poster",
  PHONECASE: "Phone Case",
  HAT:       "Hat",
  STICKER:   "Sticker",
  MUG:       "Mug",
};

/** Product types that have size options */
const SIZED_TYPES = new Set(["TSHIRT", "HOODIE"]);
const HAT_TYPES   = new Set(["HAT"]);

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const HAT_SIZES    = ["S/M", "L/XL"];

function getSizes(productType: string): string[] | null {
  if (SIZED_TYPES.has(productType)) return APPAREL_SIZES;
  if (HAT_TYPES.has(productType))   return HAT_SIZES;
  return null;
}

// ─── Glass card ───────────────────────────────────────────────────────────────

const GLASS_STYLE = {
  backgroundColor: "rgba(255,255,255,0.04)",
  backdropFilter:  "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border:          "1px solid rgba(255,255,255,0.08)",
} as const;

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onQuickAdd,
}: {
  product:    MerchProduct;
  onQuickAdd: (p: MerchProduct) => void;
}) {
  const price = product.basePrice + product.artistMarkup;

  return (
    <div
      className="shrink-0 rounded-2xl overflow-hidden flex flex-col"
      style={{ width: 180, ...GLASS_STYLE }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect width='180' height='180' fill='%23222'/%3E%3C/svg%3E";
          }}
        />
        {/* Subtle gradient at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)" }}
        />
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 px-3 pt-2.5 pb-3 gap-2">
        <div className="flex-1 min-h-0">
          <p className="text-xs font-semibold text-white/90 line-clamp-2 leading-tight">
            {product.title}
          </p>
          <p className="text-sm font-bold mt-1" style={{ color: "#D4A843" }}>
            ${price.toFixed(2)}
          </p>
        </div>

        {/* Quick Add */}
        <button
          onClick={() => onQuickAdd(product)}
          className="w-full py-1.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Quick Add
        </button>
      </div>
    </div>
  );
}

// ─── View All card (end of row) ───────────────────────────────────────────────

function ViewAllCard({ artistSlug }: { artistSlug: string }) {
  return (
    <Link
      href={`/${artistSlug}/merch`}
      className="shrink-0 rounded-2xl flex flex-col items-center justify-center gap-2 no-underline
                 transition-all hover:brightness-125"
      style={{ width: 120, minHeight: 200, ...GLASS_STYLE }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
      >
        <ChevronRight size={18} style={{ color: "#D4A843" }} />
      </div>
      <p className="text-xs font-semibold text-center px-3 leading-tight" style={{ color: "#D4A843" }}>
        View All Merch
      </p>
    </Link>
  );
}

// ─── Quick-add overlay ────────────────────────────────────────────────────────

function QuickAddOverlay({
  product,
  artistSlug,
  onClose,
}: {
  product:    MerchProduct;
  artistSlug: string;
  onClose:    () => void;
}) {
  const sizes          = getSizes(product.productType);
  const [size,     setSize]     = useState<string>(sizes?.[2] ?? "");   // default M / S/M
  const [quantity, setQuantity] = useState(1);
  const [email,    setEmail]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const sellingPrice = product.basePrice + product.artistMarkup;
  const totalPrice   = sellingPrice * quantity;

  async function handleCheckout() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/merch/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          productId:  product.id,
          buyerEmail: email.trim(),
          quantity,
          artistSlug,
          size: size || undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Checkout failed. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.80)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
        style={{
          ...GLASS_STYLE,
          backgroundColor: "rgba(18,18,18,0.92)",
          border: "1px solid rgba(212,168,67,0.2)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-12 h-12 rounded-xl object-cover shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23222'/%3E%3C/svg%3E";
              }}
            />
            <div>
              <p className="text-sm font-bold text-white leading-snug line-clamp-2">{product.title}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {TYPE_LABELS[product.productType] ?? product.productType}
                {" · "}
                <span style={{ color: "#D4A843" }}>${sellingPrice.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
          >
            <X size={15} />
          </button>
        </div>

        {/* Size selector */}
        {sizes && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    borderColor:     size === s ? "#D4A843" : "rgba(255,255,255,0.12)",
                    backgroundColor: size === s ? "rgba(212,168,67,0.12)" : "transparent",
                    color:           size === s ? "#D4A843" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Quantity</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <Minus size={12} className="text-white/60" />
            </button>
            <span className="text-sm font-bold text-white w-6 text-center tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <Plus size={12} className="text-white/60" />
            </button>
            <span className="text-xs text-white/30 ml-1 tabular-nums">
              × ${sellingPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Email for order confirmation</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
            placeholder="you@example.com"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none focus:ring-1 placeholder:text-white/25"
            style={{ borderColor: "rgba(255,255,255,0.12)", focusRingColor: "#D4A843" }}
            autoComplete="email"
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>
        )}

        {/* CTAs */}
        <div className="space-y-2 pt-1">
          {/* Checkout */}
          <button
            onClick={handleCheckout}
            disabled={loading || !email.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
            ) : (
              <><ShoppingBag size={14} /> Checkout · ${totalPrice.toFixed(2)}</>
            )}
          </button>

          {/* Continue shopping */}
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Continue browsing
          </button>
        </div>

        <p className="text-[10px] text-white/25 text-center">
          Secure checkout powered by Stripe
        </p>
      </div>
    </div>
  );
}

// ─── MerchGrid ────────────────────────────────────────────────────────────────

export default function MerchGrid({
  products,
  artistSlug,
  justPurchased = false,
}: {
  products:      MerchProduct[];
  artistSlug:    string;
  justPurchased?: boolean;
}) {
  const [selected, setSelected] = useState<MerchProduct | null>(null);

  if (!products.length) return null;

  return (
    <>
      {/* Success banner */}
      {justPurchased && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2 mb-4"
          style={{
            backgroundColor: "rgba(52,199,89,0.1)",
            border:          "1px solid rgba(52,199,89,0.25)",
            color:           "#34C759",
          }}
        >
          <ShoppingBag size={14} className="shrink-0" />
          Order placed! Check your email for confirmation and shipping updates.
        </div>
      )}

      <section className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Merch</h2>
          <Link
            href={`/${artistSlug}/merch`}
            className="text-xs font-semibold no-underline transition-colors hover:brightness-125"
            style={{ color: "rgba(212,168,67,0.6)" }}
          >
            View All →
          </Link>
        </div>

        {/* Horizontal scroll row */}
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onQuickAdd={(p) => setSelected(p)}
            />
          ))}

          {/* View All card */}
          <ViewAllCard artistSlug={artistSlug} />
        </div>
      </section>

      {/* Quick-add overlay */}
      {selected && (
        <QuickAddOverlay
          product={selected}
          artistSlug={artistSlug}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
