"use client";

import { useEffect, useState } from "react";
import {
  Globe, Eye, EyeOff, X, Plus, Grip, Check, Wand2,
  ChevronDown, ChevronUp, Save, ExternalLink, Star,
  ImageIcon, Lock, ArrowUp, ArrowDown, RefreshCw,
  AlertCircle, Zap,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import type { PageConfig, SectionConfig } from "@/types/page-config";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceItem = { name: string; description: string };
type Testimonial = { quote: string; author: string; track?: string };
type DayHours    = { open: boolean; openTime: string; closeTime: string };
type HoursJson   = Record<string, DayHours>;

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};
const DEFAULT_HOURS: HoursJson = Object.fromEntries(
  DAYS.map((d) => [d, { open: true, openTime: "09:00", closeTime: "18:00" }])
);

const STYLES = [
  { id: "CLASSIC",   label: "Classic",   desc: "Clean and professional" },
  { id: "BOLD",      label: "Bold",      desc: "Visual and high-impact" },
  { id: "EDITORIAL", label: "Editorial", desc: "Magazine-style and sophisticated" },
] as const;

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  services: "Services",
  gallery: "Gallery",
  testimonials: "Testimonials",
  featured_artists: "Featured Artists",
  about: "About",
  booking_cta: "Booking Call-to-Action",
  contact_form: "Contact Form",
  contact_location: "Location & Hours",
  footer: "Footer",
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

const INPUT = "w-full rounded-xl border px-4 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{hint}</p>}
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}{title}
        </span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

function ImageUploadBtn({ label, value, onUpload, hint }: {
  label: string; value: string | null; onUpload: (url: string) => void; hint?: string;
}) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await startUpload([file]);
    if (res?.[0]?.url) onUpload(res[0].url);
  }
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative group w-full h-40 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={() => onUpload("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={13} className="text-white" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border border-dashed cursor-pointer hover:border-accent/40 transition-colors"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          <ImageIcon size={20} className="text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">{isUploading ? "Uploading…" : `Upload ${label}`}</span>
          {hint && <span className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{hint}</span>}
          <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
        </label>
      )}
    </div>
  );
}

// ─── Gallery Editor ───────────────────────────────────────────────────────────

function GalleryEditor({ images, onChange, max }: { images: string[]; onChange: (imgs: string[]) => void; max: number }) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - images.length);
    if (!files.length) return;
    const res = await startUpload(files);
    if (res) onChange([...images, ...res.map((r) => r.url)]);
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Max {max} photos. First photo becomes the featured image.</p>
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={11} className="text-white" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-accent/40 transition-colors"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
            {isUploading
              ? <span className="text-xs text-muted-foreground">Uploading…</span>
              : <><Plus size={18} className="text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Add</span></>
            }
            <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} disabled={isUploading} />
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Services Editor ──────────────────────────────────────────────────────────

