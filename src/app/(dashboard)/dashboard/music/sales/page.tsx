"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Music2, Plus, Trash2, Eye, EyeOff, DollarSign, Loader2,
  ShoppingCart, Package, CheckCircle2, X, Upload,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type DigitalProduct = {
  id: string;
  type: "SINGLE" | "ALBUM";
  title: string;
  price: number; // cents
  description: string | null;
  coverArtUrl: string | null;
  published: boolean;
  createdAt: string;
  _count: { tracks: number; purchases: number };
};

type Track = {
  id: string;
  title: string;
  coverArtUrl: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Create Product Modal ─────────────────────────────────────────────────────

function CreateProductModal({
  type,
  tracks,
  onClose,
  onCreate,
}: {
  type: "SINGLE" | "ALBUM";
  tracks: Track[];
  onClose: () => void;
  onCreate: (product: DigitalProduct) => void;
}) {
  const [title, setTitle]         = useState("");
  const [priceStr, setPriceStr]   = useState(type === "SINGLE" ? "0.99" : "4.99");
  const [description, setDesc]    = useState("");
  const [coverArtUrl, setCover]   = useState("");
  const [selectedTracks, setSel]  = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const { startUpload } = useUploadThing("albumArt");

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await startUpload([file]);
      if (res?.[0]?.url) setCover(res[0].url);
    } catch {
      setError("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceInCents = Math.round(parseFloat(priceStr) * 100);
    if (isNaN(priceInCents)) { setError("Invalid price"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/digital-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          price: priceInCents,
          description: description.trim() || undefined,
          coverArtUrl: coverArtUrl || undefined,
          trackIds: selectedTracks,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create product"); return; }
      onCreate(data.product);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function toggleTrack(id: string) {
    if (type === "SINGLE") {
      setSel([id]);
    } else {
      setSel((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-lg rounded-xl border p-6 overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            Create {type === "SINGLE" ? "Single" : "Album"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: "var(--border)" }}
              placeholder={type === "SINGLE" ? "Track name" : "Album title"}
              required
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Price {type === "SINGLE" ? "($0.99–$99.99)" : "($4.99–$99.99)"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm bg-transparent"
                style={{ borderColor: "var(--border)" }}
                type="number"
                step="0.01"
                min={type === "SINGLE" ? "0.99" : "4.99"}
                max="99.99"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent resize-none"
              style={{ borderColor: "var(--border)" }}
              placeholder="About this release..."
            />
          </div>

          {/* Cover Art */}
          <div>
            <label className="block text-sm font-medium mb-1">Cover Art (optional)</label>
            {coverArtUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverArtUrl} alt="Cover" className="w-16 h-16 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => setCover("")}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Uploading..." : "Upload image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Track Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {type === "SINGLE" ? "Select Track *" : "Select Tracks *"}
            </label>
            {tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracks uploaded yet. Upload tracks first in Music.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {tracks.map((track) => {
                  const isSelected = selectedTracks.includes(track.id);
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => toggleTrack(track.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        isSelected
                          ? "border"
                          : "border hover:bg-white/5"
                      }`}
                      style={{
                        borderColor: isSelected ? "#D4A843" : "var(--border)",
                        backgroundColor: isSelected ? "rgba(212,168,67,0.08)" : undefined,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden"
                      >
                        {track.coverArtUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music2 size={14} className="text-muted-foreground" />
                        )}
                      </div>
                      <span className="truncate flex-1">{track.title}</span>
                      {isSelected && (
                        <CheckCircle2 size={14} style={{ color: "#D4A843" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading || !title.trim() || selectedTracks.length === 0}
              className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              Create {type === "SINGLE" ? "Single" : "Album"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onTogglePublished,
  onDelete,
}: {
  product: DigitalProduct;
  onTogglePublished: (id: string, published: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/dashboard/digital-products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !product.published }),
      });
      if (res.ok) onTogglePublished(product.id, !product.published);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/digital-products/${product.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDelete(product.id);
    } finally {
      setDeleting(false);
    }
  }

  const revenue = product._count.purchases * product.price * 0.9; // 90% after platform fee

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="flex gap-4 p-4">
        {/* Cover Art */}
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
          {product.coverArtUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.coverArtUrl} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <Package size={24} className="text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{product.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: product.type === "SINGLE" ? "rgba(212,168,67,0.15)" : "rgba(96,165,250,0.15)",
                    color: product.type === "SINGLE" ? "#D4A843" : "#60a5fa",
                  }}
                >
                  {product.type}
                </span>
                <span className="text-xs text-muted-foreground">{formatCents(product.price)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleToggle}
                disabled={toggling}
                title={product.published ? "Unpublish" : "Publish"}
                className={`p-1.5 rounded-lg transition-colors ${
                  product.published ? "text-green-400 hover:text-green-300" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {toggling ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : product.published ? (
                  <Eye size={15} />
                ) : (
                  <EyeOff size={15} />
                )}
              </button>
              {product._count.purchases === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                >
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Music2 size={11} />
              {product._count.tracks} {product._count.tracks === 1 ? "track" : "tracks"}
            </span>
            <span className="flex items-center gap-1">
              <ShoppingCart size={11} />
              {product._count.purchases} {product._count.purchases === 1 ? "sale" : "sales"}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              {formatCents(Math.round(revenue))} earned
            </span>
          </div>
        </div>
      </div>

      {!product.published && (
        <div
          className="px-4 py-2 text-xs border-t"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          Draft — toggle to publish on your artist page
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DigitalSalesPage() {
  const [products, setProducts]           = useState<DigitalProduct[]>([]);
  const [tracks, setTracks]               = useState<Track[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<"SINGLE" | "ALBUM">("SINGLE");
  const [showCreate, setShowCreate]       = useState<"SINGLE" | "ALBUM" | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, trackRes] = await Promise.all([
        fetch("/api/dashboard/digital-products"),
        fetch("/api/dashboard/tracks"),
      ]);
      const [prodData, trackData] = await Promise.all([prodRes.json(), trackRes.json()]);
      setProducts(prodData.products ?? []);
      setTracks(trackData.tracks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  function handleCreated(product: DigitalProduct) {
    setProducts((prev) => [product, ...prev]);
  }

  function handleTogglePublished(id: string, published: boolean) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, published } : p));
  }

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = products.filter((p) => p.type === tab);
  const singles = products.filter((p) => p.type === "SINGLE");
  const albums  = products.filter((p) => p.type === "ALBUM");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Digital Sales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sell singles and albums directly to your fans. You keep 90%.
        </p>
      </div>

      {/* Tabs + Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          {(["SINGLE", "ALBUM"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors`}
              style={
                tab === t
                  ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {t === "SINGLE" ? "Singles" : "Albums"}{" "}
              <span className="ml-1 opacity-60 text-xs">
                ({t === "SINGLE" ? singles.length : albums.length})
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreate(tab)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          Create {tab === "SINGLE" ? "Single" : "Album"}
        </button>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
        >
          <Package size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            No {tab === "SINGLE" ? "singles" : "albums"} yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first {tab === "SINGLE" ? "single" : "album"} to start selling music directly to your fans.
          </p>
          <button
            onClick={() => setShowCreate(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Plus size={13} className="inline mr-1" />
            Create {tab === "SINGLE" ? "Single" : "Album"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onTogglePublished={handleTogglePublished}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateProductModal
          type={showCreate}
          tracks={tracks}
          onClose={() => setShowCreate(null)}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
}
