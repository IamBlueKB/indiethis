"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

export default function ReleaseCapture({
  artistSlug,
  artistName,
}: {
  artistSlug: string;
  artistName: string;
}) {
  const [email,  setEmail]  = useState("");
  const [phone,  setPhone]  = useState("");
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);
  const [error,  setError]  = useState("");

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
          phone:  phone.trim() || undefined,
          source: "RELEASE_NOTIFY",
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
        className="flex items-center gap-3 rounded-[10px] p-[14px]"
        style={{ backgroundColor: "#111" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(52,199,89,0.15)" }}
        >
          <Check size={13} style={{ color: "#34C759" }} />
        </div>
        <div>
          <p className="text-[12px] font-medium text-white">You&apos;re on the list!</p>
          <p className="text-[10px] mt-0.5" style={{ color: "#666" }}>
            We&apos;ll let you know when {artistName} drops something new.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[10px] p-[14px]"
      style={{ backgroundColor: "#111" }}
    >
      <p className="font-medium mb-[4px]" style={{ fontSize: 12, color: "#F5F5F5" }}>
        Get {artistName}&apos;s next release before anyone else
      </p>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            className="flex-1 min-w-0 px-3 py-2 rounded-[8px] border bg-transparent text-white text-[12px] placeholder:text-[#444] outline-none focus:border-[rgba(212,168,67,0.4)]"
            style={{ borderColor: "rgba(255,255,255,0.10)" }}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            autoComplete="tel"
            className="px-3 py-2 rounded-[8px] border bg-transparent text-white text-[12px] placeholder:text-[#444] outline-none focus:border-[rgba(212,168,67,0.4)]"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              maxWidth:    120,
            }}
          />
          <button
            type="submit"
            disabled={saving || !email.includes("@")}
            className="shrink-0 px-4 py-2 rounded-[8px] text-[11px] font-semibold text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: "#E85D4A" }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : "Notify Me"}
          </button>
        </div>
        {error && <p className="text-[11px] mt-2" style={{ color: "#E85D4A" }}>{error}</p>}
      </form>
    </div>
  );
}
