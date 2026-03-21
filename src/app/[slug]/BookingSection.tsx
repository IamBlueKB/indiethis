"use client";

import { useState } from "react";
import { Mail, Loader2, Check, CreditCard } from "lucide-react";

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

  function downloadVCard() {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${artistName}`,
      `URL:${window.location.href}`,
      "END:VCARD",
    ].join("\n");
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${artistName.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (done) {
    return (
      <div
        className="flex items-center gap-3 rounded-[10px] p-[14px]"
        style={{ backgroundColor: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
        >
          <Check size={14} style={{ color: "#34C759" }} />
        </div>
        <div>
          <p className="text-[12px] font-medium text-white">Message sent!</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>
            {artistName} will get back to you.
          </p>
        </div>
      </div>
    );
  }

  const inputStyle = {
    borderColor:     "rgba(255,255,255,0.10)",
    backgroundColor: "transparent",
  };

  const inputClass =
    "rounded-[8px] border px-3 py-2 text-[12px] text-white bg-transparent placeholder:text-[#444] outline-none focus:border-[rgba(212,168,67,0.4)]";

  return (
    <section>
      {/* Section labels */}
      <p
        className="text-[10px] font-bold uppercase mb-[5px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        BOOKING
      </p>
      <h2 className="text-[18px] font-semibold text-white leading-tight mb-4">Get in Touch</h2>

      {bookingRate !== null && bookingRate > 0 && (
        <div
          className="inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 mb-4"
          style={{ backgroundColor: "rgba(212,168,67,0.10)", border: "1px solid rgba(212,168,67,0.18)" }}
        >
          <span className="text-[10px] text-white/40 uppercase tracking-wide">Starts at</span>
          <span className="text-[12px] font-bold" style={{ color: "#D4A843" }}>
            ${bookingRate.toLocaleString()}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Name + Email row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className={`flex-1 min-w-0 ${inputClass}`}
            style={inputStyle}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            required
            className={`flex-1 min-w-0 ${inputClass}`}
            style={inputStyle}
          />
        </div>

        {/* Inquiry type */}
        <select
          value={inquiryType}
          onChange={(e) => setInquiryType(e.target.value as InquiryType)}
          className={`w-full ${inputClass} appearance-none`}
          style={{ ...inputStyle, backgroundColor: "#0A0A0A" }}
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
          className={`w-full ${inputClass} resize-none`}
          style={{ ...inputStyle, height: 50 }}
        />

        {error && <p className="text-[11px]" style={{ color: "#E85D4A" }}>{error}</p>}

        {/* Send button */}
        <button
          type="submit"
          disabled={saving || !name.trim() || !email.includes("@") || !message.trim()}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-[8px] text-[11px] font-semibold disabled:opacity-50 transition-all hover:brightness-110"
          style={{ backgroundColor: "#E85D4A", color: "#fff", alignSelf: "flex-start" }}
        >
          {saving ? (
            <><Loader2 size={11} className="animate-spin" /> Sending…</>
          ) : (
            <><Mail size={11} /> Send Message</>
          )}
        </button>
      </form>

      {/* Save Contact Card */}
      <button
        type="button"
        onClick={downloadVCard}
        className="mt-3 inline-flex items-center gap-[6px] transition-all hover:brightness-125"
        style={{
          fontSize:        10,
          color:           "#999",
          backgroundColor: "rgba(255,255,255,0.06)",
          padding:         "6px 12px",
          borderRadius:    8,
          cursor:          "pointer",
          border:          "none",
        }}
      >
        <CreditCard size={11} />
        Save Contact Card
      </button>
    </section>
  );
}
