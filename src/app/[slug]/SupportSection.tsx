"use client";

import { useState } from "react";
import { Heart, Loader2, X, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SupportSectionProps = {
  artistSlug: string;
  artistName: string;
};

// ─── Preset amounts ───────────────────────────────────────────────────────────

const PRESETS = [1, 3, 5, 10];

// ─── SupportOverlay ───────────────────────────────────────────────────────────

function SupportOverlay({
  artistSlug,
  artistName,
  onClose,
}: {
  artistSlug: string;
  artistName: string;
  onClose:    () => void;
}) {
  const [amount,  setAmount]  = useState<number | "">(5);
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const displayAmount = typeof amount === "number" ? amount : 0;
  const isValid = displayAmount >= 0.5 && email.includes("@");

  async function handleCheckout() {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/support/${artistSlug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          amount:  displayAmount,
          email:   email.trim(),
          message: message.trim() || undefined,
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
          backgroundColor: "rgba(18,18,18,0.95)",
          border:          "1px solid rgba(232,93,74,0.25)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart size={16} style={{ color: "#E85D4A" }} />
            <p className="text-sm font-bold text-white">Support {artistName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
          >
            <X size={15} />
          </button>
        </div>

        {/* Preset amounts */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Amount</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor:     amount === p ? "#E85D4A" : "rgba(255,255,255,0.12)",
                  backgroundColor: amount === p ? "rgba(232,93,74,0.12)" : "transparent",
                  color:           amount === p ? "#E85D4A" : "rgba(255,255,255,0.5)",
                }}
              >
                ${p}
              </button>
            ))}
            {/* Custom */}
            <div
              className="flex items-center gap-1 rounded-lg border px-2 py-1"
              style={{
                borderColor:     typeof amount === "number" && !PRESETS.includes(amount) && amount >= 0.5
                  ? "#E85D4A"
                  : "rgba(255,255,255,0.12)",
                backgroundColor: typeof amount === "number" && !PRESETS.includes(amount) && amount >= 0.5
                  ? "rgba(232,93,74,0.08)"
                  : "transparent",
              }}
            >
              <span className="text-xs text-white/40">$</span>
              <input
                type="number"
                min="0.50"
                step="0.50"
                placeholder="Other"
                value={typeof amount === "number" && !PRESETS.includes(amount) ? amount : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setAmount(v === "" ? "" : Number(v));
                }}
                className="w-14 text-xs font-semibold bg-transparent text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>
          {typeof amount === "number" && amount > 0 && amount < 0.5 && (
            <p className="text-[10px]" style={{ color: "#E85D4A" }}>Minimum amount is $0.50</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Your email</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none placeholder:text-white/25"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Optional message */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Message <span className="normal-case font-normal">(optional)</span>
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={`Say something to ${artistName}…`}
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none resize-none placeholder:text-white/25"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>
        )}

        {/* CTA */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleCheckout}
            disabled={loading || !isValid}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
            ) : (
              <><Heart size={14} /> Support · ${displayAmount.toFixed ? displayAmount.toFixed(2) : "0.00"}</>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        </div>

        <p className="text-[10px] text-white/25 text-center">
          Secure checkout powered by Stripe
        </p>
      </div>
    </div>
  );
}

// ─── SupportSection ───────────────────────────────────────────────────────────

export default function SupportSection({ artistSlug, artistName }: SupportSectionProps) {
  const [open,    setOpen]    = useState(false);
  const [success, setSuccess] = useState(false);

  // Check for success redirect param on mount
  // (page.tsx will pass this as a prop for SSR friendliness, but we also check here)
  return (
    <>
      <section
        className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
        style={{
          backgroundColor: "rgba(232,93,74,0.06)",
          border:          "1px solid rgba(232,93,74,0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(232,93,74,0.12)" }}
          >
            <Heart size={16} style={{ color: "#E85D4A" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Support {artistName}</p>
            <p className="text-xs text-white/40">Pay what you want — every bit helps</p>
          </div>
        </div>

        {success ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0" style={{ color: "#34C759" }}>
            <Check size={13} />
            Thank you!
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            Support
          </button>
        )}
      </section>

      {open && (
        <SupportOverlay
          artistSlug={artistSlug}
          artistName={artistName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
