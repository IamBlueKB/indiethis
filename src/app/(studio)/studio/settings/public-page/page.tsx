"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Globe, Eye, EyeOff, X, Plus, Check, Wand2,
  ChevronDown, ChevronUp, Save, ExternalLink,
  ImageIcon, Lock, ArrowUp, ArrowDown, RefreshCw,
  AlertCircle, Zap, Monitor, Smartphone,
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
  { id: "CLASSIC",   label: "Classic",    desc: "Clean and professional" },
  { id: "BOLD",      label: "Bold",       desc: "Visual and high-impact" },
  { id: "EDITORIAL", label: "Editorial",  desc: "Magazine-style" },
  { id: "CLEAN",     label: "Clean",      desc: "Minimal, modern" },
  { id: "CINEMATIC", label: "Cinematic",  desc: "Dramatic, immersive" },
  { id: "GRID",      label: "Grid",       desc: "Editorial, art-directed" },
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

const EDITOR_SECTIONS = [
  { key: "hero",       label: "Hero" },
  { key: "services",   label: "Services" },
  { key: "gallery",    label: "Gallery" },
  { key: "about",      label: "About & Bio" },
  { key: "hours",      label: "Hours" },
  { key: "location",   label: "Location" },
  { key: "contact",    label: "Contact" },
  { key: "socials",    label: "Social Links" },
  { key: "design",     label: "Design" },
] as const;

const INPUT = "w-full rounded-xl border px-4 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40";

// ─── Shared UI ───────────────────────────────────────────────────────────────

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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-9 h-5 rounded-full transition-colors relative shrink-0"
      style={{ backgroundColor: on ? "var(--accent)" : "rgba(255,255,255,0.1)" }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? "calc(100% - 18px)" : "2px" }} />
    </button>
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
        <div className="relative group w-full h-32 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button onClick={() => onUpload("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={13} className="text-white" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border border-dashed cursor-pointer hover:border-accent/40 transition-colors"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          <ImageIcon size={18} className="text-muted-foreground mb-1.5" />
          <span className="text-xs text-muted-foreground">{isUploading ? "Uploading…" : `Upload ${label}`}</span>
          {hint && <span className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{hint}</span>}
          <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
        </label>
      )}
    </div>
  );
}

// ─── Gallery Editor ───────────────────────────────────────────────────────────

