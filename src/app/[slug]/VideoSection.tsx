"use client";

import { useState } from "react";
import { Play, Pause, Video, X, Music2, ShoppingBag, Radio, Minus, Plus } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-utils";
import { useAudioStore, type AudioTrack } from "@/store";
import type { VideoType, VideoCategory } from "@prisma/client";
import BeatLicenseModal from "@/components/beats/BeatLicenseModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkedTrack = {
  id:          string;
  title:       string;
  coverArtUrl: string | null;
  price:       number | null;
  fileUrl:     string;
  beatLeaseSettings: { streamLeaseEnabled: boolean } | null;
};

type LinkedBeat = {
  id:          string;
  title:       string;
  coverArtUrl: string | null;
  price:       number | null;
  bpm:         number | null;
  musicalKey:  string | null;
  fileUrl:     string;
  beatLeaseSettings: { streamLeaseEnabled: boolean } | null;
  artist?: {
    name:       string;
    artistName: string | null;
    artistSlug: string | null;
    producerProfile?: {
      defaultNonExclusivePrice: number | null;
      defaultExclusivePrice:    number | null;
    } | null;
  } | null;
};

type LinkedMerch = {
  id:           string;
  title:        string;
  imageUrl:     string;
  basePrice:    number;
  artistMarkup: number;
  productType:  string;
};

export type ArtistVideo = {
  id:             string;
  title:          string;
  videoUrl:       string | null;
  thumbnailUrl:   string | null;
  embedUrl:       string | null;
  type:           VideoType;
  category:       VideoCategory | null;
  syncedFromYouTube?: boolean;
  linkedTrack:    LinkedTrack | null;
  linkedBeat:     LinkedBeat  | null;
  linkedMerch:    LinkedMerch | null;
};

type Props = {
  artistVideos?: ArtistVideo[];
  artistSlug:    string;
  artistName:    string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  LIVE:      { bg: "rgba(232,93,74,0.85)",   color: "#fff"    },
  SESSION:   { bg: "rgba(212,168,67,0.85)",  color: "#0A0A0A" },
  FREESTYLE: { bg: "rgba(255,255,255,0.85)", color: "#0A0A0A" },
  BTS:       { bg: "rgba(150,150,150,0.85)", color: "#fff"    },
  ACOUSTIC:  { bg: "rgba(29,158,117,0.85)",  color: "#fff"    },
  REHEARSAL: { bg: "rgba(127,119,221,0.85)", color: "#fff"    },
};

const SIZED_TYPES = new Set(["TSHIRT", "HOODIE"]);
const HAT_TYPES   = new Set(["HAT"]);
const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const HAT_SIZES     = ["S/M", "L/XL"];
function getSizes(productType: string): string[] | null {
  if (SIZED_TYPES.has(productType)) return APPAREL_SIZES;
  if (HAT_TYPES.has(productType))   return HAT_SIZES;
  return null;
}

// ─── Track Buy Modal ──────────────────────────────────────────────────────────

