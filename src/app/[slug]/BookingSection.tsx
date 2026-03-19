"use client";

import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";

const INQUIRY_TYPES = ["Booking", "Feature", "Press", "Management", "Other"] as const;

type InquiryType = typeof INQUIRY_TYPES[number];

export default function BookingSection({
  artistSlug,
  artistName,
  bookingRate,
}: {
  artistSlug:  string;
  artistName:  string;
  bookingRate: number | null;
}) {
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [inquiryType, setInquiryType] = useState<InquiryType>("Booking");
  const [message,     setMessage]     = useState("");
  const [saving,      setSaving]      = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/public/booking-inquiry/${artistSlug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), email: email.trim(), inquiryType, message: message.trim() }),
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
        className="rounded-2xl px-5 py-5 flex items-center gap-3"
        style={{
          backgroundColor: "rgba(52,199,89,0.08)",
          border:          "1px solid rgba(52,199,89,0.2)",
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
        >
          <Check size={15} style={{ color: "#34C759" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Message sent!</p>
          <p className="text-xs text-white/40 mt-0.5">
            {artistName} will get back to you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-5 py-5 space-y-4"
      style={{
        backgroundColor: "rgba(255,255,255,0.03)",
        border:          "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
            Booking
          </h2>
          <p className="text-sm text-white/60">
            Send {artistName} a message about booking, features, press, and more.
          </p>
        </div>
        {bookingRate !== null && bookingRate > 0 && (
          <div
            className="shrink-0 rounded-xl px-3 py-1.5 text-center"
            style={{ backgroundColor: "rgba(212,168,67,0.10)", border: "1px solid rgba(212,168,67,0.18)" }}
          >
            <p className="text-[10px] text-white/40 uppercase tracking-wide">Starts at</p>
            <p className="text-sm font-bold" style={{ color: "#D4A843" }}>
              ${bookingRate.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Name + Email row */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-white/20"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            required
            className="rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-white/20"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Inquiry type */}
        <select
          value={inquiryType}
          onChange={(e) => setInquiryType(e.target.value as InquiryType)}
          className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20 appearance-none"
          style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#111" }}
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t} style={{ backgroundColor: "#111", color: "#fff" }}>
              {t}
            </option>
          ))}
        </select>

        {/* Message */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Tell ${artistName} about your project, event, or opportunity…`}
          required
          rows={4}
          className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-white/20 resize-none"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        />

        {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim() || !email.includes("@") || !message.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:brightness-110"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          {saving ? (
            <><Loader2 size={12} className="animate-spin" /> Sending…</>
          ) : (
            <><Mail size={12} /> Send Message</>
          )}
        </button>
      </form>
    </div>
  );
}
