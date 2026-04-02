"use client";
import { useState } from "react";
import { X, Heart, Loader2 } from "lucide-react";

const PRESETS = [500, 1000, 2500, 5000]; // cents

interface Props {
  artistId:   string;
  artistName: string;
  onClose:    () => void;
}

export default function FanFundingModal({ artistId, artistName, onClose }: Props) {
  const [selected, setSelected]   = useState<number | null>(null);
  const [custom,   setCustom]     = useState("");
  const [fanName,  setFanName]    = useState("");
  const [fanEmail, setFanEmail]   = useState("");
  const [message,  setMessage]    = useState("");
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState("");

  const amountCents: number | null = (() => {
    if (custom) {
      const n = Math.round(parseFloat(custom) * 100);
      return isNaN(n) ? null : n;
    }
    return selected;
  })();

  const canSubmit = amountCents !== null && amountCents >= 100 && fanEmail.trim().length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/fan-funding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          amount:   amountCents,
          fanName:  fanName.trim() || null,
          fanEmail: fanEmail.trim(),
          message:  message.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Failed to connect. Try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: "#111111", border: "1px solid rgba(212,168,67,0.2)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <X size={14} className="text-white/60" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Support</p>
          <h2 className="text-xl font-bold text-white leading-tight">Support {artistName}</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "#888" }}>
            Help fund {artistName}&apos;s creative tools. Your support goes directly toward their music production, mastering, and promotion on IndieThis.
          </p>
        </div>

        {/* Preset amounts */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {PRESETS.map((cents) => {
            const active = selected === cents && !custom;
            return (
              <button
                key={cents}
                onClick={() => { setSelected(cents); setCustom(""); }}
                className="py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  border: `1px solid ${active ? "#D4A843" : "rgba(212,168,67,0.3)"}`,
                  backgroundColor: active ? "#D4A843" : "transparent",
                  color: active ? "#0A0A0A" : "#D4A843",
                }}
              >
                ${cents / 100}
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "#D4A843" }}>$</span>
          <input
            type="number"
            min="1"
            max="500"
            placeholder="Custom amount"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        {/* Fan name */}
        <input
          type="text"
          placeholder="Your name (optional)"
          value={fanName}
          onChange={(e) => setFanName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none mb-3"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />

        {/* Fan email */}
        <input
          type="email"
          placeholder="Your email *"
          value={fanEmail}
          onChange={(e) => setFanEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none mb-3"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />

        {/* Message */}
        <textarea
          placeholder="Leave a message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
          rows={2}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none mb-4 resize-none"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
        {message.length > 0 && (
          <p className="text-[10px] text-right -mt-3 mb-3" style={{ color: "#555" }}>{message.length}/280</p>
        )}

        {error && <p className="text-xs mb-3" style={{ color: "#E85D4A" }}>{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Heart size={14} />
              Support{amountCents && amountCents >= 100 ? ` — $${(amountCents / 100).toFixed(2)}` : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
