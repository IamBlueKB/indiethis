"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  X,
  Check,
  Loader2,
  Compass,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LinkedArtist = { id: string; name: string; image: string | null };

type FeatureCard = {
  id: string;
  type: string;
  headline: string;
  description: string | null;
  imageUrl: string | null;
  gradient: string | null;
  ctaText: string;
  ctaUrl: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  linkedArtistId: string | null;
  linkedArtist: LinkedArtist | null;
  createdAt: string;
};

const CARD_TYPES = [
  { value: "ANNOUNCEMENT",     label: "Announcement" },
  { value: "ARTIST_SPOTLIGHT", label: "Artist Spotlight" },
  { value: "BEAT_PACK",        label: "Beat Pack" },
  { value: "STUDIO_PROMO",     label: "Studio Promo" },
  { value: "AI_SHOWCASE",      label: "AI Showcase" },
];

const TYPE_COLORS: Record<string, string> = {
  ANNOUNCEMENT:     "#6B7280",
  ARTIST_SPOTLIGHT: "#D4A843",
  BEAT_PACK:        "#8B5CF6",
  STUDIO_PROMO:     "#3B82F6",
  AI_SHOWCASE:      "#10B981",
};

const DEFAULT_GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #D4A843 100%)",
  "linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)",
  "linear-gradient(135deg, #1a0533 0%, #3b0764 50%, #7e22ce 100%)",
  "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
];

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

type FormState = {
  type: string;
  headline: string;
  description: string;
  imageUrl: string;
  gradient: string;
  ctaText: string;
  ctaUrl: string;
  isActive: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
  linkedArtistId: string;
};

