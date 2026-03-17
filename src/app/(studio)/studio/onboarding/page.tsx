"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Loader2, Plus, X, ImageIcon, Sparkles,
  ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { formatPhoneInput } from "@/lib/formatPhone";

// ── Types ──────────────────────────────────────────────────────────────────────

type Service = { name: string; description: string };
type DayHours = { open: boolean; openTime: string; closeTime: string };
type HoursJson = Record<string, DayHours>;

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const DEFAULT_HOURS: HoursJson = {
  monday:    { open: true,  openTime: "09:00", closeTime: "20:00" },
  tuesday:   { open: true,  openTime: "09:00", closeTime: "20:00" },
  wednesday: { open: true,  openTime: "09:00", closeTime: "20:00" },
  thursday:  { open: true,  openTime: "09:00", closeTime: "20:00" },
  friday:    { open: true,  openTime: "09:00", closeTime: "22:00" },
  saturday:  { open: true,  openTime: "10:00", closeTime: "22:00" },
  sunday:    { open: false, openTime: "10:00", closeTime: "18:00" },
};

type StyleId = "CLASSIC" | "BOLD" | "EDITORIAL" | "CLEAN" | "CINEMATIC" | "GRID";

const STYLE_OPTIONS: { id: StyleId; label: string; subtitle: string; aiSupported: boolean }[] = [
  { id: "CLASSIC",   label: "Classic",   subtitle: "Clean and professional",   aiSupported: true },
  { id: "BOLD",      label: "Bold",      subtitle: "Visual and high-impact",    aiSupported: true },
  { id: "EDITORIAL", label: "Editorial", subtitle: "Magazine-style",            aiSupported: true },
  { id: "CLEAN",     label: "Clean",     subtitle: "Minimal, modern",           aiSupported: false },
  { id: "CINEMATIC", label: "Cinematic", subtitle: "Dramatic, immersive",       aiSupported: false },
  { id: "GRID",      label: "Grid",      subtitle: "Editorial, art-directed",   aiSupported: false },
];

