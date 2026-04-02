"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ShoppingBag, X, Loader2, Plus, Minus, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MerchVariantSummary = {
  id:          string;
  size:        string;
  color:       string;
  colorCode:   string;
  retailPrice: number;
  imageUrl?:   string | null;
};

export type MerchProduct = {
  id:              string;
  title:           string;
  description?:    string | null;
  imageUrl:        string;
  imageUrls:       string[];
  markup:          number;
  fulfillmentType: string;
  returnPolicy?:   string | null;
  variants:        MerchVariantSummary[];
};

type CartItem = {
  variantId:    string;
  productId:    string;
  productTitle: string;
  productImage: string;
  size:         string;
  color:        string;
  price:        number;
  quantity:     number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLASS = {
  backgroundColor: "rgba(18,18,18,0.95)",
  border:          "1px solid rgba(212,168,67,0.2)",
} as const;

function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return (r*299 + g*587 + b*114)/1000 > 128;
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onOpen }: { product: MerchProduct; onOpen: () => void }) {
  const lowestPrice = product.variants[0]?.retailPrice ?? 0;
  return (
    <button
      onClick={onOpen}
      className="shrink-0 rounded-[8px] overflow-hidden flex flex-col text-left focus:outline-none group"
      style={{ minWidth: 120, backgroundColor: "#111" }}
    >
      <div className="relative overflow-hidden" style={{ height: 120 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23222'/%3E%3C/svg%3E"; }}
        />
      </div>
      <div style={{ padding: 8 }}>
        <p className="leading-tight line-clamp-2" style={{ fontSize: 11, fontWeight: 500, color: "#F5F5F5" }}>
          {product.title}
        </p>
        <p style={{ fontSize: 11, color: "#D4A843", marginTop: 2 }}>
          {lowestPrice > 0 ? `From $${lowestPrice.toFixed(2)}` : "—"}
        </p>
      </div>
    </button>
  );
}

// ─── View All card ────────────────────────────────────────────────────────────

function ViewAllCard({ artistSlug }: { artistSlug: string }) {
  return (
    <Link
      href={`/${artistSlug}/merch`}
      className="shrink-0 rounded-[8px] flex flex-col items-center justify-center gap-2 no-underline transition-all hover:brightness-125"
      style={{ minWidth: 80, height: 152, backgroundColor: "#111" }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
        <ChevronRight size={14} style={{ color: "#D4A843" }} />
      </div>
      <p className="text-[10px] font-semibold text-center px-2 leading-tight" style={{ color: "#D4A843" }}>View All</p>
    </Link>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────

function ProductModal({
  product,
  onClose,
  onAddToCart,
}: {
  product:     MerchProduct;
  onClose:     () => void;
  onAddToCart: (item: Omit<CartItem, "productId" | "productTitle" | "productImage">) => void;
}) {
  const galleryImages = product.imageUrls.length > 0
    ? product.imageUrls
    : [product.imageUrl];

  const [galleryIdx, setGalleryIdx]           = useState(0);
  const [selectedColor, setSelectedColor]     = useState<string | null>(null);
  const [selectedSize,  setSelectedSize ]     = useState<string | null>(null);
  const [quantity,      setQuantity     ]     = useState(1);
  const [added,         setAdded        ]     = useState(false);

  // Unique colors
  const uniqueColors = useMemo(() => {
    const seen = new Set<string>();
    const out: { color: string; colorCode: string }[] = [];
    for (const v of product.variants) {
      if (!seen.has(v.color)) { seen.add(v.color); out.push({ color: v.color, colorCode: v.colorCode }); }
    }
    return out;
  }, [product.variants]);

  const hasColors = uniqueColors.length > 0 && uniqueColors[0]?.color !== "";
  const initColor = hasColors ? (uniqueColors[0]?.color ?? null) : null;
  const activeColor = selectedColor ?? initColor;

  // Sizes for selected color
  const sizesForColor = useMemo(() => {
    const col = activeColor;
    if (!col && !hasColors) return [...new Set(product.variants.map((v) => v.size))];
    return product.variants.filter((v) => v.color === col).map((v) => v.size);
  }, [product.variants, activeColor, hasColors]);

  const isOneSize = sizesForColor.length === 1 && (sizesForColor[0] === "One Size" || sizesForColor[0] === "OS" || sizesForColor[0] === "OSFA");
  const initSize = isOneSize ? (sizesForColor[0] ?? null) : null;
  const activeSize = selectedSize ?? initSize;

  // Resolve selected variant
  const selectedVariant = useMemo(() => {
    const col = activeColor;
    const sz  = activeSize;
    if (!sz) return null;
    return product.variants.find((v) => (!hasColors || v.color === col) && v.size === sz) ?? null;
  }, [product.variants, activeColor, activeSize, hasColors]);

  function handleAddToCart() {
    if (!selectedVariant) return;
    onAddToCart({ variantId: selectedVariant.id, size: selectedVariant.size, color: selectedVariant.color, price: selectedVariant.retailPrice, quantity });
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 900);
  }

  const price = selectedVariant?.retailPrice ?? product.variants[0]?.retailPrice ?? 0;
  const canAdd = !!selectedVariant;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ ...GLASS, maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Gallery */}
        <div className="relative w-full" style={{ aspectRatio: "1/1", backgroundColor: "#0f0f0f", maxHeight: 300 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryImages[galleryIdx] ?? product.imageUrl}
            alt={product.title}
            className="w-full h-full object-contain"
          />
          {galleryImages.length > 1 && (
            <>
              <button
                onClick={() => setGalleryIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
              >
                <ChevronLeft size={14} className="text-white" />
              </button>
              <button
                onClick={() => setGalleryIdx((i) => (i + 1) % galleryImages.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
              >
                <ChevronRight size={14} className="text-white" />
              </button>
              {/* Dots */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {galleryImages.map((_, i) => (
                  <button key={i} onClick={() => setGalleryIdx(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ backgroundColor: i === galleryIdx ? "#D4A843" : "rgba(255,255,255,0.3)" }}
                  />
                ))}
              </div>
            </>
          )}
          {/* Thumbnails (self-fulfilled with multiple photos) */}
          {galleryImages.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 flex gap-1.5 px-3 pb-8 overflow-x-auto scrollbar-hide">
              {galleryImages.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={url} alt="" onClick={() => setGalleryIdx(i)}
                  className="shrink-0 w-10 h-10 rounded object-cover cursor-pointer transition-all"
                  style={{ border: i === galleryIdx ? "2px solid #D4A843" : "1px solid rgba(255,255,255,0.15)", opacity: i === galleryIdx ? 1 : 0.6 }}
                />
              ))}
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <X size={13} className="text-white" />
          </button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white leading-snug">{product.title}</h3>
            {product.description && (
              <p className="text-xs text-white/50 mt-1 leading-relaxed line-clamp-3">{product.description}</p>
            )}
            <p className="text-sm font-bold mt-2" style={{ color: "#D4A843" }}>
              ${price.toFixed(2)}
            </p>
          </div>

          {/* Colors */}
          {hasColors && uniqueColors.length > 1 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Color — {activeColor}</p>
              <div className="flex flex-wrap gap-2">
                {uniqueColors.map(({ color, colorCode }) => {
                  const active = activeColor === color;
                  return (
                    <button key={color} onClick={() => { setSelectedColor(color); setSelectedSize(null); }}
                      className="relative w-7 h-7 rounded-full transition-all shrink-0"
                      style={{
                        backgroundColor: colorCode || "#888",
                        border: active ? "2px solid #D4A843" : "2px solid transparent",
                        boxShadow: active ? "0 0 0 1px #D4A843" : "none",
                      }}
                    >
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isLight(colorCode) ? "#0A0A0A" : "#fff", opacity: 0.8 }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {!isOneSize && sizesForColor.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Size</p>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map((size) => {
                  const active = activeSize === size;
                  return (
                    <button key={size} onClick={() => setSelectedSize(size)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      style={{
                        borderColor:     active ? "#D4A843" : "rgba(255,255,255,0.12)",
                        backgroundColor: active ? "rgba(212,168,67,0.12)" : "transparent",
                        color:           active ? "#D4A843" : "rgba(255,255,255,0.5)",
                      }}
                    >{size}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <Minus size={12} className="text-white/60" />
            </button>
            <span className="text-sm font-bold text-white w-5 text-center tabular-nums">{quantity}</span>
            <button onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <Plus size={12} className="text-white/60" />
            </button>
            <span className="text-xs text-white/30 ml-1 tabular-nums">× ${price.toFixed(2)}</span>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={!canAdd || added}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
            style={{ backgroundColor: added ? "#34C759" : "#D4A843", color: "#0A0A0A" }}
          >
            {added ? (
              <><span>✓</span> Added to Cart!</>
            ) : (
              <><ShoppingBag size={14} /> Add to Cart · ${(price * quantity).toFixed(2)}</>
            )}
          </button>
          {!canAdd && !isOneSize && (
            <p className="text-[11px] text-white/30 text-center -mt-2">
              {!activeSize ? "Select a size to continue" : "Select a color and size"}
            </p>
          )}

          {/* Return policy */}
          <div className="text-[10px] text-white/25 text-center leading-relaxed px-2">
            {product.fulfillmentType === "POD" ? (
              "Custom printed to order. Defective or damaged items replaced at no cost. Contact the artist for any issues."
            ) : product.returnPolicy ? (
              product.returnPolicy
            ) : (
              "Contact the artist directly for return and refund inquiries."
            )}
          </div>

          <p className="text-[10px] text-white/20 text-center">Secure checkout powered by Stripe</p>
        </div>
      </div>
    </div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

type DrawerStep = "cart" | "address" | "review";

type ShippingAddr = {
  name: string; address1: string; address2: string;
  city: string; state: string; zip: string; country: string;
};

const EMPTY_ADDR: ShippingAddr = { name: "", address1: "", address2: "", city: "", state: "", zip: "", country: "US" };

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-white outline-none placeholder:text-white/20 focus:ring-1"
        style={{ borderColor: "rgba(255,255,255,0.12)", focusRingColor: "#D4A843" } as React.CSSProperties}
      />
    </div>
  );
}

function CartDrawer({
  cart,
  artistSlug,
  onClose,
  onUpdateQty,
  onRemove,
  onClear,
}: {
  cart:        CartItem[];
  artistSlug:  string;
  onClose:     () => void;
  onUpdateQty: (variantId: string, qty: number) => void;
  onRemove:    (variantId: string) => void;
  onClear:     () => void;
}) {
  const [step,         setStep        ] = useState<DrawerStep>("cart");
  const [email,        setEmail       ] = useState("");
  const [addr,         setAddr        ] = useState<ShippingAddr>(EMPTY_ADDR);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [estimating,   setEstimating  ] = useState(false);
  const [loading,      setLoading     ] = useState(false);
  const [error,        setError       ] = useState("");

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total    = subtotal + (shippingCost ?? 0);

  function setAddrField(field: keyof ShippingAddr) {
    return (v: string) => setAddr((prev) => ({ ...prev, [field]: v }));
  }

  async function handleGetShipping() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address."); return;
    }
    if (!addr.name || !addr.address1 || !addr.city || !addr.state || !addr.zip) {
      setError("Please fill in all required address fields."); return;
    }
    setEstimating(true); setError("");
    try {
      const res = await fetch("/api/merch/shipping-estimate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items:      cart.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          address:    addr,
          artistSlug,
        }),
      });
      const data = await res.json() as { shippingCost?: number; error?: string };
      if (!res.ok) { setError(data.error ?? "Could not estimate shipping."); return; }
      setShippingCost(data.shippingCost ?? 0);
      setStep("review");
    } catch {
      setError("Could not estimate shipping. Please try again.");
    } finally {
      setEstimating(false);
    }
  }

  async function handleCheckout() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/merch/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items:           cart.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          buyerEmail:      email.trim(),
          artistSlug,
          shippingAddress: addr,
          shippingCost:    shippingCost ?? 0,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Checkout failed. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const BORDER = { borderColor: "rgba(255,255,255,0.08)" };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Scrim */}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose} />

      {/* Drawer */}
      <div
        className="relative w-full max-w-sm h-full flex flex-col overflow-hidden"
        style={{ backgroundColor: "#121212", borderLeft: "1px solid rgba(212,168,67,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={BORDER}>
          <div className="flex items-center gap-2">
            {step !== "cart" && (
              <button onClick={() => setStep(step === "review" ? "address" : "cart")}
                className="text-white/40 hover:text-white/80 transition-colors mr-1">
                <ChevronLeft size={16} />
              </button>
            )}
            <ShoppingBag size={16} style={{ color: "#D4A843" }} />
            <span className="text-sm font-bold text-white">
              {step === "cart" ? `Cart (${cart.length} item${cart.length !== 1 ? "s" : ""})` : step === "address" ? "Shipping" : "Review Order"}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {(["cart","address","review"] as DrawerStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: step === s ? "#D4A843" : s === "cart" || (s === "address" && (step === "review" || step === "address")) ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.1)" }} />
              {i < 2 && <div className="w-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />}
            </div>
          ))}
          <span className="text-[10px] text-white/30 ml-1 capitalize">{step}</span>
        </div>

        {/* ── STEP 1: Cart ─────────────────────────── */}
        {step === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cart.map((item) => (
                <div key={item.variantId} className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.productImage} alt={item.productTitle}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{item.productTitle}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {item.size}{item.color && item.color !== "N/A" ? ` · ${item.color}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => onUpdateQty(item.variantId, Math.max(1, item.quantity - 1))}
                        className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <Minus size={10} className="text-white/60" />
                      </button>
                      <span className="text-xs text-white tabular-nums w-4 text-center">{item.quantity}</span>
                      <button onClick={() => onUpdateQty(item.variantId, Math.min(10, item.quantity + 1))}
                        className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <Plus size={10} className="text-white/60" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-white tabular-nums">${(item.price * item.quantity).toFixed(2)}</p>
                    <button onClick={() => onRemove(item.variantId)} className="mt-1 text-white/25 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-4 space-y-3 shrink-0" style={BORDER}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Subtotal</span>
                <span className="text-sm font-bold text-white tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-white/30">+ shipping calculated at next step</p>
              <button
                onClick={() => { setError(""); setStep("address"); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <ChevronRight size={14} /> Continue to Shipping
              </button>
              <button onClick={() => { onClear(); onClose(); }} className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-1">
                Clear cart
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Shipping Address ──────────────── */}
        {step === "address" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <Field label="Email *" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
              <Field label="Full name *" value={addr.name} onChange={setAddrField("name")} placeholder="Jane Smith" />
              <Field label="Address line 1 *" value={addr.address1} onChange={setAddrField("address1")} placeholder="123 Main St" />
              <Field label="Address line 2" value={addr.address2} onChange={setAddrField("address2")} placeholder="Apt 4B (optional)" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City *" value={addr.city} onChange={setAddrField("city")} placeholder="Chicago" />
                <Field label="State *" value={addr.state} onChange={setAddrField("state")} placeholder="IL" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ZIP *" value={addr.zip} onChange={setAddrField("zip")} placeholder="60601" />
                <Field label="Country *" value={addr.country} onChange={setAddrField("country")} placeholder="US" />
              </div>
            </div>
            <div className="border-t px-5 py-4 space-y-3 shrink-0" style={BORDER}>
              {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}
              <button
                onClick={handleGetShipping}
                disabled={estimating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:brightness-110"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {estimating ? <><Loader2 size={14} className="animate-spin" /> Calculating…</> : <><ChevronRight size={14} /> Get Shipping Rate</>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Review + Pay ─────────────────── */}
        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Items summary */}
              <div className="space-y-2">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Items</p>
                {cart.map((item) => (
                  <div key={item.variantId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.productTitle}</p>
                      <p className="text-[11px] text-white/40">
                        {item.size}{item.color && item.color !== "N/A" ? ` · ${item.color}` : ""} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-white tabular-nums shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Shipping address summary */}
              <div className="space-y-1 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Ships to</p>
                <p className="text-xs text-white">{addr.name}</p>
                <p className="text-[11px] text-white/50">{addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}</p>
                <p className="text-[11px] text-white/50">{addr.city}, {addr.state} {addr.zip}, {addr.country}</p>
                <p className="text-[11px] text-white/40">{email}</p>
              </div>

              {/* Order total */}
              <div className="space-y-1.5 border-t pt-3" style={BORDER}>
                <div className="flex justify-between text-xs text-white/50">
                  <span>Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/50">
                  <span>Shipping</span>
                  <span className="tabular-nums">{shippingCost === 0 ? "Free" : `$${(shippingCost ?? 0).toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t pt-2" style={BORDER}>
                  <span>Total</span><span className="tabular-nums">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="border-t px-5 py-4 space-y-3 shrink-0" style={BORDER}>
              {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:brightness-110"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                  : <><ShoppingBag size={14} /> Pay ${total.toFixed(2)}</>}
              </button>
              <p className="text-[10px] text-white/25 text-center leading-relaxed">
                Custom printed items are made to order. Defective items replaced at no cost.
              </p>
              <p className="text-[10px] text-white/20 text-center">Secure checkout powered by Stripe</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MerchGrid ────────────────────────────────────────────────────────────────

export default function MerchGrid({
  products,
  artistSlug,
  justPurchased = false,
  fullPage = false,
}: {
  products:       MerchProduct[];
  artistSlug:     string;
  justPurchased?: boolean;
  fullPage?:      boolean;
}) {
  const [openProduct, setOpenProduct] = useState<MerchProduct | null>(null);
  const [cart,        setCart       ] = useState<CartItem[]>([]);
  const [cartOpen,    setCartOpen   ] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  }, []);

  if (!products.length) return null;

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  function addToCart(product: MerchProduct, item: Omit<CartItem, "productId" | "productTitle" | "productImage">) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === item.variantId);
      if (existing) {
        return prev.map((c) =>
          c.variantId === item.variantId
            ? { ...c, quantity: Math.min(10, c.quantity + item.quantity) }
            : c,
        );
      }
      return [...prev, {
        ...item,
        productId:    product.id,
        productTitle: product.title,
        productImage: product.imageUrl,
      }];
    });
    setCartOpen(true);
  }

  function updateQty(variantId: string, qty: number) {
    setCart((prev) => prev.map((c) => c.variantId === variantId ? { ...c, quantity: qty } : c));
  }

  function removeItem(variantId: string) {
    setCart((prev) => prev.filter((c) => c.variantId !== variantId));
  }

  return (
    <>
      {/* Success banner */}
      {justPurchased && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2 mb-4"
          style={{ backgroundColor: "rgba(52,199,89,0.1)", border: "1px solid rgba(52,199,89,0.25)", color: "#34C759" }}
        >
          <ShoppingBag size={14} className="shrink-0" />
          Order placed! Check your email for confirmation and shipping updates.
        </div>
      )}

      <section>
        {/* Header */}
        {!fullPage && (
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase mb-[2px]" style={{ color: "#D4A843", letterSpacing: "1.5px" }}>SHOP</p>
              <h2 className="text-[18px] font-semibold text-white leading-tight">Merch</h2>
            </div>
            <div className="flex items-center gap-3">
              {cartCount > 0 && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <ShoppingBag size={13} />
                  Cart ({cartCount})
                </button>
              )}
              <Link href={`/${artistSlug}/merch`}
                className="text-[11px] font-semibold no-underline transition-colors hover:brightness-125"
                style={{ color: "rgba(212,168,67,0.7)" }}
              >
                View All →
              </Link>
            </div>
          </div>
        )}

        {fullPage ? (
          /* Full-page grid layout */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={() => setOpenProduct(p)} />
            ))}
          </div>
        ) : (
          /* Horizontal scroll row with carousel arrows */
          <div className="relative">
            {/* Left arrow */}
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:brightness-125"
              style={{ backgroundColor: "rgba(20,20,20,0.9)", border: "1px solid rgba(212,168,67,0.3)" }}
              aria-label="Scroll left"
            >
              <ChevronLeft size={14} style={{ color: "#D4A843" }} />
            </button>

            <div ref={scrollRef} className="flex gap-[10px] overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={() => setOpenProduct(p)} />
              ))}
              <ViewAllCard artistSlug={artistSlug} />
            </div>

            {/* Right arrow */}
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:brightness-125"
              style={{ backgroundColor: "rgba(20,20,20,0.9)", border: "1px solid rgba(212,168,67,0.3)" }}
              aria-label="Scroll right"
            >
              <ChevronRight size={14} style={{ color: "#D4A843" }} />
            </button>
          </div>
        )}
      </section>

      {/* Product modal */}
      {openProduct && (
        <ProductModal
          product={openProduct}
          onClose={() => setOpenProduct(null)}
          onAddToCart={(item) => { addToCart(openProduct, item); setOpenProduct(null); }}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && cart.length > 0 && (
        <CartDrawer
          cart={cart}
          artistSlug={artistSlug}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onClear={() => setCart([])}
        />
      )}
    </>
  );
}