function TrackBuyModal({ track, artistSlug, onClose }: { track: LinkedTrack; artistSlug: string; onClose: () => void }) {
  const [buying, setBuying] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleBuy() {
    setBuying(true);
    setError(null);
    try {
      const res  = await fetch("/api/public/tracks/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ trackId: track.id, artistSlug }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error ?? "Checkout unavailable. Try again later.");
    } catch {
      setError("Network error. Try again.");
    }
    setBuying(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="rounded-2xl border w-full max-w-md p-6 space-y-5"
        style={{ backgroundColor: "var(--card, #1a1a1a)", borderColor: "var(--border, rgba(255,255,255,0.1))" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Buy Track</p>
            <p className="text-base font-bold text-foreground truncate">{track.title}</p>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {track.coverArtUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.coverArtUrl} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.06)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Digital Download</p>
            <p className="text-sm font-bold text-foreground">${track.price!.toFixed(2)}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">One-time purchase. Instant download.</p>
        </div>
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border, rgba(255,255,255,0.1))", color: "var(--foreground, #fff)" }}>
            Cancel
          </button>
          <button onClick={() => void handleBuy()} disabled={buying}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            {buying ? "Processing…" : `Purchase — $${track.price!.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Merch Quick-Add Modal ────────────────────────────────────────────────────

function MerchQuickAdd({
  product,
  artistSlug,
  onClose,
}: {
  product:    LinkedMerch;
  artistSlug: string;
  onClose:    () => void;
}) {
  const sizes   = getSizes(product.productType);
  const [size,     setSize]     = useState<string>(sizes?.[2] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [email,    setEmail]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const sellingPrice = product.basePrice + product.artistMarkup;
  const totalPrice   = sellingPrice * quantity;

  async function handleCheckout() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email."); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/merch/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ productId: product.id, buyerEmail: email.trim(), quantity, artistSlug, size: size || undefined }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { setError(data.error || "Checkout failed. Please try again."); setLoading(false); }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
        style={{ backgroundColor: "rgba(18,18,18,0.97)", border: "1px solid rgba(212,168,67,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt={product.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            <div>
              <p className="text-sm font-bold text-white leading-snug line-clamp-2">{product.title}</p>
              <p className="text-xs text-white/40 mt-0.5">
                ${sellingPrice.toFixed(2)} each
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1"><X size={15} /></button>
        </div>

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
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mr-auto">Qty</p>
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Minus size={12} className="text-white/60" />
          </button>
          <span className="text-sm font-semibold text-white w-4 text-center">{quantity}</span>
          <button onClick={() => setQuantity((q) => Math.min(10, q + 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Plus size={12} className="text-white/60" />
          </button>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email for order confirmation"
          className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={loading || !email.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            backgroundColor: loading || !email.trim() ? "rgba(212,168,67,0.2)" : "#D4A843",
            color:           loading || !email.trim() ? "#D4A843" : "#0A0A0A",
          }}
        >
          {loading ? "Redirecting…" : `Buy — $${totalPrice.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

// ─── Product CTA Card ─────────────────────────────────────────────────────────
// Compact one-row card: thumbnail left, info center, CTA button right.
// Sits directly below the video (same width).

function ProductCTA({
  video,
  artistSlug,
  artistName,
}: {
  video:      ArtistVideo;
  artistSlug: string;
  artistName: string;
}) {
  const { play, pause, resume, currentTrack, isPlaying } = useAudioStore();
  const [merchOpen,      setMerchOpen]      = useState(false);
  const [beatModalOpen,  setBeatModalOpen]  = useState(false);
  const [trackBuyOpen,   setTrackBuyOpen]   = useState(false);

  // Track CTA
  if (video.linkedTrack) {
    const track = video.linkedTrack;
    const isThis        = currentTrack?.id === track.id;
    const isThisPlaying = isThis && isPlaying;

    function handlePlay() {
      if (isThis) { isThisPlaying ? pause() : resume(); return; }
      const at: AudioTrack = {
        id:       track.id,
        title:    track.title,
        artist:   artistName,
        src:      track.fileUrl,
        coverArt: track.coverArtUrl ?? undefined,
      };
      play(at);
    }

    return (
      <>
      <div style={{
        backgroundColor: "#111",
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 6,
      }}>
        {/* Art */}
        {track.coverArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverArtUrl} alt="" style={{ width: 32, height: 32, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 5, backgroundColor: "#1a1a1a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Music2 size={14} style={{ color: "#444" }} />
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
            {track.title}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          <button
            onClick={handlePlay}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 6, border: "none",
              backgroundColor: isThisPlaying ? "rgba(212,168,67,0.2)" : "rgba(212,168,67,0.15)",
              color: "#D4A843", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >
            {isThisPlaying ? <Pause size={10} fill="#D4A843" /> : <Play size={10} fill="#D4A843" style={{ marginLeft: 1 }} />}
            {isThisPlaying ? "Pause" : "Listen"}
          </button>
          {track.price && track.price > 0 && (
            <button
              onClick={() => setTrackBuyOpen(true)}
              style={{
                display: "flex", alignItems: "center",
                padding: "5px 11px", borderRadius: 6, border: "none",
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "#ccc", fontSize: 11, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Buy — ${track.price.toFixed(2)}
            </button>
          )}
          <a
            href="#support"
            style={{
              padding: "5px 10px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#555", fontSize: 11, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            $ Tip
          </a>
        </div>
      </div>
      {trackBuyOpen && (
        <BeatLicenseModal
          track={{
            id:                 track.id,
            title:              track.title,
            price:              track.price,
            coverArtUrl:        track.coverArtUrl,
            streamLeaseEnabled: track.beatLeaseSettings?.streamLeaseEnabled ?? true,
            artist: { name: artistName, artistName: null, artistSlug },
          }}
          onClose={() => setTrackBuyOpen(false)}
        />
      )}
    </>
    );
  }

  // Beat CTA
  if (video.linkedBeat) {
    const beat = video.linkedBeat;
    const meta = [beat.bpm && `${beat.bpm} BPM`, beat.musicalKey].filter(Boolean).join(" · ");
    const streamEnabled = beat.beatLeaseSettings?.streamLeaseEnabled ?? true;

    return (
      <>
        <div style={{
          backgroundColor: "#111",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          overflow: "hidden",
        }}>
          {/* Art */}
          {beat.coverArtUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={beat.coverArtUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: "#1a1a1a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Music2 size={12} style={{ color: "#444" }} />
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {beat.title}
            </p>
            {meta && (
              <p style={{ fontSize: 10, color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</p>
            )}
          </div>

          {/* Single CTA */}
          <button
            onClick={() => setBeatModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 6, border: "none",
              backgroundColor: "rgba(212,168,67,0.12)",
              color: "#D4A843", fontSize: 11, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            <ShoppingBag size={10} />
            Buy
          </button>
        </div>
        {beatModalOpen && (
          <BeatLicenseModal
            track={{
              id:                 beat.id,
              title:              beat.title,
              price:              beat.price,
              coverArtUrl:        beat.coverArtUrl,
              streamLeaseEnabled: beat.beatLeaseSettings?.streamLeaseEnabled ?? true,
              artist: {
                name:       beat.artist?.name ?? "",
                artistName: beat.artist?.artistName ?? null,
                artistSlug: beat.artist?.artistSlug ?? null,
              },
            }}
            onClose={() => setBeatModalOpen(false)} />
        )}
      </>
    );
  }

  // Merch CTA
  if (video.linkedMerch) {
    const merch = video.linkedMerch;
    const price = merch.basePrice + merch.artistMarkup;

    return (
      <>
        <div style={{
          backgroundColor: "#111",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
        }}>
          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={merch.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {merch.title}
            </p>
            <p style={{ fontSize: 10, color: "#D4A843", margin: 0, fontWeight: 700 }}>${price.toFixed(2)}</p>
          </div>

          {/* CTA */}
          <button
            onClick={() => setMerchOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 6, border: "none",
              backgroundColor: "#D4A843",
              color: "#0A0A0A", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            }}
          >
            <ShoppingBag size={10} />
            Buy
          </button>
        </div>

        {merchOpen && (
          <MerchQuickAdd
            product={merch}
            artistSlug={artistSlug}
            onClose={() => setMerchOpen(false)}
          />
        )}
      </>
    );
  }

  return null;
}

// ─── Upload modal (fullscreen video player) ───────────────────────────────────

function VideoModal({ video, onClose }: { video: ArtistVideo; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 800 }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -40, right: 0,
            background: "none", border: "none", cursor: "pointer",
            color: "#fff", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
          }}
        >
          <X size={18} /> Close
        </button>
        <div style={{ aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
          {video.type === "UPLOAD" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={video.videoUrl || ""} controls autoPlay style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <iframe
              src={video.embedUrl || ""}
              title={video.title}
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          )}
        </div>
        <div style={{ marginTop: 12, color: "#fff", fontSize: 14, fontWeight: 600 }}>{video.title}</div>
      </div>
    </div>
  );
}

// ─── Zone 1: Embed tile (YouTube/Vimeo grid) ──────────────────────────────────

function EmbedTile({
  video,
  artistSlug,
  artistName,
}: {
  video:      ArtistVideo;
  artistSlug: string;
  artistName: string;
}) {
  const [active, setActive] = useState(false);
  const parsed = parseVideoUrl(video.embedUrl ?? video.videoUrl);
  if (!parsed) return null;

  const thumbnailUrl = video.thumbnailUrl ?? parsed.thumbnailUrl ?? null;
  const displayTitle = video.title || "Video";
  const hasProduct   = !!(video.linkedTrack ?? video.linkedBeat ?? video.linkedMerch);

  return (
    <div>
      {active ? (
        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={parsed.embedUrl}
            title={displayTitle}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{ border: "none", width: "100%", height: "100%" }}
          />
        </div>
      ) : (
        <button
          onClick={() => setActive(true)}
          className="group relative w-full overflow-hidden rounded-xl text-left focus:outline-none"
          style={{ aspectRatio: "16/9", display: "block" }}
          aria-label={`Play ${displayTitle}`}
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.06)" }}>
              <Video size={32} style={{ color: "rgba(212,168,67,0.3)" }} />
            </div>
          )}
          <div className="absolute inset-0 transition-opacity group-hover:opacity-80" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full transition-transform group-hover:scale-110"
              style={{ width: 52, height: 52, backgroundColor: "rgba(212,168,67,0.9)", color: "#0A0A0A" }}
            >
              <Play size={20} style={{ marginLeft: 3 }} />
            </div>
          </div>
          <div
            className="absolute bottom-0 inset-x-0 px-3 py-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
          >
            <p className="text-xs font-semibold text-white/90 truncate">{displayTitle}</p>
          </div>
        </button>
      )}

      {/* Product CTA — same width, directly below */}
      {hasProduct && (
        <ProductCTA video={video} artistSlug={artistSlug} artistName={artistName} />
      )}
    </div>
  );
}

// ─── Zone 2: Upload card (horizontal scroll) ──────────────────────────────────

function UploadCard({
  video,
  artistSlug,
  artistName,
  onClick,
}: {
  video:      ArtistVideo;
  artistSlug: string;
  artistName: string;
  onClick:    () => void;
}) {
  const catStyle   = video.category ? CATEGORY_STYLES[video.category] : null;
  const hasProduct = !!(video.linkedTrack ?? video.linkedBeat ?? video.linkedMerch);

  return (
    <div style={{ flexShrink: 0, width: 200, display: "flex", flexDirection: "column" }}>
      {/* Thumbnail card */}
      <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-xl text-left focus:outline-none"
        style={{ width: 200, height: 130 }}
        aria-label={`Play ${video.title}`}
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: "#1a1a1a" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={28} style={{ color: "rgba(212,168,67,0.3)" }} />
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }} />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(212,168,67,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={14} style={{ color: "#0A0A0A", marginLeft: 2 }} />
          </div>
        </div>
        {catStyle && video.category && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            backgroundColor: catStyle.bg, color: catStyle.color,
            fontSize: 8, fontWeight: 800, letterSpacing: "1px",
            padding: "3px 7px", borderRadius: 4, textTransform: "uppercase",
          }}>
            {video.category}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {video.title}
          </p>
        </div>
      </button>

      {/* Product CTA directly below (same 200px width) */}
      {hasProduct && (
        <ProductCTA video={video} artistSlug={artistSlug} artistName={artistName} />
      )}
    </div>
  );
}

// ─── Main VideoSection ────────────────────────────────────────────────────────

export default function VideoSection({ artistVideos = [], artistSlug, artistName }: Props) {
  const [activeModal, setActiveModal] = useState<ArtistVideo | null>(null);

  // Zone 1: YouTube/Vimeo embeds — max 4
  const embedVideos = artistVideos
    .filter((v) => v.type !== "UPLOAD" && !!(parseVideoUrl(v.embedUrl ?? v.videoUrl)))
    .slice(0, 4);

  // Zone 2: uploaded performance videos — max 8
  const uploadVideos = artistVideos
    .filter((v) => v.type === "UPLOAD")
    .slice(0, 8);

  const hasEmbeds  = embedVideos.length > 0;
  const hasUploads = uploadVideos.length > 0;

  if (!hasEmbeds && !hasUploads) return null;

  return (
    <section className="space-y-8">

      {/* Zone 1 — Official (embeds + product CTAs) */}
      {hasEmbeds && (
        <div className="space-y-3">
          <h2 className="text-[18px] font-semibold text-white leading-tight">Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {embedVideos.map((video) => (
              <EmbedTile
                key={video.id}
                video={video}
                artistSlug={artistSlug}
                artistName={artistName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone 2 — Live (uploads, horizontal scroll) */}
      {hasUploads && (
        <div className="space-y-3">
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
              paddingBottom: 4,
              marginLeft: -4,
              paddingLeft: 4,
              // Let rows with CTAs stretch naturally — align top so CTAs don't center-float
              alignItems: "flex-start",
            }}
            className="hide-scrollbar"
          >
            {uploadVideos.map((video) => (
              <UploadCard
                key={video.id}
                video={video}
                artistSlug={artistSlug}
                artistName={artistName}
                onClick={() => setActiveModal(video)}
              />
            ))}
            {artistVideos.filter((v) => v.type === "UPLOAD").length > 8 && (
              <div style={{
                width: 120, height: 130, borderRadius: 12, flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 11, color: "#666" }}>See All</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload video modal */}
      {activeModal && (
        <VideoModal video={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </section>
  );
}