const STYLE_PREVIEWS: Record<StyleId, React.ReactNode> = {
  CLASSIC: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#111"/>
      <rect x="8" y="8" width="50" height="4" rx="2" fill="rgba(255,255,255,0.5)"/>
      <rect x="80" y="8" width="12" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
      <rect x="96" y="8" width="12" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>
      <rect x="8" y="20" width="104" height="28" rx="3" fill="rgba(255,255,255,0.06)"/>
      <rect x="30" y="27" width="60" height="6" rx="2" fill="rgba(255,255,255,0.45)"/>
      <rect x="38" y="36" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
      <rect x="8" y="52" width="104" height="1" fill="rgba(255,255,255,0.1)"/>
      <rect x="8" y="57" width="45" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)"/>
      <rect x="67" y="57" width="45" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
  BOLD: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#0a0a0a"/>
      <rect width="120" height="46" fill="rgba(255,255,255,0.07)"/>
      <rect x="0" y="0" width="4" height="46" fill="#D4A843"/>
      <rect x="8" y="26" width="55" height="8" rx="2" fill="rgba(255,255,255,0.7)"/>
      <rect x="8" y="18" width="38" height="5" rx="2" fill="rgba(255,255,255,0.3)"/>
      <rect x="0" y="50" width="120" height="14" fill="rgba(212,168,67,0.1)"/>
      <rect x="8" y="55" width="36" height="3" rx="1.5" fill="#D4A843"/>
      <rect x="50" y="55" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
    </svg>
  ),
  EDITORIAL: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#111"/>
      <rect x="8" y="8" width="32" height="22" rx="2" fill="rgba(255,255,255,0.1)"/>
      <rect x="8" y="33" width="32" height="3.5" rx="1.75" fill="rgba(255,255,255,0.4)"/>
      <rect x="8" y="39" width="28" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)"/>
      <rect x="8" y="44" width="24" height="2.5" rx="1.25" fill="rgba(255,255,255,0.1)"/>
      <rect x="8" y="55" width="14" height="2" rx="1" fill="#D4A843"/>
      <rect x="48" y="8" width="64" height="36" rx="2" fill="rgba(255,255,255,0.08)"/>
      <rect x="48" y="48" width="50" height="5" rx="2" fill="rgba(255,255,255,0.35)"/>
      <rect x="48" y="56" width="40" height="2.5" rx="1.25" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
  CLEAN: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#0f0f0f"/>
      <rect x="25" y="13" width="70" height="7" rx="3" fill="rgba(255,255,255,0.55)"/>
      <rect x="45" y="24" width="30" height="1.5" rx="0.75" fill="#D4A843"/>
      <rect x="20" y="32" width="80" height="2.5" rx="1.25" fill="rgba(255,255,255,0.12)"/>
      <rect x="28" y="37" width="64" height="2.5" rx="1.25" fill="rgba(255,255,255,0.08)"/>
      <rect x="35" y="42" width="50" height="2.5" rx="1.25" fill="rgba(255,255,255,0.06)"/>
      <rect x="40" y="51" width="40" height="9" rx="4.5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75"/>
      <rect x="47" y="54.5" width="26" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
    </svg>
  ),
  CINEMATIC: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#050505"/>
      <rect x="0" y="10" width="120" height="44" fill="rgba(255,255,255,0.05)"/>
      <ellipse cx="60" cy="32" rx="38" ry="20" fill="rgba(255,255,255,0.04)"/>
      <rect x="0" y="0" width="120" height="10" fill="rgba(0,0,0,0.85)"/>
      <rect x="0" y="54" width="120" height="10" fill="rgba(0,0,0,0.85)"/>
      <rect x="28" y="26" width="64" height="7" rx="3" fill="rgba(255,255,255,0.5)"/>
      <rect x="38" y="36" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.22)"/>
    </svg>
  ),
  GRID: (
    <svg viewBox="0 0 120 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="64" fill="#111"/>
      <rect x="8" y="6" width="38" height="5" rx="2" fill="rgba(255,255,255,0.5)"/>
      <rect x="8" y="14" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
      <rect x="8" y="22" width="32" height="19" rx="2" fill="rgba(255,255,255,0.1)"/>
      <rect x="8" y="22" width="2" height="19" fill="#D4A843"/>
      <rect x="44" y="22" width="32" height="19" rx="2" fill="rgba(255,255,255,0.07)"/>
      <rect x="80" y="22" width="32" height="19" rx="2" fill="rgba(255,255,255,0.12)"/>
      <rect x="8" y="44" width="32" height="13" rx="2" fill="rgba(255,255,255,0.06)"/>
      <rect x="44" y="44" width="32" height="13" rx="2" fill="rgba(255,255,255,0.09)"/>
      <rect x="80" y="44" width="32" height="13" rx="2" fill="rgba(255,255,255,0.05)"/>
    </svg>
  ),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function to12hr(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  return { hour: String(h % 12 || 12), minute: String(m).padStart(2, "0"), ampm };
}

