"use client";

import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";

type Props = {
  studioId: string;
  studioName: string;
  accent: string;
};

export function ContactForm({ studioId, studioName, accent }: Props) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/${studioId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to send.");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <CheckCircle size={40} style={{ color: accent }} />
        <div>
          <p className="text-lg font-bold text-white">Message sent!</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {studioName} will be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "#FAFAFA",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "rgba(255,255,255,0.4)" }}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "rgba(255,255,255,0.4)" }}>Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}>Phone (optional)</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 000-0000"
          style={inputStyle}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}>Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="Tell us about your project…"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: accent, color: "#080808" }}
      >
        <Send size={14} />
        {sending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
