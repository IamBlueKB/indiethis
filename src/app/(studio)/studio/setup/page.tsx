"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Phone, Mail, Loader2, Check } from "lucide-react";

export default function StudioSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Studio name is required."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/studio/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/studio");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 transition-colors"
    + " placeholder:text-muted-foreground";

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}>
          <Building2 size={22} strokeWidth={1.75} style={{ color: "#D4A843" }} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight mb-1">
          Set up your studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your studio to get started. You can update these details anytime in Settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Studio Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Studio Name <span style={{ color: "#E85D4A" }}>*</span>
          </label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="e.g. Clear Ear Studios"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Address</label>
          <div className="relative">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="123 Main St, Chicago, IL"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }}
            />
          </div>
        </div>

        {/* Phone + Email row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                placeholder="(312) 555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Booking Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="book@yourstudio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* What you get list */}
        <div className="rounded-xl border p-4 space-y-2"
          style={{ backgroundColor: "rgba(212,168,67,0.05)", borderColor: "rgba(212,168,67,0.2)" }}>
          <p className="text-xs font-semibold text-foreground mb-2">After setup you'll have access to:</p>
          {[
            "Branded SMS intake links for artist bookings",
            "Full artist CRM and contact management",
            "File delivery and session tracking",
            "Payment and invoice management",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check size={13} strokeWidth={2.5} style={{ color: "#34C759" }} className="shrink-0" />
              <span className="text-xs text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Creating your studio…</>
          ) : (
            "Launch Studio Panel"
          )}
        </button>
      </form>
    </div>
  );
}