function ServicesEditor({ services, onChange }: { services: ServiceItem[]; onChange: (s: ServiceItem[]) => void }) {
  function update(i: number, field: keyof ServiceItem, val: string) {
    const copy = [...services]; copy[i] = { ...copy[i], [field]: val }; onChange(copy);
  }
  return (
    <div className="space-y-3">
      {services.map((s, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          <div className="flex items-center gap-2">
            <Grip size={13} className="text-muted-foreground cursor-grab shrink-0" />
            <input className={INPUT + " flex-1"} placeholder="Service name (e.g. Recording Session)"
              value={s.name} onChange={(e) => update(i, "name", e.target.value)} style={{ borderColor: "var(--border)" }} />
            <button onClick={() => onChange(services.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>
          <input className={INPUT} placeholder="Short description (optional)"
            value={s.description} onChange={(e) => update(i, "description", e.target.value)} style={{ borderColor: "var(--border)" }} />
        </div>
      ))}
      <button onClick={() => onChange([...services, { name: "", description: "" }])}
        className="flex items-center gap-2 text-xs font-semibold text-accent hover:opacity-80 transition-opacity">
        <Plus size={13} /> Add service
      </button>
    </div>
  );
}

// ─── Testimonials Editor ──────────────────────────────────────────────────────

function TestimonialsEditor({ testimonials, onChange }: { testimonials: Testimonial[]; onChange: (t: Testimonial[]) => void }) {
  function update(i: number, field: keyof Testimonial, val: string) {
    const copy = [...testimonials]; copy[i] = { ...copy[i], [field]: val }; onChange(copy);
  }
  const max = 6;
  return (
    <div className="space-y-3">
      {testimonials.map((t, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          <div className="flex items-start gap-2">
            <textarea className={INPUT + " flex-1 resize-none"} rows={2} placeholder="&ldquo;The quote…&rdquo;"
              value={t.quote} onChange={(e) => update(i, "quote", e.target.value)} style={{ borderColor: "var(--border)" }} />
            <button onClick={() => onChange(testimonials.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-red-400 transition-colors mt-2"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={INPUT} placeholder="Artist name" value={t.author}
              onChange={(e) => update(i, "author", e.target.value)} style={{ borderColor: "var(--border)" }} />
            <input className={INPUT} placeholder="Track / project (optional)" value={t.track ?? ""}
              onChange={(e) => update(i, "track", e.target.value)} style={{ borderColor: "var(--border)" }} />
          </div>
        </div>
      ))}
      {testimonials.length < max && (
        <button onClick={() => onChange([...testimonials, { quote: "", author: "" }])}
          className="flex items-center gap-2 text-xs font-semibold text-accent hover:opacity-80 transition-opacity">
          <Plus size={13} /> Add testimonial
        </button>
      )}
    </div>
  );
}

// ─── Hours Editor ─────────────────────────────────────────────────────────────

function HoursEditor({ hours, onChange }: { hours: HoursJson; onChange: (h: HoursJson) => void }) {
  function set(day: string, field: keyof DayHours, val: string | boolean) {
    onChange({ ...hours, [day]: { ...hours[day], [field]: val } });
  }
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const h = hours[day] ?? { open: true, openTime: "09:00", closeTime: "18:00" };
        return (
          <div key={day} className="flex items-center gap-3">
            <span className="text-xs font-semibold w-8 text-muted-foreground">{DAY_LABELS[day]}</span>
            <button onClick={() => set(day, "open", !h.open)}
              className="w-9 h-5 rounded-full transition-colors relative shrink-0"
              style={{ backgroundColor: h.open ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: h.open ? "calc(100% - 18px)" : "2px" }} />
            </button>
            <input type="time" value={h.openTime} onChange={(e) => set(day, "openTime", e.target.value)}
              disabled={!h.open}
              className="text-xs px-2 py-1 rounded-lg border bg-transparent text-foreground disabled:opacity-30"
              style={{ borderColor: "var(--border)" }} />
            <span className="text-xs text-muted-foreground">–</span>
            <input type="time" value={h.closeTime} onChange={(e) => set(day, "closeTime", e.target.value)}
              disabled={!h.open}
              className="text-xs px-2 py-1 rounded-lg border bg-transparent text-foreground disabled:opacity-30"
              style={{ borderColor: "var(--border)" }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Editor (Step 4) ──────────────────────────────────────────────────

function SectionCard({
  section, index, total,
  onToggle, onContentChange, onMoveUp, onMoveDown,
}: {
  section: SectionConfig; index: number; total: number;
  onToggle: () => void;
  onContentChange: (key: string, val: string | boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const textFields = Object.entries(section.content).filter(([, v]) => typeof v === "string") as [string, string][];
  const boolFields = Object.entries(section.content).filter(([, v]) => typeof v === "boolean") as [string, boolean][];

  return (
    <div className="rounded-xl border overflow-hidden transition-opacity"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)", opacity: section.visible ? 1 : 0.5 }}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <ArrowUp size={11} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <ArrowDown size={11} />
          </button>
        </div>
        {/* Label */}
        <button onClick={() => setOpen(!open)} className="flex-1 text-left">
          <span className="text-sm font-medium text-foreground">{SECTION_LABELS[section.type] ?? section.type}</span>
          <span className="text-xs text-muted-foreground ml-2">{section.variant}</span>
        </button>
        {/* Visible toggle */}
        <button onClick={onToggle}
          className="w-9 h-5 rounded-full transition-colors relative shrink-0"
          style={{ backgroundColor: section.visible ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: section.visible ? "calc(100% - 18px)" : "2px" }} />
        </button>
        <button onClick={() => setOpen(!open)} className="text-muted-foreground">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          {textFields.map(([key, val]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</label>
              {val.length > 80 ? (
                <textarea
                  className={INPUT + " resize-none"}
                  rows={3}
                  value={val}
                  onChange={(e) => onContentChange(key, e.target.value)}
                  style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <input
                  className={INPUT}
                  value={val}
                  onChange={(e) => onContentChange(key, e.target.value)}
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          ))}
          {boolFields.map(([key, val]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</span>
              <button onClick={() => onContentChange(key, !val)}
                className="w-9 h-5 rounded-full transition-colors relative"
                style={{ backgroundColor: val ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: val ? "calc(100% - 18px)" : "2px" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicPageEditor() {
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [studioId, setStudioId]       = useState("");
  const [slug, setSlug]               = useState("");
  const [studioTier, setStudioTier]   = useState<"PRO" | "ELITE">("PRO");
  const isElite = studioTier === "ELITE";

  // Published
  const [isPublished, setIsPublished] = useState(false);

  // Profile fields
  const [name,        setName]        = useState("");
  const [tagline,     setTagline]     = useState("");
  const [bio,         setBio]         = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [logoUrl,     setLogoUrl]     = useState("");
  const [heroImage,   setHeroImage]   = useState("");
  const [gallery,     setGallery]     = useState<string[]>([]);
  const [services,    setServices]    = useState<ServiceItem[]>([]);
  const [hours,       setHours]       = useState<HoursJson>(DEFAULT_HOURS);
  const [hoursNote,   setHoursNote]   = useState("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Social links
  const [instagram, setInstagram] = useState("");
  const [tiktok,    setTiktok]    = useState("");
  const [facebook,  setFacebook]  = useState("");
  const [twitter,   setTwitter]   = useState("");

  // Style & generation
  const [baseStyle, setBaseStyle]             = useState<"CLASSIC" | "BOLD" | "EDITORIAL">("BOLD");
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [generating, setGenerating]           = useState(false);
  const [generateError, setGenerateError]     = useState<string | null>(null);

  // Page config (Step 4)
  const [pageConfig, setPageConfig] = useState<PageConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved]   = useState(false);

  // Publish validation error
  const [publishError, setPublishError] = useState<string | null>(null);

  const generationLimit = isElite ? 10 : 3;
  const generationsLeft = Math.max(0, generationLimit - generationsUsed);
  const atLimit = generationsUsed >= generationLimit;
  const galleryMax = isElite ? 12 : 6;

  // Load studio data
  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then(({ studio: s }) => {
        if (!s) return;
        setStudioId(s.id ?? "");
        setSlug(s.slug ?? "");
        setStudioTier(s.studioTier ?? "PRO");
        setIsPublished(s.isPublished ?? false);
        setName(s.name ?? "");
        setTagline(s.tagline ?? "");
        setBio(s.bio ?? s.description ?? "");
        setPhone(s.phone ?? "");
        setEmail(s.email ?? "");
        setLogoUrl(s.logoUrl ?? s.logo ?? "");
        setHeroImage(s.heroImage ?? "");
        setGallery((s.galleryImages as string[] | null) ?? s.photos ?? []);
        if (s.servicesJson) {
          try { setServices(JSON.parse(s.servicesJson)); } catch {}
        } else if (s.services?.length) {
          setServices(s.services.map((sv: string) => ({ name: sv, description: "" })));
        }
        if (s.studioHours && typeof s.studioHours === "object") setHours(s.studioHours as HoursJson);
        setHoursNote(s.hoursNote ?? "");
        if (s.testimonials) { try { setTestimonials(JSON.parse(s.testimonials)); } catch {} }
        setInstagram(s.instagram ?? "");
        setTiktok(s.tiktok ?? "");
        setFacebook(s.facebook ?? "");
        setTwitter(s.twitter ?? "");
        setGenerationsUsed(s.generationsUsedThisMonth ?? 0);
        if (s.pageConfig && typeof s.pageConfig === "object") setPageConfig(s.pageConfig as PageConfig);
        // Detect base style from template
        if (s.template && ["CLASSIC", "BOLD", "EDITORIAL"].includes(s.template)) {
          setBaseStyle(s.template as "CLASSIC" | "BOLD" | "EDITORIAL");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Save profile (no generation credit used)
  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, tagline, bio, phone, email,
          logoUrl: logoUrl || null,
          heroImage: heroImage || null,
          galleryImages: gallery,
          servicesJson: JSON.stringify(services),
          studioHours: hours, hoursNote,
          testimonials: JSON.stringify(testimonials),
          instagram: instagram || null,
          tiktok: tiktok || null,
          facebook: facebook || null,
          twitter: twitter || null,
        }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  // Generate page via AI
  async function handleGenerate() {
    setGenerating(true); setGenerateError(null);
    try {
      const res = await fetch("/api/studio/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseStyle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "Generation failed.");
        return;
      }
      setPageConfig(data.pageConfig as PageConfig);
      setGenerationsUsed((prev) => prev + 1);
    } finally { setGenerating(false); }
  }

  // Save pageConfig tweaks (no generation credit)
  async function handleSaveConfig() {
    if (!pageConfig) return;
    setSavingConfig(true); setConfigSaved(false);
    try {
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageConfig }),
      });
      if (res.ok) { setConfigSaved(true); setTimeout(() => setConfigSaved(false), 3000); }
    } finally { setSavingConfig(false); }
  }

  // Publish / Unpublish
  async function handlePublish() {
    setPublishError(null);
    // Validate minimum requirements
    if (!name.trim()) { setPublishError("Studio name is required."); return; }
    if (services.length === 0) { setPublishError("At least one service is required."); return; }
    if (!phone.trim() && !email.trim()) { setPublishError("A phone number or email is required."); return; }

    const newState = !isPublished;
    const res = await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: newState }),
    });
    if (res.ok) setIsPublished(newState);
  }

  // Section config helpers
  function updateSection(idx: number, patch: Partial<SectionConfig>) {
    if (!pageConfig) return;
    const sections = pageConfig.sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setPageConfig({ ...pageConfig, sections });
  }

  function updateSectionContent(idx: number, key: string, val: string | boolean) {
    if (!pageConfig) return;
    const section = pageConfig.sections[idx];
    updateSection(idx, { content: { ...section.content, [key]: val } });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    if (!pageConfig) return;
    const sections = [...pageConfig.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setPageConfig({ ...pageConfig, sections });
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const generateLabel = generating
    ? "AI is building your page…"
    : atLimit
      ? "Generate — $1.00"
      : `Generate My Page (${generationsLeft} of ${generationLimit} remaining)`;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24">

      {/* ── Top Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">Your Studio Page</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Build and publish your public website</p>
        </div>
        <div className="flex items-center gap-3">
          {slug && (
            <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-accent no-underline hover:opacity-80 transition-opacity">
              <Eye size={12} /> Preview
            </a>
          )}
          <button
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              backgroundColor: isPublished ? "transparent" : "var(--accent)",
              color: isPublished ? "var(--foreground)" : "#0A0A0A",
              border: isPublished ? "1px solid var(--border)" : "none",
            }}
          >
            {isPublished ? <><EyeOff size={13} /> Unpublish</> : <><Globe size={13} /> Publish</>}
          </button>
        </div>
      </div>

      {/* Not live banner */}
      {!isPublished && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium"
          style={{ backgroundColor: "#D4A84320", color: "#D4A843", border: "1px solid #D4A84340" }}>
          <AlertCircle size={15} />
          Your page is not live yet. Publish when you&apos;re ready.
        </div>
      )}

      {publishError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium"
          style={{ backgroundColor: "#EF444420", color: "#EF4444", border: "1px solid #EF444430" }}>
          <AlertCircle size={15} /> {publishError}
        </div>
      )}

      {/* ── Generation Counter ────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-accent" />
            <span className="text-sm font-semibold text-foreground">AI Generations</span>
            {isElite && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{ backgroundColor: "#D4A84320", color: "#D4A843" }}>Elite</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">Resets the 1st of each month</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (generationsUsed / generationLimit) * 100)}%`,
                backgroundColor: atLimit ? "#EF4444" : "var(--accent)",
              }} />
          </div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            {generationsUsed} of {generationLimit} used
          </span>
        </div>
        {atLimit && (
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Need more? Each extra generation is $1.00 — charged automatically.
          </p>
        )}
      </div>

      {/* ── Step 1: Fill Your Profile ─────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Step 1 — Fill Your Profile</p>

        {/* Basic Info */}
        <Section title="Basic Info">
          <Field label="Studio Name">
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your studio name" style={{ borderColor: "var(--border)" }} />
          </Field>
          <Field label="Tagline" hint={`${tagline.length}/100 characters`}>
            <input className={INPUT} value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 100))}
              placeholder="e.g. Where Chicago Artists Come to Sound Their Best"
              style={{ borderColor: "var(--border)" }} />
          </Field>
          <Field label="Bio" hint={`${bio.length}/500 characters`}>
            <textarea className={INPUT + " resize-none"} rows={4} value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              placeholder="Tell your story…" style={{ borderColor: "var(--border)" }} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567" style={{ borderColor: "var(--border)" }} />
            </Field>
            <Field label="Email">
              <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="studio@example.com" style={{ borderColor: "var(--border)" }} />
            </Field>
          </div>
        </Section>

        <div className="mt-3">
          <Section title="Logo & Hero Image">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Logo">
                <ImageUploadBtn label="Logo" value={logoUrl || null} onUpload={setLogoUrl} hint="Square recommended" />
              </Field>
              <Field label="Hero Image">
                <ImageUploadBtn label="Hero" value={heroImage || null} onUpload={setHeroImage} hint="1920×1080px" />
              </Field>
            </div>
          </Section>
        </div>

        <div className="mt-3">
          <Section title="Studio Photos" defaultOpen={false}>
            <GalleryEditor images={gallery} onChange={setGallery} max={galleryMax} />
          </Section>
        </div>

        <div className="mt-3">
          <Section title="Services" defaultOpen={false}>
            <ServicesEditor services={services} onChange={setServices} />
          </Section>
        </div>

        <div className="mt-3">
          <Section title="Studio Hours" defaultOpen={false}>
            <HoursEditor hours={hours} onChange={setHours} />
            <Field label="Hours Note (optional)">
              <input className={INPUT} value={hoursNote} onChange={(e) => setHoursNote(e.target.value)}
                placeholder="e.g. 24-hour sessions available by appointment"
                style={{ borderColor: "var(--border)" }} />
            </Field>
          </Section>
        </div>

        <div className="mt-3">
          <Section title="Social Links" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Instagram">
                <input className={INPUT} value={instagram} onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@handle" style={{ borderColor: "var(--border)" }} />
              </Field>
              <Field label="TikTok">
                <input className={INPUT} value={tiktok} onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@handle" style={{ borderColor: "var(--border)" }} />
              </Field>
              <Field label="Facebook">
                <input className={INPUT} value={facebook} onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Page name or URL" style={{ borderColor: "var(--border)" }} />
              </Field>
              <Field label="Twitter / X">
                <input className={INPUT} value={twitter} onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@handle" style={{ borderColor: "var(--border)" }} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="mt-3">
          <Section title="Testimonials" defaultOpen={false}>
            <TestimonialsEditor testimonials={testimonials} onChange={setTestimonials} />
          </Section>
        </div>

        {/* Featured Artists */}
        <div className="mt-3">
          {isElite ? (
            <Section title="Featured Artists" defaultOpen={false}>
              <p className="text-xs text-muted-foreground">
                Artists linked to your studio with published pages appear automatically.
                Manage them in the{" "}
                <a href="/studio/artists" className="text-accent no-underline hover:underline">Artists tab</a>.
              </p>
            </Section>
          ) : (
            <div className="rounded-2xl border p-5 flex items-center gap-4 opacity-60"
              style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Lock size={16} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Featured Artists — Elite Only</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Elite to showcase your roster on your public page.</p>
              </div>
            </div>
          )}
        </div>

        {/* Save profile */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* ── Step 2: Choose Your Style ─────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Step 2 — Choose Your Style</p>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-3 gap-3">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setBaseStyle(s.id as "CLASSIC" | "BOLD" | "EDITORIAL")}
                className="rounded-xl border p-4 text-left transition-all"
                style={{
                  borderColor: baseStyle === s.id ? "var(--accent)" : "var(--border)",
                  backgroundColor: baseStyle === s.id ? "rgba(212,168,67,0.08)" : "transparent",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-foreground">{s.label}</span>
                  {baseStyle === s.id && <Check size={13} className="text-accent" />}
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 3: Generate ──────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Step 3 — Generate</p>
        <div className="rounded-2xl border p-6 text-center space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div>
            <Wand2 size={28} className="mx-auto mb-3 text-accent" />
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Our AI will read your profile and build a custom page layout, copy, and design.
            </p>
          </div>

          {generateError && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-left"
              style={{ backgroundColor: "#EF444420", color: "#EF4444", border: "1px solid #EF444430" }}>
              <AlertCircle size={14} className="shrink-0" /> {generateError}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {generating ? (
              <><RefreshCw size={15} className="animate-spin" /> AI is building your page…</>
            ) : (
              <><Wand2 size={15} /> {generateLabel}</>
            )}
          </button>

          {generating && (
            <p className="text-xs text-muted-foreground">This takes 3–5 seconds…</p>
          )}
        </div>
      </div>

      {/* ── Step 4: Preview & Tweak ───────────────────────────── */}
      {pageConfig && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Step 4 — Preview & Tweak</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {/* Preview link */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold text-foreground">Page Sections</span>
              <div className="flex items-center gap-3">
                {slug && (
                  <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent no-underline hover:opacity-80 transition-opacity">
                    <ExternalLink size={12} /> View Live
                  </a>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
                  Regenerate
                </button>
              </div>
            </div>

            {/* Section cards */}
            <div className="p-4 space-y-2">
              {pageConfig.sections.map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  total={pageConfig.sections.length}
                  onToggle={() => updateSection(i, { visible: !section.visible })}
                  onContentChange={(key, val) => updateSectionContent(i, key, val)}
                  onMoveUp={() => moveSection(i, -1)}
                  onMoveDown={() => moveSection(i, 1)}
                />
              ))}
            </div>

            {/* Save config */}
            <div className="px-5 pb-5 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
              >
                {configSaved ? <Check size={14} /> : <Save size={14} />}
                {configSaved ? "Saved!" : savingConfig ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Publish ───────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Step 5 — Publish</p>
        <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {isPublished ? "Your page is live" : "Ready to go live?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPublished
                ? `Your studio is visible at indiethis.com/${slug}`
                : "Requires: studio name + at least 1 service + phone or email."}
            </p>
          </div>

          {publishError && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
              style={{ backgroundColor: "#EF444420", color: "#EF4444", border: "1px solid #EF444430" }}>
              <AlertCircle size={14} className="shrink-0" /> {publishError}
            </div>
          )}

          <button
            onClick={handlePublish}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              backgroundColor: isPublished ? "transparent" : "var(--accent)",
              color: isPublished ? "var(--foreground)" : "#0A0A0A",
              border: isPublished ? "1px solid var(--border)" : "none",
            }}
          >
            {isPublished
              ? <><EyeOff size={14} /> Unpublish Page</>
              : <><Globe size={14} /> Publish My Page</>}
          </button>

          {isPublished && slug && (
            <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent no-underline hover:opacity-80 transition-opacity">
              <ExternalLink size={12} /> View your live page
            </a>
          )}
        </div>
      </div>

    </div>
  );
}
