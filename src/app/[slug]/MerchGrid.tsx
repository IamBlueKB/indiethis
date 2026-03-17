"use client";

import { useState } from "react";
import { ShoppingBag, X, Loader2, Plus, Minus, Tag } from "lucide-react";

type MerchProduct = {
  id: string;
  title: string;
  imageUrl: string;
  basePrice: number;
  artistMarkup: number;
  productType: string;
};

const TYPE_LABELS: Record<string, string> = {
  TSHIRT: "T-Shirt", HOODIE: "Hoodie", POSTER: "Poster",
  PHONECASE: "Phone Case", HAT: "Hat", STICKER: "Sticker", MUG: "Mug",
};

export default function MerchGrid({
  products,
  artistSlug,
  justPurchased = false,
}: {
  products: MerchProduct[];
  artistSlug: string;
  justPurchased?: boolean;
}) {
  const [selected, setSelected] = useState<MerchProduct | null>(null);
  const [email, setEmail]       = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected!.id,
          buyerEmail: email.trim(),
          quantity,
          artistSlug,
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

  const sellingPrice = selected ? selected.basePrice + selected.artistMarkup : 0;
  const totalPrice   = sellingPrice * quantity;

  return (
    <>
      {/* Success banner — shown after Stripe redirect back */}
      {justPurchased && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{
            backgroundColor: "rgba(52,199,89,0.1)",
            border: "1px solid rgba(52,199,89,0.25)",
            color: "#34C759",
          }}
        >
          <ShoppingBag size={14} className="shrink-0" />
          Order placed! Check your email for confirmation and shipping updates.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Merch
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {products.map((p) => {
            const price = p.basePrice + p.artistMarkup;
            return (
              <div
                key={p.id}
                className="rounded-2xl border overflow-hidden group"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Product image with hover overlay */}
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3C/svg%3E";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300" />
                  <button
                    onClick={() => {
                      setSelected(p);
                      setQuantity(1);
                      setEmail("");
                      setError("");
                    }}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 whitespace-nowrap"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    Buy Now
                  </button>
                </div>

                {/* Product info */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{p.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold" style={{ color: "#D4A843" }}>
                      ${price.toFixed(2)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Tag size={8} /> {TYPE_LABELS[p.productType] ?? p.productType}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Purchase modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.imageUrl}
                  alt={selected.title}
                  className="w-10 h-10 rounded-xl object-cover shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3C/svg%3E";
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{selected.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[selected.productType] ?? selected.productType}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
                placeholder="you@example.com"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Minus size={12} className="text-foreground" />
                </button>
                <span className="text-sm font-bold text-foreground w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Plus size={12} className="text-foreground" />
                </button>
                <span className="text-xs text-muted-foreground ml-1">
                  ${sellingPrice.toFixed(2)} each
                </span>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Redirecting to checkout…</>
              ) : (
                <><ShoppingBag size={14} /> Checkout · ${totalPrice.toFixed(2)}</>
              )}
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Secure checkout powered by Stripe
            </p>
          </div>
        </div>
      )}
    </>
  );
}
