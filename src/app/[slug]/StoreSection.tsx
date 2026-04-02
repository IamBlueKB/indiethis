"use client";

import { useState } from "react";
import { ShoppingCart, Package, X, Loader2, Music2 } from "lucide-react";

export type DigitalProductPublic = {
  id: string;
  title: string;
  type: "SINGLE" | "EP" | "ALBUM" | "SAMPLE_PACK";
  price: number; // cents
  coverArtUrl: string | null;
  description: string | null;
  _count: { tracks: number };
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────

function BuyModal({
  product,
  artistName,
  onClose,
}: {
  product: DigitalProductPublic;
  artistName: string;
  onClose: () => void;
}) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/digital-products/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, buyerEmail: email }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ backgroundColor: "#111", borderColor: "#333" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-white">{product.title}</p>
            <p className="text-sm text-gray-400">{artistName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 rounded-lg" style={{ backgroundColor: "#1a1a1a" }}>
          <div className="w-12 h-12 rounded overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            {product.coverArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.coverArtUrl} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <Package size={20} className="text-gray-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{product.title}</p>
            <p className="text-xs text-gray-400">
              {product.type} · {product._count.tracks} {product._count.tracks === 1 ? "track" : "tracks"}
            </p>
          </div>
          <span className="ml-auto text-lg font-bold" style={{ color: "#D4A843" }}>
            {formatCents(product.price)}
          </span>
        </div>

        <form onSubmit={handleBuy} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Your email (for download link)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full rounded-lg px-3 py-2 text-sm text-white bg-transparent border"
              style={{ borderColor: "#444" }}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
            {loading ? "Redirecting to checkout..." : `Buy for ${formatCents(product.price)}`}
          </button>
          <p className="text-center text-xs text-gray-500">
            Secure checkout · Download link sent to email
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  artistName,
}: {
  product: DigitalProductPublic;
  artistName: string;
}) {
  const [showBuy, setShowBuy] = useState(false);

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden cursor-pointer transition-all hover:border-yellow-500/50"
        style={{ borderColor: "#222", backgroundColor: "#111" }}
        onClick={() => setShowBuy(true)}
      >
        {/* Cover Art */}
        <div className="aspect-square overflow-hidden bg-white/5 flex items-center justify-center">
          {product.coverArtUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverArtUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Music2 size={40} className="text-gray-600" />
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="font-medium text-sm text-white truncate">{product.title}</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: product.type === "SINGLE" ? "rgba(212,168,67,0.15)" : "rgba(96,165,250,0.15)",
                  color: product.type === "SINGLE" ? "#D4A843" : "#60a5fa",
                }}
              >
                {product.type}
              </span>
              <span className="text-xs text-gray-500">
                {product._count.tracks} {product._count.tracks === 1 ? "track" : "tracks"}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: "#D4A843" }}>
              {formatCents(product.price)}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowBuy(true); }}
            className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <ShoppingCart size={12} />
            Buy
          </button>
        </div>
      </div>

      {showBuy && (
        <BuyModal
          product={product}
          artistName={artistName}
          onClose={() => setShowBuy(false)}
        />
      )}
    </>
  );
}

// ─── Store Section ────────────────────────────────────────────────────────────

export default function StoreSection({
  products,
  artistName,
}: {
  products: DigitalProductPublic[];
  artistName: string;
}) {
  if (products.length === 0) return null;

  return (
    <div id="store">
      <h2 className="text-xl font-bold text-white mb-4">Store</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} artistName={artistName} />
        ))}
      </div>
    </div>
  );
}
