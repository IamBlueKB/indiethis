"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Send, Mail, Phone, Calendar, Clock } from "lucide-react";
import { formatPhoneInput } from "@/lib/formatPhone";

export default function QuickSendPage() {
  const [studioName, setStudioName]   = useState<string | null>(null);
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [endTime, setEndTime]         = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then((d) => { if (d.studio?.name) setStudioName(d.studio.name); })
      .catch(() => {});
  }, []);

  async function handleSend() {
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email or phone number.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/intake-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          sessionDate: sessionDate || undefined,
          sessionTime: sessionTime || undefined,
          endTime: endTime || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) setSent(true);
      else setError(data.error ?? "Failed to send.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-emerald-400/10">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          {studioName && <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>{studioName}</p>}
          <h1 className="text-xl font-bold text-foreground">Intake form sent!</h1>
          <p className="text-sm text-muted-foreground">The client will receive their unique link. It expires in 72 hours.</p>
        </div>
        <button
          onClick={() => { setSent(false); setEmail(""); setPhone(""); setSessionDate(""); setSessionTime(""); setEndTime(""); }}
          className="w-full max-w-xs py-4 rounded-2xl text-base font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Send Another
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 pb-12" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-sm mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="pt-4 space-y-1">
          {studioName && (
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>{studioName}</p>
          )}
          <h1 className="text-2xl font-bold text-foreground">Send Intake Form</h1>
          <p className="text-sm text-muted-foreground">Client fills in their own info. You just need to reach them.</p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Mail size={12} /> Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artist@example.com"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded-2xl border px-4 py-4 text-base bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Phone size={12} /> Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="(555) 123-4567"
            inputMode="tel"
            autoComplete="tel"
            className="w-full rounded-2xl border px-4 py-4 text-base bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <p className="text-xs text-muted-foreground -mt-2">Enter email, phone, or both. We&apos;ll send via whichever you fill in.</p>

        {/* Date + Start Time + End Time */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar size={12} /> Date
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-2xl border px-4 py-4 text-base bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock size={12} /> Start Time
            </label>
            <input
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="w-full rounded-2xl border px-4 py-4 text-base bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock size={12} /> End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-2xl border px-4 py-4 text-base bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sending || (!email.trim() && !phone.trim())}
          className="w-full py-5 rounded-2xl text-base font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity mt-2"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          {sending ? "Sending…" : "Send Intake Form"}
        </button>

      </div>
    </div>
  );
}
