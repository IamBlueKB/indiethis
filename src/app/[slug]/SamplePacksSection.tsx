"use client";

import { useState, useRef } from "react";
import {
  Archive, Play, Pause, ShoppingCart, ChevronLeft, ChevronRight,
  Music2, Loader2, X,
} from "lucide-react";
import Image from "next/image";

export type PublicSamplePack = {
  id:                string;
  title:             string;
  price:             number;
  description:       string | null;
  genre:             string | null;
  coverArtUrl:       string | null;
  sampleCount:       number | null;
  samplePackFileSize: number | null;
  previewSampleUrls: string[] | null;
};

interface Props {
  packs:        PublicSamplePack[];
  producerName: string;
  artistSlug:   string;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Mini Preview Player ──────────────────────────────────────────────────────

function MiniPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { void audioRef.current.play().then(() => setPlaying(true)); }
  }
  const label = url.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Preview";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <audio ref={audioRef} src={url} preload="none"
        onEnded={() => setPlaying(false)} />
      <button onClick={toggle}
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: playing ? "#E85D4A" : "#D4A843" }}>
        {playing
          ? <Pause size={10} style={{ color: "#fff" }} />
          : <Play size={10} style={{ color: "#0A0A0A" }} />}
      </button>
      <p className="text-xs truncate flex-1" style={{ color: "#aaa" }}>{label}</p>
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────

function BuyModal({ pack, onClose }: { pack: PublicSamplePack; onClose: () => void }) {
  const previews = pack.previewSampleUrls ?? [];
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleBuy() {
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/digital-products/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ productId: pack.id, buyerEmail: email }),
      });
      const d = await r.json() as { url?: string; error?: string };
      if (!r.ok || !d.url) { setError(d.error ?? "Checkout failed"); setLoading(false); return; }
      window.location.href = d.url;
    } catch { setError("Network error. Try again."); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: "#111111", border: "1px solid rgba(212,168,67,0.2)" }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <X size={14} className="text-white/60" />
        </button>

        {/* Cover + info */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
            style={{ backgroundColor: "#1a1a1a" }}>
            {pack.coverArtUrl
              ? <Image src={pack.coverArtUrl} alt={pack.title} width={56} height={56} className="object-cover w-full h-full" />
              : <Archive size={20} className="text-gray-600" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: "#D4A843" }}>Sample Pack</p>
            <h2 className="text-lg font-bold text-white leading-tight">{pack.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {pack.sampleCount} samples
              {pack.samplePackFileSize ? ` · ${fmtSize(pack.samplePackFileSize)}` : ""}
            </p>
          </div>
        </div>

        {pack.description && (
          <p className="text-sm mb-4 leading-relaxed" style={{ color: "#888" }}>{pack.description}</p>
        )}

        {/* Previews */}
        {previews.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#555" }}>
              Preview Samples
            </p>
            {previews.map((url) => <MiniPlayer key={url} url={url} />)}
          </div>
        )}

        {/* Email + buy */}
        <input
          type="email"
          placeholder="Your email (for download link)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none mb-3"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

        {error && <p className="text-xs mb-3" style={{ color: "#E85D4A" }}>{error}</p>}

        <button
          onClick={() => void handleBuy()}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
          {loading ? "Redirecting..." : `Buy for $${(pack.price / 100).toFixed(2)}`}
        </button>
        <p className="text-[10px] text-center mt-2" style={{ color: "#555" }}>
          Download link sent to your email after purchase
        </p>
      </div>
    </div>
  );
}

// ─── Pack Card ────────────────────────────────────────────────────────────────

function PackCard({ pack, onClick }: { pack: PublicSamplePack; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-xl overflow-hidden text-left transition-all hover:brightness-110 active:scale-95"
      style={{ width: 160, border: "1px solid rgba(255,255,255,0.06)", backgroundColor: "#111" }}>
      {/* Cover */}
      <div className="w-full aspect-square flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: "#1a1a1a" }}>
        {pack.coverArtUrl
          ? <Image src={pack.coverArtUrl} alt={pack.title} width={160} height={160} className="object-cover w-full h-full" />
          : <Archive size={36} className="text-gray-700" />}
        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <ShoppingCart size={22} style={{ color: "#D4A843" }} />
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-white truncate">{pack.title}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "#888" }}>
          {pack.sampleCount} samples
        </p>
        <p className="text-xs font-bold mt-1" style={{ color: "#D4A843" }}>
          ${(pack.price / 100).toFixed(2)}
        </p>
      </div>
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function SamplePacksSection({ packs, producerName }: Props) {
  const [activePack, setActivePack] = useState<PublicSamplePack | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 200 : -200, behavior: "smooth" });
  }

  if (packs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#D4A843" }}>
            Sample Packs
          </p>
          <h3 className="text-lg font-bold text-white">By {producerName}</h3>
        </div>
      </div>

      <div className="relative">
        <button onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center -ml-3 shadow"
          style={{ backgroundColor: "#111", border: "1px solid rgba(212,168,67,0.3)" }}>
          <ChevronLeft size={14} style={{ color: "#D4A843" }} />
        </button>

        <div ref={scrollRef}
          className="flex gap-3 overflow-x-auto py-1"
          style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
          {packs.map((p) => (
            <div key={p.id} style={{ scrollSnapAlign: "start" }}>
              <PackCard pack={p} onClick={() => setActivePack(p)} />
            </div>
          ))}
        </div>

        <button onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center -mr-3 shadow"
          style={{ backgroundColor: "#111", border: "1px solid rgba(212,168,67,0.3)" }}>
          <ChevronRight size={14} style={{ color: "#D4A843" }} />
        </button>
      </div>

      {activePack && (
        <BuyModal pack={activePack} onClose={() => setActivePack(null)} />
      )}
    </div>
  );
}