function to24hr(hour: string, minute: string, ampm: string): string {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function determineStep(s: Record<string, unknown>): number {
  if (!s.name) return 1;
  if (!s.tagline && !s.bio && !s.logoUrl) return 2;
  const svcs = s.servicesJson
    ? (() => { try { return JSON.parse(s.servicesJson as string); } catch { return []; } })()
    : [];
  if (!Array.isArray(svcs) || svcs.length === 0) return 3;
  const gallery = s.galleryImages as string[] | null;
  if (!s.heroImage && (!gallery || gallery.length === 0)) return 4;
  if (!s.studioHours) return 5;
  if (!s.pageConfig) return 6;
  return 7;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

// ── UploadBox ─────────────────────────────────────────────────────────────────

function UploadBox({
  value, onUpload, guidance, aspect = "wide",
}: {
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
  const sizeClass = aspect === "square" ? "w-32 h-32" : "w-full h-40";
  return value ? (
    <div className={`relative group ${sizeClass} rounded-xl overflow-hidden border`} style={{ borderColor: "var(--border)" }}>
      <img src={value} alt="upload" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={() => onUpload("")}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={13} className="text-white" />
      </button>
    </div>
  ) : (
    <label
      className={`flex flex-col items-center justify-center ${sizeClass} rounded-xl border border-dashed cursor-pointer transition-colors px-4 text-center hover:border-[var(--accent)]/40`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      <ImageIcon size={20} className="text-muted-foreground mb-2" />
      <span className="text-xs font-medium text-muted-foreground">
        {isUploading ? "Uploading…" : "Click to upload"}
      </span>
      {!isUploading && (
        <span className="text-[11px] mt-1.5 leading-snug max-w-[300px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {guidance}
        </span>
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
    </label>
  );
}

// ── GalleryUpload ─────────────────────────────────────────────────────────────

function GalleryUpload({
  images, onChange, max = 6,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  max?: number;
}) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - images.length);
    if (!files.length) return;
    const res = await startUpload(files);
    if (res) onChange([...images, ...res.map(r => r.url)]);
  }
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <label
          className="flex flex-col items-center justify-center w-full h-36 rounded-xl border border-dashed cursor-pointer transition-colors px-4 text-center hover:border-[var(--accent)]/40"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          {isUploading ? (
            <span className="text-xs text-muted-foreground">Uploading…</span>
          ) : (
            <>
              <Plus size={20} className="text-muted-foreground mb-2" />
              <span className="text-xs font-medium text-muted-foreground">Add photos</span>
              <span className="text-[11px] mt-1.5 leading-snug max-w-[300px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Show off your space — console, booth, gear, room shots. Upload at least 3 for the best look.
              </span>
            </>
          )}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} disabled={isUploading} />
        </label>
      )}
      <p className="text-xs text-muted-foreground">{images.length} / {max} photos uploaded</p>
    </div>
  );
}

// ── TimePicker ────────────────────────────────────────────────────────────────

