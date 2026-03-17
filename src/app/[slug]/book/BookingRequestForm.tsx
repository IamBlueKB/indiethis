"use client";

import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";

type Props = {
  studioId: string;
  studioName: string;
  accent: string;
  services: { name: string }[];
};

export function BookingRequestForm({ studioId, studioName, accent, services }: Props) {
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [phone, setPhone]               = useState("");
  const [sessionType, setSessionType]   = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [sending, setSending]           = useState(false);
  const [sent, setSent]                 = useState(false);
  const [error, setError]               = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/${studioId}/book-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, sessionType, requestedDate, requestedTime, notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Something went wrong.");
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
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
        <CheckCircle size={48} style={{ color: accent }} />
        <div>
          <p className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair, serif)" }}>Request Received!</p>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            {studioName} will check availability and reach out to confirm your session.
          </p>
        </div>
      </div>
    );
  }

  const input: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    color: "#FAFAFA",
    width: "100%",
    outline: "none",
  };

  const label = (text: string, required = false) => (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
      {text}{required && " *"}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + Email */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          {label("Name", true)}
          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" style={input} />
        </div>
        <div>
          {label("Email", true)}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" style={input} />
        </div>
      </div>

      {/* Phone */}
      <div>
        {label("Phone")}
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" style={input} />
      </div>

      {/* Session type */}
      <div>
        {label("Session Type")}
        <select value={sessionType} onChange={e => setSessionType(e.target.value)} style={{ ...input, appearance: "none" as any }}>
          <option value="" style={{ backgroundColor: "#1a1a1a", color: "#FAFAFA" }}>Select a service…</option>
          {services.map((s: any) => (
            <option key={s.name} value={s.name} style={{ backgroundColor: "#1a1a1a", color: "#FAFAFA" }}>{s.name}</option>
          ))}
          <option value="Other" style={{ backgroundColor: "#1a1a1a", color: "#FAFAFA" }}>Other</option>
        </select>
      </div>

      {/* Date + Time */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          {label("Preferred Date")}
          <input type="date" value={requestedDate} onChange={e => setRequestedDate(e.target.value)} style={{ ...input, colorScheme: "dark" }} />
        </div>
        <div>
          {label("Preferred Time")}
          <input type="time" value={requestedTime} onChange={e => setRequestedTime(e.target.value)} style={{ ...input, colorScheme: "dark" }} />
        </div>
      </div>

      {/* Notes */}
      <div>
        {label("Additional Notes")}
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          placeholder="Tell us about your project, how many songs, any special requirements…"
          style={{ ...input, resize: "vertical", lineHeight: 1.6 }} />
      </div>

      <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        * Your date and time are a request — not confirmed until {studioName} reaches out to you.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={sending}
        className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: accent, color: "#080808" }}>
        <Send size={14} />
        {sending ? "Sending…" : "Submit Request"}
      </button>
    </form>
  );
}