function emptyForm(): FormState {
  return {
    type: "ANNOUNCEMENT",
    headline: "",
    description: "",
    imageUrl: "",
    gradient: DEFAULT_GRADIENTS[0],
    ctaText: "Learn More",
    ctaUrl: "",
    isActive: true,
    sortOrder: "0",
    startsAt: "",
    endsAt: "",
    linkedArtistId: "",
  };
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function CardModal({
  card,
  onClose,
  onSave,
}: {
  card: FeatureCard | null; // null = create new
  onClose: () => void;
  onSave: (data: Partial<FeatureCard>) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!card) return emptyForm();
    return {
      type:          card.type,
      headline:      card.headline,
      description:   card.description ?? "",
      imageUrl:      card.imageUrl    ?? "",
      gradient:      card.gradient    ?? DEFAULT_GRADIENTS[0],
      ctaText:       card.ctaText,
      ctaUrl:        card.ctaUrl,
      isActive:      card.isActive,
      sortOrder:     String(card.sortOrder),
      startsAt:      card.startsAt ? card.startsAt.slice(0, 16) : "",
      endsAt:        card.endsAt   ? card.endsAt.slice(0, 16)   : "",
      linkedArtistId: card.linkedArtistId ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (key: keyof FormState, val: string | boolean) =>
    setForm((p) => ({ ...p, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.headline.trim()) { setError("Headline is required"); return; }
    if (!form.ctaUrl.trim())   { setError("CTA URL is required");  return; }
    setSaving(true);
    try {
      await onSave({
        type:          form.type,
        headline:      form.headline.trim(),
        description:   form.description.trim() || null,
        imageUrl:      form.imageUrl.trim()     || null,
        gradient:      form.gradient.trim()     || null,
        ctaText:       form.ctaText.trim()      || "Learn More",
        ctaUrl:        form.ctaUrl.trim(),
        isActive:      form.isActive,
        sortOrder:     parseInt(form.sortOrder) || 0,
        startsAt:      form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt:        form.endsAt   ? new Date(form.endsAt).toISOString()   : null,
        linkedArtistId: form.linkedArtistId.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-semibold text-foreground">
            {card ? "Edit Feature Card" : "New Feature Card"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Preview strip */}
        <div
          className="relative h-20 flex items-center px-6"
          style={{ background: form.gradient || DEFAULT_GRADIENTS[0] }}
        >
          {form.imageUrl && (
            <img src={form.imageUrl} alt="" className="h-16 w-16 object-cover rounded-lg mr-4 border-2 border-white/20" />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">{form.type.replace(/_/g, " ")}</p>
            <p className="text-white font-bold text-base leading-tight">{form.headline || "Headline preview"}</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Type + Sort order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                {CARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Headline *</label>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => set("headline", e.target.value)}
              placeholder="Your big, bold headline"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short supporting description"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CTA Text</label>
              <input
                type="text"
                value={form.ctaText}
                onChange={(e) => set("ctaText", e.target.value)}
                placeholder="Learn More"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CTA URL *</label>
              <input
                type="url"
                value={form.ctaUrl}
                onChange={(e) => set("ctaUrl", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Gradient */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Background Gradient (CSS)</label>
            <div className="flex gap-2 mb-2">
              {DEFAULT_GRADIENTS.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => set("gradient", g)}
                  className="w-8 h-8 rounded-md border-2 shrink-0 transition-transform hover:scale-110"
                  style={{
                    background: g,
                    borderColor: form.gradient === g ? "#D4A843" : "transparent",
                  }}
                />
              ))}
            </div>
            <input
              type="text"
              value={form.gradient}
              onChange={(e) => set("gradient", e.target.value)}
              placeholder="linear-gradient(135deg, #0a0a0a, #1a1a1a)"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none font-mono"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          {/* Linked Artist ID */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Artist ID (optional)</label>
            <input
              type="text"
              value={form.linkedArtistId}
              onChange={(e) => set("linkedArtistId", e.target.value)}
              placeholder="User ID of artist to spotlight"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground font-mono focus:outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set("isActive", !form.isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${form.isActive ? "bg-green-500" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
            <span className="text-sm text-foreground">{form.isActive ? "Active — shows on Explore" : "Inactive — hidden from Explore"}</span>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-black disabled:opacity-50"
              style={{ backgroundColor: "#D4A843" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {card ? "Save Changes" : "Create Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm delete dialog
// ---------------------------------------------------------------------------

function DeleteConfirm({
  headline,
  onCancel,
  onConfirm,
  loading,
}: {
  headline: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border p-6 shadow-2xl"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-base font-semibold text-foreground mb-2">Delete Feature Card?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          &ldquo;{headline}&rdquo; will be permanently removed from the Explore carousel.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border text-muted-foreground hover:text-foreground transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ExploreContent() {
  const [cards, setCards] = useState<FeatureCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editCard, setEditCard]     = useState<FeatureCard | null>(null);
  const [deleteCard, setDeleteCard] = useState<FeatureCard | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [toggling, setToggling]     = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/explore");
      const data = await res.json() as { cards: FeatureCard[] };
      setCards(data.cards ?? []);
    } catch {
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function handleSave(data: Partial<FeatureCard>) {
    if (editCard) {
      const res = await fetch(`/api/admin/explore/${editCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
    } else {
      const res = await fetch("/api/admin/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Create failed");
    }
    await fetchCards();
  }

  async function handleDelete() {
    if (!deleteCard) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/explore/${deleteCard.id}`, { method: "DELETE" });
      await fetchCards();
      setDeleteCard(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(card: FeatureCard) {
    setToggling(card.id);
    try {
      await fetch(`/api/admin/explore/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !card.isActive }),
      });
      await fetchCards();
    } finally {
      setToggling(null);
    }
  }

  function openCreate() {
    setEditCard(null);
    setShowModal(true);
  }

  function openEdit(card: FeatureCard) {
    setEditCard(card);
    setShowModal(true);
  }

  const activeCount   = cards.filter((c) => c.isActive).length;
  const inactiveCount = cards.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass size={24} style={{ color: "#D4A843" }} />
            Explore Carousel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage featured cards shown at the top of the public Explore page
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black"
          style={{ backgroundColor: "#D4A843" }}
        >
          <Plus size={16} />
          New Card
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Cards",   value: cards.length,  color: "#D4A843" },
          { label: "Active",        value: activeCount,   color: "#10B981" },
          { label: "Inactive",      value: inactiveCount, color: "#6B7280" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-950/30 border border-red-800/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Cards list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : cards.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Compass size={40} className="text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No feature cards yet</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-black"
            style={{ backgroundColor: "#D4A843" }}
          >
            Create your first card
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const typeColor = TYPE_COLORS[card.type] ?? "#6B7280";
            const isScheduled = card.startsAt || card.endsAt;
            return (
              <div
                key={card.id}
                className="rounded-xl border overflow-hidden"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: card.isActive ? "var(--border)" : "var(--border)",
                  opacity: card.isActive ? 1 : 0.6,
                }}
              >
                <div className="flex items-stretch">
                  {/* Color strip */}
                  <div className="w-1 shrink-0" style={{ backgroundColor: typeColor }} />

                  {/* Gradient preview */}
                  <div
                    className="w-24 shrink-0 flex items-center justify-center"
                    style={{ background: card.gradient ?? DEFAULT_GRADIENTS[0] }}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt="" className="h-12 w-12 object-cover rounded-lg border border-white/20" />
                    ) : (
                      <ImageIcon size={20} className="text-white/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: typeColor + "22", color: typeColor }}
                      >
                        {card.type.replace(/_/g, " ")}
                      </span>
                      {!card.isActive && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          INACTIVE
                        </span>
                      )}
                      {isScheduled && (
                        <span className="text-[10px] font-medium text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded">
                          SCHEDULED
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Sort: {card.sortOrder}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{card.headline}</p>
                    {card.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{card.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">CTA:</span>
                      <span className="text-xs font-medium" style={{ color: "#D4A843" }}>{card.ctaText}</span>
                      <span className="text-xs text-muted-foreground mx-1">→</span>
                      <a
                        href={card.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline truncate max-w-[200px] flex items-center gap-0.5"
                      >
                        {card.ctaUrl}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {card.linkedArtist && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Linked artist: <span className="text-foreground">{card.linkedArtist.name}</span>
                      </p>
                    )}
                    {isScheduled && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {card.startsAt && <>From {new Date(card.startsAt).toLocaleDateString()}</>}
                        {card.startsAt && card.endsAt && " — "}
                        {card.endsAt && <>Until {new Date(card.endsAt).toLocaleDateString()}</>}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 px-3 shrink-0">
                    <button
                      onClick={() => handleToggleActive(card)}
                      disabled={toggling === card.id}
                      className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={card.isActive ? "Deactivate" : "Activate"}
                    >
                      {toggling === card.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : card.isActive
                          ? <Eye size={15} />
                          : <EyeOff size={15} />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(card)}
                      className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteCard(card)}
                      className="p-2 rounded-lg hover:bg-red-950/30 text-muted-foreground hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                    <div className="text-muted-foreground/30 cursor-grab ml-1">
                      <GripVertical size={15} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Cards are displayed in ascending sort-order on the public{" "}
        <a href="/explore" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          /explore
        </a>{" "}
        page. Use the sort order field to control position. Only active cards within their scheduled date range are shown.
      </p>

      {/* Modals */}
      {showModal && (
        <CardModal
          card={editCard}
          onClose={() => { setShowModal(false); setEditCard(null); }}
          onSave={handleSave}
        />
      )}
      {deleteCard && (
        <DeleteConfirm
          headline={deleteCard.headline}
          onCancel={() => setDeleteCard(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
