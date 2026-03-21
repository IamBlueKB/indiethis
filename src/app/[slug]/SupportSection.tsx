"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const PRESETS = [1, 5, 10, 25];

export default function SupportSection({
  artistSlug,
  artistName,
}: {
  artistSlug: string;
  artistName: string;
}) {
  const [selected, setSelected] = useState<number | null>(5);
  const [custom,   setCustom]   = useState("");
  const [email,    setEmail]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Effective amount: custom overrides preset
  const amount = custom ? Number(custom) : (selected ?? 0);
  const isValid = amount >= 0.5 && email.includes("@");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/support/${artistSlug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount, email: email.trim() }),
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
    <section
      className="rounded-[10px] text-center"
      style={{ backgroundColor: "#111", padding: 16 }}
    >
      {/* Section label */}
      <p
        className="text-[10px] font-bold uppercase mb-[6px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        SUPPORT
      </p>

      <h2 className="font-semibold text-white" style={{ fontSize: 14, marginBottom: 4 }}>
        Support {artistName}
      </h2>
      <p className="mb-[12px]" style={{ fontSize: 11, color: "#999" }}>
        Show love directly — pick an amount or enter your own
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Preset amounts */}
        <div className="flex justify-center gap-2 flex-wrap">
          {PRESETS.map((p) => {
            const isActive = !custom && selected === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setSelected(p); setCustom(""); }}
                className="px-4 py-1.5 rounded-full text-[11px] font-medium border transition-all"
                style={{
                  borderColor:     isActive ? "#D4A843" : "rgba(255,255,255,0.10)",
                  backgroundColor: isActive ? "rgba(212,168,67,0.10)" : "rgba(255,255,255,0.06)",
                  color:           isActive ? "#D4A843" : "#999",
                }}
              >
                ${p}
              </button>
            );
          })}

          {/* Custom amount */}
          <div
            className="flex items-center rounded-full border px-3 py-1.5"
            style={{
              borderColor:     custom ? "#D4A843" : "rgba(255,255,255,0.10)",
              backgroundColor: custom ? "rgba(212,168,67,0.10)" : "rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: 11, color: custom ? "#D4A843" : "#666" }}>$</span>
            <input
              type="number"
              min="0.50"
              step="0.50"
              placeholder="Other"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
              className="w-12 bg-transparent outline-none text-[11px] font-medium"
              style={{ color: custom ? "#D4A843" : "#666" }}
            />
          </div>
        </div>

        {/* Email */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoComplete="email"
          required
          className="w-full px-3 py-2 rounded-[8px] border bg-transparent text-white text-[12px] placeholder:text-[#444] outline-none"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        />

        {error && <p className="text-[11px]" style={{ color: "#E85D4A" }}>{error}</p>}

        {/* CTA */}
        <button
          type="submit"
          disabled={loading || !isValid}
          className="w-full py-2 rounded-[8px] text-[12px] font-semibold text-white disabled:opacity-50 transition-all hover:brightness-110"
          style={{ backgroundColor: "#E85D4A" }}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin mx-auto" />
          ) : (
            `Send Support${amount >= 0.5 ? ` · $${amount.toFixed(2)}` : ""}`
          )}
        </button>
      </form>
    </section>
  );
}