function TimePicker({
  value, onChange,
}: {
  value: string; // "HH:MM" 24hr
  onChange: (v: string) => void;
}) {
  const { hour, minute, ampm } = to12hr(value);
  const selCls = "rounded-lg border px-2 py-1 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50";
  return (
    <div className="flex items-center gap-1">
      <select
        value={hour}
        onChange={e => onChange(to24hr(e.target.value, minute, ampm))}
        className={selCls}
        style={{ borderColor: "var(--border)" }}
      >
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">:</span>
      <select
        value={minute}
        onChange={e => onChange(to24hr(hour, e.target.value, ampm))}
        className={selCls}
        style={{ borderColor: "var(--border)" }}
      >
        {["00", "15", "30", "45"].map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={e => onChange(to24hr(hour, minute, e.target.value))}
        className={selCls}
        style={{ borderColor: "var(--border)" }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [studioTier, setStudioTier] = useState<"PRO" | "ELITE">("PRO");
  const [studioSlug, setStudioSlug] = useState("");

  // Step 1
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Step 2
  const [logoUrl, setLogoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");

  // Step 3
  const [services, setServices] = useState<Service[]>([{ name: "", description: "" }]);

  // Step 4
  const [heroImage, setHeroImage] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);

  // Step 5
  const [hours, setHours] = useState<HoursJson>(DEFAULT_HOURS);
  const [hoursNote, setHoursNote] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");

  // Step 6
  const [selectedStyle, setSelectedStyle] = useState<StyleId>("BOLD");
  const [pageConfig, setPageConfig] = useState<object | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/studio/settings")
      .then(r => r.json())
      .then(d => {
        const s = d.studio;
        if (!s) { router.push("/studio"); return; }
        if (s.onboardingCompleted) { router.push("/studio/settings/public-page"); return; }

        setStudioTier(s.studioTier ?? "PRO");
        setStudioSlug(s.slug ?? "");
        setSlug(s.slug ?? "");
        setName(s.name ?? "");
        setPhone(s.phone ?? "");
        setEmail(s.email ?? "");
        setStreetAddress(s.streetAddress ?? "");
        setCity(s.city ?? "");
        setStateVal(s.state ?? "");
        setZipCode(s.zipCode ?? "");
        setLogoUrl(s.logoUrl ?? "");
        setTagline(s.tagline ?? "");
        setBio(s.bio ?? "");

        if (s.servicesJson) {
          try {
            const parsed = JSON.parse(s.servicesJson);
            if (Array.isArray(parsed) && parsed.length > 0) setServices(parsed);
          } catch { /* ignore */ }
        }

        setHeroImage(s.heroImage ?? "");
        if (Array.isArray(s.galleryImages)) setGallery(s.galleryImages as string[]);

        if (s.studioHours && typeof s.studioHours === "object") {
          setHours({ ...DEFAULT_HOURS, ...(s.studioHours as HoursJson) });
        }
        setHoursNote(s.hoursNote ?? "");
        setInstagram(s.instagram ?? "");
        setTiktok(s.tiktok ?? "");
        setFacebook(s.facebook ?? "");
        setTwitter(s.twitter ?? "");
        if (s.socialLinks && typeof s.socialLinks === "object") {
          setWebsite((s.socialLinks as Record<string, string>).website ?? "");
        }
        if (s.pageConfig) setPageConfig(s.pageConfig as object);

        setStep(determineStep(s as Record<string, unknown>));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = useCallback(async (extra?: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim() || undefined,
        slug: slug.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        streetAddress: streetAddress.trim() || undefined,
        city: city.trim() || undefined,
        state: stateVal.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        logoUrl: logoUrl || undefined,
        tagline: tagline.trim() || undefined,
        bio: bio.trim() || undefined,
        servicesJson: JSON.stringify(services.filter(s => s.name.trim())),
        heroImage: heroImage || undefined,
        galleryImages: gallery.length > 0 ? gallery : undefined,
        studioHours: hours,
        hoursNote: hoursNote.trim() || undefined,
        instagram: instagram.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        facebook: facebook.trim() || undefined,
        twitter: twitter.trim() || undefined,
        socialLinks: website.trim() ? { website: website.trim() } : undefined,
        ...extra,
      };
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return false;
      }
      // Keep studioSlug in sync so the step 7 preview URL stays current
      if (data.studio?.slug) setStudioSlug(data.studio.slug);
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [name, slug, phone, email, streetAddress, city, stateVal, zipCode, logoUrl, tagline, bio, services, heroImage, gallery, hours, hoursNote, instagram, tiktok, facebook, twitter, website]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 1 && !name.trim()) { setError("Studio name is required."); return; }
    if (step === 3) {
      const valid = services.filter(s => s.name.trim());
      if (valid.length === 0) { setError("Add at least one service to continue."); return; }
    }
    setError(null);
    const ok = await save();
    if (ok) setStep(s => (s + 1) as typeof s);
  }

  function handleBack() {
    setError(null);
    setStep(s => Math.max(s - 1, 1) as typeof s);
  }

  const selectedStyleOption = STYLE_OPTIONS.find(s => s.id === selectedStyle)!;

  async function handleGenerate() {
    // Non-AI styles: just save the template and advance
    if (!selectedStyleOption.aiSupported) {
      const ok = await save({ template: selectedStyle });
      if (ok) setStep(7);
      return;
    }
    const ok = await save();
    if (!ok) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseStyle: selectedStyle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      setPageConfig(data.pageConfig as object);
      setStep(7);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    const ok = await save({ isPublished: true, onboardingCompleted: true });
    if (ok) router.push("/studio/settings/public-page");
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const galleryMax = studioTier === "ELITE" ? 12 : 6;
  const stepLabels = ["Basics", "Brand", "Services", "Photos", "Hours", "Style", "Publish"];

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-[600px] space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Set up your studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step {step} of 7 — {stepLabels[step - 1]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(step / 7) * 100}%`, backgroundColor: "#D4A843" }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-between">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: done || active ? "#D4A843" : "var(--muted)",
                    color: done || active ? "#0A0A0A" : "var(--muted-foreground)",
                  }}
                >
                  {done ? <Check size={13} /> : n}
                </div>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border p-6 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>

          {/* ── Step 1: Studio Basics ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Studio basics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Tell us about your studio so clients can find and book you.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Studio Name <span style={{ color: "#D4A843" }}>*</span></label>
                  <input
                    value={name}
                    onChange={e => {
                      const n = e.target.value;
                      setName(n);
                      // Auto-fill slug from name only if user hasn't manually edited it
                      setSlug(prev => {
                        const autoSlug = toSlug(n);
                        // Only auto-update if slug is empty or matches previous auto-slug
                        if (!prev || prev === toSlug(name)) return autoSlug;
                        return prev;
                      });
                    }}
                    placeholder="Your studio name"
                    className={inputCls}
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className={labelCls}>Your Page URL</label>
                  <div
                    className="flex items-center rounded-xl border overflow-hidden"
                    style={{ borderColor: slugStatus === "taken" ? "rgba(239,68,68,0.5)" : slugStatus === "available" ? "rgba(34,197,94,0.5)" : "var(--border)" }}
                  >
                    <span className="px-3 py-2.5 text-sm border-r flex-shrink-0" style={{ borderColor: "var(--border)", color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                      indiethis.com/
                    </span>
                    <input
                      value={slug}
                      onChange={e => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                        setSlug(val);
                        setSlugStatus("checking");
                        if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
                        slugTimerRef.current = setTimeout(async () => {
                          if (!val.trim()) { setSlugStatus("idle"); return; }
                          const res = await fetch(`/api/studio/settings/slug-check?slug=${encodeURIComponent(val)}`);
                          if (res.ok) {
                            const data = await res.json();
                            setSlugStatus(data.available ? "available" : "taken");
                          } else {
                            setSlugStatus("idle");
                          }
                        }, 600);
                      }}
                      placeholder="your-studio-name"
                      className="flex-1 px-3 py-2.5 text-sm bg-transparent text-foreground outline-none"
                    />
                    {slugStatus === "checking" && <Loader2 size={14} className="mr-3 animate-spin text-muted-foreground flex-shrink-0" />}
                    {slugStatus === "available" && <Check size={14} className="mr-3 flex-shrink-0" style={{ color: "#22c55e" }} />}
                    {slugStatus === "taken" && <X size={14} className="mr-3 flex-shrink-0" style={{ color: "#ef4444" }} />}
                  </div>
                  {slugStatus === "taken" && (
                    <p className="text-[11px] mt-1" style={{ color: "#f87171" }}>That URL is already taken. Try another.</p>
                  )}
                  {slugStatus === "available" && (
                    <p className="text-[11px] mt-1" style={{ color: "#86efac" }}>Available!</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      value={phone}
                      onChange={e => setPhone(formatPhoneInput(e.target.value))}
                      placeholder="(555) 555-0100"
                      inputMode="tel"
                      className={inputCls}
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="studio@example.com"
                      type="email"
                      className={inputCls}
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Street Address</label>
                  <input
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    placeholder="123 Studio Drive"
                    className={inputCls}
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={labelCls}>City</label>
                    <input
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Atlanta"
                      className={inputCls}
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                  <div className="w-28">
                    <label className={labelCls}>State</label>
                    <div className="relative">
                      <select
                        value={stateVal}
                        onChange={e => setStateVal(e.target.value)}
                        className={`${inputCls} appearance-none pr-7`}
                        style={{ borderColor: "var(--border)" }}
                      >
                        <option value="">—</option>
                        {[["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]].map(([code, full]) => (
                          <option key={code} value={code}>{code} — {full}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="w-24">
                    <label className={labelCls}>Zip</label>
                    <input
                      value={zipCode}
                      onChange={e => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      placeholder="30301"
                      inputMode="numeric"
                      className={inputCls}
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Brand ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Your brand</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add your logo, tagline, and bio. Our AI uses these to build your page.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Logo</label>
                  <div className="flex items-center gap-4">
                    <UploadBox
                      value={logoUrl || null}
                      onUpload={setLogoUrl}
                      guidance="Upload your studio logo — square format works best."
                      aspect="square"
                    />
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Upload your studio logo.<br />Square format works best.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Tagline</label>
                    <span className="text-[11px] text-muted-foreground">{tagline.length}/100</span>
                  </div>
                  <input
                    value={tagline}
                    onChange={e => setTagline(e.target.value.slice(0, 100))}
                    placeholder="Where Atlanta's sound is made"
                    className={inputCls}
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Bio / About</label>
                    <span className="text-[11px] text-muted-foreground">{bio.length}/500</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 500))}
                    rows={4}
                    placeholder="Tell artists about your studio — your vibe, your gear, what makes you different."
                    className={`${inputCls} resize-none`}
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div className="rounded-xl border px-3.5 py-3 flex items-start gap-2.5" style={{ borderColor: "rgba(212,168,67,0.25)", backgroundColor: "rgba(212,168,67,0.06)" }}>
                  <Sparkles size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold" style={{ color: "#D4A843" }}>Pro tip:</span> A strong tagline and bio gives our AI enough to generate your full page — copy, layout, and all — in one click on step 6.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Services ── */}
          {step === 3 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Services</h2>
                <p className="text-xs text-muted-foreground mt-0.5">What do you offer? Recording, mixing, mastering, podcasts — add them all.</p>
              </div>

              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-3 relative" style={{ borderColor: "var(--border)" }}>
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setServices(services.filter((_, j) => j !== i))}
                        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted flex items-center justify-center"
                      >
                        <X size={12} className="text-muted-foreground" />
                      </button>
                    )}
                    <div>
                      <label className={labelCls}>Service Name</label>
                      <input
                        value={svc.name}
                        onChange={e => {
                          const updated = [...services];
                          updated[i] = { ...updated[i], name: e.target.value };
                          setServices(updated);
                        }}
                        placeholder="e.g. Recording, Mixing, Mastering"
                        className={inputCls}
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <textarea
                        value={svc.description}
                        onChange={e => {
                          const updated = [...services];
                          updated[i] = { ...updated[i], description: e.target.value };
                          setServices(updated);
                        }}
                        rows={2}
                        placeholder="Brief description of this service…"
                        className={`${inputCls} resize-none`}
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setServices([...services, { name: "", description: "" }])}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-dashed transition-colors hover:border-[var(--accent)]/50"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  <Plus size={14} /> Add service
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Photos ── */}
          {step === 4 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Photos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Great photos make your page stand out. You can always add more later.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Hero Image</label>
                  <UploadBox
                    value={heroImage || null}
                    onUpload={setHeroImage}
                    guidance="Upload a wide shot of your studio — your console, live room, or building works best."
                    aspect="wide"
                  />
                </div>

                <div>
                  <label className={labelCls}>Gallery</label>
                  <GalleryUpload images={gallery} onChange={setGallery} max={galleryMax} />
                </div>
              </div>
            </>
          )}

          {/* ── Step 5: Hours & Socials ── */}
          {step === 5 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Hours & socials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set your studio hours and add your social links. Only fill in what you have.</p>
              </div>

              <div className="space-y-2">
                {DAYS.map(day => {
                  const { open, openTime, closeTime } = hours[day];
                  return (
                    <div key={day} className="flex items-center gap-3 flex-wrap">
                      <span className="w-24 text-xs font-medium capitalize" style={{ color: "var(--muted-foreground)" }}>{day}</span>
                      <button
                        type="button"
                        onClick={() => setHours(prev => ({ ...prev, [day]: { ...prev[day], open: !open } }))}
                        className="w-11 h-6 rounded-full transition-colors flex-shrink-0"
                        style={{ backgroundColor: open ? "#D4A843" : "var(--muted)" }}
                      >
                        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${open ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                      {open ? (
                        <div className="flex items-center gap-2">
                          <TimePicker
                            value={openTime}
                            onChange={v => setHours(prev => ({ ...prev, [day]: { ...prev[day], openTime: v } }))}
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <TimePicker
                            value={closeTime}
                            onChange={v => setHours(prev => ({ ...prev, [day]: { ...prev[day], closeTime: v } }))}
                          />
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className={labelCls}>Additional Note</label>
                <input
                  value={hoursNote}
                  onChange={e => setHoursNote(e.target.value)}
                  placeholder="e.g. 24-hour sessions available by appointment"
                  className={inputCls}
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social links</p>
                {[
                  { label: "Instagram", value: instagram, set: setInstagram, placeholder: "@yourstudio" },
                  { label: "TikTok",    value: tiktok,    set: setTiktok,    placeholder: "@yourstudio" },
                  { label: "Facebook",  value: facebook,  set: setFacebook,  placeholder: "YourStudioPage" },
                  { label: "Twitter / X", value: twitter, set: setTwitter,   placeholder: "@yourstudio" },
                  { label: "Website",   value: website,   set: setWebsite,   placeholder: "https://yourstudio.com" },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={placeholder}
                      className={inputCls}
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Step 6: Style & Generate ── */}
          {step === 6 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Pick a style</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Choose a look and let our AI build your full page — copy, layout, and all.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {STYLE_OPTIONS.filter(opt => studioTier === "ELITE" || opt.aiSupported).map(opt => {
                  const active = selectedStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedStyle(opt.id)}
                      className="rounded-xl border p-4 text-left transition-all"
                      style={{
                        borderColor: active ? "#D4A843" : "var(--border)",
                        backgroundColor: active ? "rgba(212,168,67,0.08)" : "var(--background)",
                      }}
                    >
                      <div className="w-full h-16 rounded-lg mb-3 overflow-hidden">
                        {STYLE_PREVIEWS[opt.id]}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{opt.subtitle}</p>
                      {!opt.aiSupported && (
                        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Static template</p>
                      )}
                      {active && (
                        <div className="flex items-center gap-1 mt-2">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
                            <Check size={10} style={{ color: "#0A0A0A" }} />
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: "#D4A843" }}>Selected</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-opacity"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {generating ? (
                    <><Loader2 size={15} className="animate-spin" /> Building your page…</>
                  ) : saving ? (
                    <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  ) : selectedStyleOption.aiSupported ? (
                    <><Sparkles size={15} /> Generate My Page</>
                  ) : (
                    <><ChevronRight size={15} /> Apply Template</>
                  )}
                </button>
                {generating && (
                  <p className="text-xs text-center text-muted-foreground mt-2">This takes about 10–20 seconds.</p>
                )}
                {!selectedStyleOption.aiSupported && (
                  <p className="text-xs text-center text-muted-foreground mt-2">Static templates don't use AI — you can customize content in the editor after setup.</p>
                )}
              </div>
            </>
          )}

          {/* ── Step 7: Review & Publish ── */}
          {step === 7 && (
            <>
              <div>
                <h2 className="text-base font-semibold text-foreground">Review &amp; publish</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your page has been generated. Everything look good?</p>
              </div>

              {/* Preview link */}
              {studioSlug && (
                <a
                  href={`/${studioSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:border-[var(--accent)]/40"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">Preview your page</p>
                    <p className="text-xs text-muted-foreground">indiethis.com/{studioSlug}</p>
                  </div>
                  <ExternalLink size={14} className="text-muted-foreground" />
                </a>
              )}

              {pageConfig && (
                <div className="rounded-xl border px-4 py-3 flex items-start gap-2.5" style={{ borderColor: "rgba(212,168,67,0.25)", backgroundColor: "rgba(212,168,67,0.06)" }}>
                  <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Your page is ready. Publish to make it live, or head to the visual editor to tweak the copy, layout, colors, and more.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/studio/settings/public-page")}
                  className="py-3 rounded-xl text-sm font-semibold border transition-colors hover:border-[var(--accent)]/40"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  Edit first
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={saving}
                  className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {saving ? (
                    <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                  ) : (
                    "Publish & Go Live"
                  )}
                </button>
              </div>
            </>
          )}

        </div>

        {/* Nav buttons — hidden on step 6 (handled inside) and step 7 (handled inside) */}
        {step < 6 && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-30 hover:border-[var(--accent)]/40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                <>Next <ChevronRight size={15} /></>
              )}
            </button>
          </div>
        )}

        {/* Back button on step 6 (Generate is inside the card) */}
        {step === 6 && (
          <div className="flex">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:border-[var(--accent)]/40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