function GalleryEditor({ images, onChange, max }: { images: string[]; onChange: (imgs: string[]) => void; max: number }) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - images.length);
    if (!files.length) return;
    const res = await startUpload(files);
    if (res) onChange([...images, ...res.map((r) => r.url)]);
  }

  function onDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...images];
    const [item] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, item);
    onChange(next);
    setDragIdx(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Max {max} photos. Drag to reorder.</p>
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={url + i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="relative group aspect-square rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing"
            style={{ borderColor: "var(--border)", opacity: dragIdx === i ? 0.5 : 1 }}>
            <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
            <button onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={11} className="text-white" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-accent/40 transition-colors"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
            {isUploading
              ? <span className="text-xs text-muted-foreground">Uploading…</span>
              : <><Plus size={16} className="text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Add</span></>}
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
        <div key={i} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
          <div className="flex items-center gap-2">
            <input className={INPUT + " flex-1"} placeholder="Service name"
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
          <div key={day} className="flex items-center gap-2.5">
            <span className="text-xs font-semibold w-8 text-muted-foreground">{DAY_LABELS[day]}</span>
            <Toggle on={h.open} onToggle={() => set(day, "open", !h.open)} />
            <input type="time" value={h.openTime} onChange={(e) => set(day, "openTime", e.target.value)}
              disabled={!h.open} className="text-xs px-2 py-1 rounded-lg border bg-transparent text-foreground disabled:opacity-30"
              style={{ borderColor: "var(--border)" }} />
            <span className="text-xs text-muted-foreground">–</span>
            <input type="time" value={h.closeTime} onChange={(e) => set(day, "closeTime", e.target.value)}
              disabled={!h.open} className="text-xs px-2 py-1 rounded-lg border bg-transparent text-foreground disabled:opacity-30"
              style={{ borderColor: "var(--border)" }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── PageConfig Section Card (for AI-generated configs) ──────────────────────

function SectionCard({ section, index, total, onToggle, onContentChange, onMoveUp, onMoveDown }: {
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
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"><ArrowUp size={11} /></button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"><ArrowDown size={11} /></button>
        </div>
        <button onClick={() => setOpen(!open)} className="flex-1 text-left">
          <span className="text-sm font-medium text-foreground">{SECTION_LABELS[section.type] ?? section.type}</span>
          <span className="text-xs text-muted-foreground ml-2">{section.variant}</span>
        </button>
        <Toggle on={section.visible} onToggle={onToggle} />
        <button onClick={() => setOpen(!open)} className="text-muted-foreground">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          {textFields.map(([key, val]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</label>
              {val.length > 80
                ? <textarea className={INPUT + " resize-none"} rows={3} value={val} onChange={(e) => onContentChange(key, e.target.value)} style={{ borderColor: "var(--border)" }} />
                : <input className={INPUT} value={val} onChange={(e) => onContentChange(key, e.target.value)} style={{ borderColor: "var(--border)" }} />
              }
            </div>
          ))}
          {boolFields.map(([key, val]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</span>
              <Toggle on={val} onToggle={() => onContentChange(key, !val)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Edit Panel ───────────────────────────────────────────────────────

function SectionEditPanel({
  sectionKey, saving, saved, onSave,
  // All data fields
  name, setName, tagline, setTagline, heroImage, setHeroImage, logoUrl, setLogoUrl,
  services, setServices, gallery, setGallery, galleryMax,
  bio, setBio, hours, setHours, hoursNote, setHoursNote,
  streetAddress, setStreetAddress, city, setCity, state, setState, zipCode, setZipCode,
  phone, setPhone, email, setEmail,
  instagram, setInstagram, tiktok, setTiktok, facebook, setFacebook, twitter, setTwitter, youtube, setYoutube,
  accentColor, setAccentColor,
  pageConfig, setPageConfig, updateSection, updateSectionContent, moveSection,
  savingConfig, configSaved, handleSaveConfig,
}: {
  sectionKey: string; saving: boolean; saved: boolean; onSave: () => void;
  name: string; setName: (v: string) => void;
  tagline: string; setTagline: (v: string) => void;
  heroImage: string; setHeroImage: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  services: ServiceItem[]; setServices: (v: ServiceItem[]) => void;
  gallery: string[]; setGallery: (v: string[]) => void; galleryMax: number;
  bio: string; setBio: (v: string) => void;
  hours: HoursJson; setHours: (v: HoursJson) => void;
  hoursNote: string; setHoursNote: (v: string) => void;
  streetAddress: string; setStreetAddress: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  zipCode: string; setZipCode: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  instagram: string; setInstagram: (v: string) => void;
  tiktok: string; setTiktok: (v: string) => void;
  facebook: string; setFacebook: (v: string) => void;
  twitter: string; setTwitter: (v: string) => void;
  youtube: string; setYoutube: (v: string) => void;
  accentColor: string; setAccentColor: (v: string) => void;
  pageConfig: PageConfig | null; setPageConfig: (c: PageConfig) => void;
  updateSection: (idx: number, patch: Partial<SectionConfig>) => void;
  updateSectionContent: (idx: number, key: string, val: string | boolean) => void;
  moveSection: (idx: number, dir: -1 | 1) => void;
  savingConfig: boolean; configSaved: boolean; handleSaveConfig: () => void;
}) {
  const content: Record<string, React.ReactNode> = {
    hero: (
      <div className="space-y-4">
        <Field label="Studio Name">
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="Tagline">
          <input className={INPUT} value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 100))} placeholder="e.g. Where Artists Come to Sound Their Best" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="Hero Image" hint="1920×1080 recommended">
          <ImageUploadBtn label="Hero" value={heroImage || null} onUpload={setHeroImage} />
        </Field>
      </div>
    ),
    services: <ServicesEditor services={services} onChange={setServices} />,
    gallery: <GalleryEditor images={gallery} onChange={setGallery} max={galleryMax} />,
    about: (
      <div className="space-y-4">
        <Field label="Bio" hint={`${bio.length}/500`}>
          <textarea className={INPUT + " resize-none"} rows={6} value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 500))}
            placeholder="Tell your story…" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="Logo" hint="Square recommended">
          <ImageUploadBtn label="Logo" value={logoUrl || null} onUpload={setLogoUrl} />
        </Field>
      </div>
    ),
    hours: (
      <div className="space-y-4">
        <HoursEditor hours={hours} onChange={setHours} />
        <Field label="Hours Note">
          <input className={INPUT} value={hoursNote} onChange={(e) => setHoursNote(e.target.value)}
            placeholder="e.g. 24hr sessions by appointment" style={{ borderColor: "var(--border)" }} />
        </Field>
      </div>
    ),
    location: (
      <div className="space-y-4">
        <Field label="Street Address">
          <input className={INPUT} value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} style={{ borderColor: "var(--border)" }} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className={INPUT} value={city} onChange={(e) => setCity(e.target.value)} style={{ borderColor: "var(--border)" }} />
          </Field>
          <Field label="State">
            <input className={INPUT} value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. IL" style={{ borderColor: "var(--border)" }} />
          </Field>
        </div>
        <Field label="ZIP Code">
          <input className={INPUT} value={zipCode} onChange={(e) => setZipCode(e.target.value)} style={{ borderColor: "var(--border)" }} />
        </Field>
      </div>
    ),
    contact: (
      <div className="space-y-4">
        <Field label="Phone">
          <input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={{ borderColor: "var(--border)" }} />
        </Field>
        <Field label="Email">
          <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="studio@example.com" style={{ borderColor: "var(--border)" }} />
        </Field>
      </div>
    ),
    socials: (
      <div className="space-y-4">
        <Field label="Instagram"><input className={INPUT} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" style={{ borderColor: "var(--border)" }} /></Field>
        <Field label="TikTok"><input className={INPUT} value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle" style={{ borderColor: "var(--border)" }} /></Field>
        <Field label="YouTube"><input className={INPUT} value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/..." style={{ borderColor: "var(--border)" }} /></Field>
        <Field label="Facebook"><input className={INPUT} value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Page name or URL" style={{ borderColor: "var(--border)" }} /></Field>
        <Field label="Twitter / X"><input className={INPUT} value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" style={{ borderColor: "var(--border)" }} /></Field>
      </div>
    ),
    design: (
      <div className="space-y-4">
        <Field label="Accent Color" hint="Used for buttons, highlights">
          <div className="flex items-center gap-3">
            <input type="color" value={accentColor || "#D4A843"} onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg border cursor-pointer bg-transparent" style={{ borderColor: "var(--border)" }} />
            <input className={INPUT} value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#D4A843" style={{ borderColor: "var(--border)" }} />
          </div>
        </Field>
      </div>
    ),
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {content[sectionKey] ?? (
          <p className="text-xs text-muted-foreground">Select a section to edit.</p>
        )}

        {/* AI PageConfig section editor — shown when pageConfig exists and section is "ai-config" */}
        {sectionKey === "ai-sections" && pageConfig && (
          <div className="space-y-2">
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
            <button onClick={handleSaveConfig} disabled={savingConfig}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
              {configSaved ? <><Check size={13} /> Saved!</> : savingConfig ? "Saving…" : <><Save size={13} /> Save Config</>}
            </button>
          </div>
        )}
      </div>

      {sectionKey !== "ai-sections" && (
        <div className="p-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={onSave} disabled={saving}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
            {saved ? <><Check size={13} /> Saved!</> : saving ? "Saving…" : <><Save size={13} /> Save Section</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicPageEditor() {
  // ── State ──
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [studioId, setStudioId]       = useState("");
  const [slug, setSlug]               = useState("");
  const [studioTier, setStudioTier]   = useState<"PRO" | "ELITE">("PRO");
  const isElite = studioTier === "ELITE";
  const [isPublished, setIsPublished] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Profile
  const [name,          setName]          = useState("");
  const [tagline,       setTagline]       = useState("");
  const [bio,           setBio]           = useState("");
  const [phone,         setPhone]         = useState("");
  const [email,         setEmail]         = useState("");
  const [logoUrl,       setLogoUrl]       = useState("");
  const [heroImage,     setHeroImage]     = useState("");
  const [gallery,       setGallery]       = useState<string[]>([]);
  const [services,      setServices]      = useState<ServiceItem[]>([]);
  const [hours,         setHours]         = useState<HoursJson>(DEFAULT_HOURS);
  const [hoursNote,     setHoursNote]     = useState("");
  const [testimonials,  setTestimonials]  = useState<Testimonial[]>([]);
  const [streetAddress, setStreetAddress] = useState("");
  const [city,          setCity]          = useState("");
  const [stateVal,      setStateVal]      = useState("");
  const [zipCode,       setZipCode]       = useState("");
  const [instagram,     setInstagram]     = useState("");
  const [tiktok,        setTiktok]        = useState("");
  const [facebook,      setFacebook]      = useState("");
  const [twitter,       setTwitter]       = useState("");
  const [youtube,       setYoutube]       = useState("");
  const [accentColor,   setAccentColor]   = useState("#D4A843");

  // Style & generation
  const [baseStyle, setBaseStyle] = useState<"CLASSIC" | "BOLD" | "EDITORIAL" | "CLEAN" | "CINEMATIC" | "GRID">("BOLD");
  const [isCustom, setIsCustom] = useState(false);
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [generating, setGenerating]           = useState(false);
  const [generateError, setGenerateError]     = useState<string | null>(null);

  // Page config
  const [pageConfig, setPageConfig]   = useState<PageConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved]   = useState(false);

  // Editor UI
  const [mobile, setMobile]                 = useState(false);
  const [selectedSection, setSelectedSection] = useState("hero");
  const [frameReady, setFrameReady]         = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const generationLimit = isElite ? 10 : 3;
  const generationsLeft = Math.max(0, generationLimit - generationsUsed);
  const atLimit = generationsUsed >= generationLimit;
  const galleryMax = isElite ? 12 : 6;

  // ── Load studio data ──
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
        setStreetAddress(s.streetAddress ?? "");
        setCity(s.city ?? "");
        setStateVal(s.state ?? "");
        setZipCode(s.zipCode ?? "");
        setInstagram(s.instagram ?? "");
        setTiktok(s.tiktok ?? "");
        setFacebook(s.facebook ?? "");
        setTwitter(s.twitter ?? "");
        setYoutube(s.youtube ?? "");
        setAccentColor(s.accentColor ?? "#D4A843");
        setGenerationsUsed(s.generationsUsedThisMonth ?? 0);
        if (s.pageConfig && typeof s.pageConfig === "object") setPageConfig(s.pageConfig as PageConfig);
        if (s.template === "CUSTOM") setIsCustom(true);
        if (s.template && ["CLASSIC", "BOLD", "EDITORIAL", "CLEAN", "CINEMATIC", "GRID"].includes(s.template)) {
          setBaseStyle(s.template as typeof baseStyle);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Build draft studio for postMessage ──
  const buildDraftStudio = useCallback(() => ({
    id: studioId, slug,
    name, tagline, bio, phone, email,
    logoUrl: logoUrl || null, logo: logoUrl || null,
    heroImage: heroImage || null,
    galleryImages: gallery,
    studioHours: hours, hoursNote,
    accentColor,
    instagram: instagram || null, tiktok: tiktok || null,
    facebook: facebook || null, twitter: twitter || null, youtube: youtube || null,
    streetAddress: streetAddress || null, city: city || null,
    state: stateVal || null, zipCode: zipCode || null,
    template: baseStyle, pageConfig,
  }), [studioId, slug, name, tagline, bio, phone, email, logoUrl, heroImage, gallery,
       hours, hoursNote, accentColor, instagram, tiktok, facebook, twitter, youtube,
       streetAddress, city, stateVal, zipCode, baseStyle, pageConfig]);

  const sendDraft = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({
      type: "DRAFT_UPDATE",
      payload: {
        studio: buildDraftStudio(),
        template: baseStyle,
        pageConfig,
        services,
        testimonials,
      },
    }, "*");
  }, [buildDraftStudio, baseStyle, pageConfig, services, testimonials]);

  // ── Listen for FRAME_READY ──
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "FRAME_READY") { setFrameReady(true); sendDraft(); }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [sendDraft]);

  // ── Debounced draft sync ──
  useEffect(() => {
    if (!frameReady) return;
    const t = setTimeout(sendDraft, 400);
    return () => clearTimeout(t);
  }, [name, tagline, bio, heroImage, logoUrl, gallery, services, hours, hoursNote,
      instagram, tiktok, facebook, twitter, youtube, streetAddress, city, stateVal,
      zipCode, phone, email, accentColor, baseStyle, pageConfig, frameReady, sendDraft]);

  // ── Section save ──
  async function handleSectionSave() {
    setSaving(true); setSaved(false);
    const sectionData: Record<string, unknown> = {
      hero:     { name, tagline, heroImage: heroImage || null },
      services: { servicesJson: JSON.stringify(services) },
      gallery:  { galleryImages: gallery },
      about:    { bio, logoUrl: logoUrl || null },
      hours:    { studioHours: hours, hoursNote },
      location: { streetAddress: streetAddress || null, city: city || null, state: stateVal || null, zipCode: zipCode || null },
      contact:  { phone: phone || null, email: email || null },
      socials:  { instagram: instagram || null, tiktok: tiktok || null, facebook: facebook || null, twitter: twitter || null, youtube: youtube || null },
      design:   { accentColor: accentColor || null, template: baseStyle },
    }[selectedSection] ?? {};

    try {
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sectionData),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  // ── Generate ──
  async function handleGenerate() {
    setGenerating(true); setGenerateError(null);
    try {
      const res = await fetch("/api/studio/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseStyle }),
      });
      const data = await res.json();
      if (!res.ok) { setGenerateError(data.error ?? "Generation failed."); return; }
      setPageConfig(data.pageConfig as PageConfig);
      setGenerationsUsed((prev) => prev + 1);
      setSelectedSection("ai-sections");
    } finally { setGenerating(false); }
  }

  // ── Save pageConfig ──
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

  // ── Publish ──
  async function handlePublish() {
    setPublishError(null);
    if (!name.trim()) { setPublishError("Studio name is required."); return; }
    if (services.length === 0) { setPublishError("At least one service is required."); return; }
    if (!phone.trim() && !email.trim()) { setPublishError("Phone or email is required."); return; }
    const newState = !isPublished;
    const res = await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: newState }),
    });
    if (res.ok) setIsPublished(newState);
  }

  // ── PageConfig section helpers ──
  function updateSection(idx: number, patch: Partial<SectionConfig>) {
    if (!pageConfig) return;
    setPageConfig({ ...pageConfig, sections: pageConfig.sections.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  }
  function updateSectionContent(idx: number, key: string, val: string | boolean) {
    if (!pageConfig) return;
    updateSection(idx, { content: { ...pageConfig.sections[idx].content, [key]: val } });
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
    return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="-m-6 flex flex-col overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="h-14 flex items-center gap-3 px-4 border-b shrink-0" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <span className="text-sm font-bold text-foreground mr-1">Studio Page</span>

        {/* Template picker — hidden for CUSTOM */}
        {!isCustom && (
          <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1">
            {STYLES.map((s) => (
              <button key={s.id}
                onClick={() => setBaseStyle(s.id as typeof baseStyle)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: baseStyle === s.id ? "var(--accent)" : "transparent",
                  color: baseStyle === s.id ? "#0A0A0A" : "var(--muted-foreground)",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        {isCustom && (
          <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
            Custom Layout
          </span>
        )}

        <div className="flex-1" />

        {/* AI Generate */}
        {!isCustom && (
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
            {generating ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Wand2 size={12} /> Generate with AI</>}
          </button>
        )}

        {/* Usage counter */}
        {!isCustom && (
          <span className="text-xs font-semibold" style={{ color: atLimit ? "#EF4444" : "var(--muted-foreground)" }}>
            <Zap size={11} className="inline mr-0.5" />
            {atLimit ? "$1 per extra" : `${generationsLeft} of ${generationLimit} left`}
          </span>
        )}

        {/* Preview in new tab */}
        {slug && (
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline">
            <ExternalLink size={13} /> Preview
          </a>
        )}

        {/* Publish toggle */}
        <button onClick={handlePublish}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all"
          style={{
            backgroundColor: isPublished ? "transparent" : "var(--accent)",
            color: isPublished ? "var(--foreground)" : "#0A0A0A",
            border: isPublished ? "1px solid var(--border)" : "none",
          }}>
          {isPublished ? <><EyeOff size={12} /> Unpublish</> : <><Globe size={12} /> Publish</>}
        </button>
      </div>

      {/* ── Generate Error / Publish Error ─────────────────────── */}
      {(generateError || publishError) && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs shrink-0"
          style={{ backgroundColor: "#EF444418", color: "#EF4444", borderBottom: "1px solid #EF444430" }}>
          <AlertCircle size={13} /> {generateError || publishError}
          <button onClick={() => { setGenerateError(null); setPublishError(null); }} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── Split Screen ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Preview Iframe ────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "#111" }}>
          {/* Desktop / Mobile toggle */}
          <div className="flex items-center justify-center gap-2 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => setMobile(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ backgroundColor: !mobile ? "rgba(255,255,255,0.1)" : "transparent", color: !mobile ? "#fff" : "rgba(255,255,255,0.4)" }}>
              <Monitor size={13} /> Desktop
            </button>
            <button onClick={() => setMobile(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ backgroundColor: mobile ? "rgba(255,255,255,0.1)" : "transparent", color: mobile ? "#fff" : "rgba(255,255,255,0.4)" }}>
              <Smartphone size={13} /> Mobile
            </button>
          </div>

          {/* Iframe container */}
          <div className="flex-1 flex items-start justify-center overflow-auto py-4">
            <div style={{
              width: mobile ? "375px" : "100%",
              maxWidth: mobile ? "375px" : "100%",
              height: "100%",
              minHeight: "600px",
              transition: "width 0.3s ease",
              borderRadius: mobile ? "20px" : "0",
              overflow: "hidden",
              boxShadow: mobile ? "0 0 0 10px #222, 0 25px 60px rgba(0,0,0,0.8)" : "none",
            }}>
              <iframe
                ref={iframeRef}
                src="/studio/preview-frame"
                style={{ width: "100%", height: "100%", border: "none", display: "block", minHeight: "600px" }}
                title="Page Preview"
              />
            </div>
          </div>
        </div>

        {/* ── Right: Edit Panel ───────────────────────────────── */}
        <div className="w-80 flex flex-col border-l overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>

          {/* Section Navigator */}
          <div className="p-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>Sections</p>
            <div className="space-y-0.5">
              {EDITOR_SECTIONS.map((s) => (
                <button key={s.key} onClick={() => setSelectedSection(s.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium transition-all"
                  style={{
                    backgroundColor: selectedSection === s.key ? "rgba(212,168,67,0.1)" : "transparent",
                    color: selectedSection === s.key ? "var(--accent)" : "var(--muted-foreground)",
                  }}>
                  {s.label}
                </button>
              ))}
              {pageConfig && (
                <button onClick={() => setSelectedSection("ai-sections")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium transition-all"
                  style={{
                    backgroundColor: selectedSection === "ai-sections" ? "rgba(232,93,74,0.1)" : "transparent",
                    color: selectedSection === "ai-sections" ? "#E85D4A" : "var(--muted-foreground)",
                  }}>
                  <Wand2 size={13} /> AI Layout
                </button>
              )}
            </div>
          </div>

          {/* Section Editor */}
          <div className="flex-1 overflow-hidden">
            <SectionEditPanel
              sectionKey={selectedSection}
              saving={saving} saved={saved} onSave={handleSectionSave}
              name={name} setName={setName}
              tagline={tagline} setTagline={setTagline}
              heroImage={heroImage} setHeroImage={setHeroImage}
              logoUrl={logoUrl} setLogoUrl={setLogoUrl}
              services={services} setServices={setServices}
              gallery={gallery} setGallery={setGallery} galleryMax={galleryMax}
              bio={bio} setBio={setBio}
              hours={hours} setHours={setHours}
              hoursNote={hoursNote} setHoursNote={setHoursNote}
              streetAddress={streetAddress} setStreetAddress={setStreetAddress}
              city={city} setCity={setCity}
              state={stateVal} setState={setStateVal}
              zipCode={zipCode} setZipCode={setZipCode}
              phone={phone} setPhone={setPhone}
              email={email} setEmail={setEmail}
              instagram={instagram} setInstagram={setInstagram}
              tiktok={tiktok} setTiktok={setTiktok}
              facebook={facebook} setFacebook={setFacebook}
              twitter={twitter} setTwitter={setTwitter}
              youtube={youtube} setYoutube={setYoutube}
              accentColor={accentColor} setAccentColor={setAccentColor}
              pageConfig={pageConfig} setPageConfig={setPageConfig}
              updateSection={updateSection}
              updateSectionContent={updateSectionContent}
              moveSection={moveSection}
              savingConfig={savingConfig} configSaved={configSaved}
              handleSaveConfig={handleSaveConfig}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
