"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Phone, Mail, Loader2, Check, ImageIcon, Plus, X } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { formatPhoneInput } from "@/lib/formatPhone";

// ─── Image upload box ─────────────────────────────────────────────────────────

function UploadBox({ value, onUpload, guidance, aspect = "wide" }: {
  value: string | null;
  onUpload: (url: string) => void;
  guidance: string;
  aspect?: "wide" | "square";
}) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await startUpload([file]);
    if (res?.[0]?.url) onUpload(res[0].url);
  }
  const sizeClass = aspect === "square" ? "w-32 h-32" : "w-full h-36";
  return value ? (
    <div className={`relative group ${sizeClass} rounded-xl overflow-hidden border`} style={{ borderColor: "var(--border)" }}>
      <img src={value} alt="upload" className="w-full h-full object-cover" />
      <button type="button" onClick={() => onUpload("")}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={13} className="text-white" />
      </button>
    </div>
  ) : (
    <label className={`flex flex-col items-center justify-center ${sizeClass} rounded-xl border border-dashed cursor-pointer transition-colors px-4 text-center hover:border-[var(--accent)]/40`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
      <ImageIcon size={20} className="text-muted-foreground mb-2" />
      <span className="text-xs font-medium text-muted-foreground">{isUploading ? "Uploading…" : "Click to upload"}</span>
      {!isUploading && aspect !== "square" && (
        <span className="text-[11px] mt-1.5 leading-snug max-w-[240px]" style={{ color: "rgba(255,255,255,0.3)" }}>{guidance}</span>
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
    </label>
  );
}

// ─── Gallery upload box ───────────────────────────────────────────────────────

function GalleryUpload({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  const max = 10;
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - images.length);
    if (!files.length) return;
    const res = await startUpload(files);
    if (res) onChange([...images, ...res.map((r) => r.url)]);
  }
  return (
    <div className="space-y-2">
      {images.length === 0 ? (
        <label className="flex flex-col items-center justify-center w-full h-36 rounded-xl border border-dashed cursor-pointer transition-colors px-4 text-center hover:border-[var(--accent)]/40"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          {isUploading ? (
            <span className="text-xs text-muted-foreground">Uploading…</span>
          ) : (
            <>
              <Plus size={20} className="text-muted-foreground mb-2" />
              <span className="text-xs font-medium text-muted-foreground">Click to upload photos</span>
              <span className="text-[11px] mt-1.5 leading-snug max-w-[260px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Show off your space — console, booth, gear, room shots. Upload at least 3 for the best look.
              </span>
            </>
          )}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} disabled={isUploading} />
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <div key={url + i} className="relative group aspect-square rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={11} className="text-white" />
              </button>
            </div>
          ))}
          {images.length < max && (
            <label className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              {isUploading
                ? <span className="text-xs text-muted-foreground">Uploading…</span>
                : <><Plus size={16} className="text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Add</span></>}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} disabled={isUploading} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudioSetupPage() {
  const router = useRouter();

  // Step 1 state
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 state
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputClass = "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 transition-colors placeholder:text-muted-foreground";

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Studio name is required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/studio/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tagline, bio, address, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2(skip = false) {
    setLoading(true);
    try {
      if (!skip && (logoUrl || heroImage || gallery.length > 0)) {
        await fetch("/api/studio/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logoUrl: logoUrl || null,
            heroImage: heroImage || null,
            galleryImages: gallery,
          }),
        });
      }
      router.push("/studio");
      router.refresh();
    } catch {
      setError("Something went wrong saving your photos.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}>
          <Building2 size={22} strokeWidth={1.75} style={{ color: "#D4A843" }} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight mb-1">
          {step === 1 ? "Set up your studio" : "Add your photos"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === 1
            ? "Tell us about your studio to get started. You can update these details anytime in Settings."
            : "Give your page a strong first impression. You can always update these later."}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                backgroundColor: step >= s ? "#D4A843" : "rgba(255,255,255,0.08)",
                color: step >= s ? "#0A0A0A" : "var(--muted-foreground)",
              }}>
              {step > s ? <Check size={12} strokeWidth={2.5} /> : s}
            </div>
            <span className="text-xs" style={{ color: step >= s ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {s === 1 ? "Basic info" : "Photos"}
            </span>
            {s < 2 && <div className="w-8 h-px mx-1" style={{ backgroundColor: "var(--border)" }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Studio Name <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Your studio name" required value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass} style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }} />
            </div>
          </div>

          {/* AI nudge */}
          <div className="rounded-xl border px-3.5 py-3 flex items-start gap-2.5"
            style={{ borderColor: "rgba(212,168,67,0.25)", backgroundColor: "rgba(212,168,67,0.06)" }}>
            <span className="text-sm mt-0.5">✦</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold" style={{ color: "#D4A843" }}>Tip:</span> Fill in your tagline and bio and our AI can build your entire public page in one click — copy, layout, and all.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tagline <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
            <input type="text" placeholder="Where artists come to sound their best"
              value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 100))}
              className={inputClass} style={{ borderColor: "var(--border)" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>About Your Studio <span className="text-muted-foreground font-normal text-xs">(optional)</span></span>
              <span className="text-xs text-muted-foreground">{bio.length}/500</span>
            </label>
            <textarea rows={4} placeholder="Tell us about your studio — your vibe, your gear, what makes you different…"
              value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))}
              className={inputClass + " resize-none"} style={{ borderColor: "var(--border)" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Address</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="123 Main St, Chicago, IL" value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass} style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="tel" placeholder="(555) 555-0100" value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  className={inputClass} style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Booking Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" placeholder="book@yourstudio.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass} style={{ paddingLeft: "2.25rem", borderColor: "var(--border)" }} />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

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

          <button type="submit" disabled={loading || !name.trim()}
            className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating your studio…</> : "Continue →"}
          </button>
        </form>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Logo</label>
            <div className="flex items-center gap-4">
              <UploadBox value={logoUrl || null} onUpload={setLogoUrl} aspect="square"
                guidance="Upload your studio logo — square format works best." />
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
                Upload your studio logo.<br />Square format works best.
              </p>
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Hero Image</label>
            <UploadBox value={heroImage || null} onUpload={setHeroImage} aspect="wide"
              guidance="Upload a wide shot of your studio — your console, live room, or building works best." />
          </div>

          {/* Gallery */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Gallery</label>
            <GalleryUpload images={gallery} onChange={setGallery} />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => handleStep2(false)} disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Launch Studio Panel"}
            </button>
            <button type="button" onClick={() => handleStep2(true)} disabled={loading}
              className="h-11 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
