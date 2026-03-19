"use client";

import { useState } from "react";
import { MapPin, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";

export default function ShowCapture({
  artistSlug,
  artistName,
  showSms = false,
}: {
  artistSlug: string;
  artistName: string;
  showSms?:  boolean;
}) {
  const [email,     setEmail]     = useState("");
  const [zip,       setZip]       = useState("");
  const [phone,     setPhone]     = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/public/fan-contact/${artistSlug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:  email.trim(),
          zip:    zip.trim()   || undefined,
          phone:  phone.trim() || undefined,
          source: "SHOW_NOTIFY",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{
          backgroundColor: "rgba(52,199,89,0.08)",
          border:          "1px solid rgba(52,199,89,0.2)",
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
        >
          <Check size={14} style={{ color: "#34C759" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">You&apos;re on the list!</p>
          <p className="text-xs text-white/40 mt-0.5">
            We&apos;ll alert you when {artistName} is performing near you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-3"
      style={{
        backgroundColor: "rgba(232,93,74,0.05)",
        border:          "1px solid rgba(232,93,74,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(232,93,74,0.12)" }}
        >
          <MapPin size={14} style={{ color: "#E85D4A" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            Get notified when {artistName} plays near you
          </p>
          <p className="text-xs text-white/40">
            Drop your email and we&apos;ll alert you when shows are announced
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            required
            className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="ZIP"
            maxLength={10}
            className="w-20 rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1 text-center"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !email.includes("@")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:brightness-110"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          {saving ? (
            <><Loader2 size={12} className="animate-spin" /> Saving…</>
          ) : (
            <><MapPin size={12} /> Notify Me</>
          )}
        </button>

        {/* Optional phone toggle */}
        {showSms && (
          <>
            <button
              type="button"
              onClick={() => setShowPhone((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              {showPhone ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showPhone ? "Hide" : "Also get SMS alerts"} (optional)
            </button>

            {showPhone && (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
                className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              />
            )}
          </>
        )}

        {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}
      </form>
    </div>
  );
}
