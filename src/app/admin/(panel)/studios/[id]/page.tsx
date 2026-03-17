"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ExternalLink, AlertTriangle, CheckCircle, Image as ImageIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioDetail = {
  id: string;
  name: string;
  slug: string | null;
  studioTier: string;
  tierOverride: string | null;
  isPublished: boolean;
  isEnterprise: boolean;
  createdAt: string;
  description: string | null;
  bio: string | null;
  tagline: string | null;
  address: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  facebook: string | null;
  template: string;
  accentColor: string | null;
  customDomain: string | null;
  stripePaymentsEnabled: boolean;
  generationsUsedThisMonth: number;
  services: string[];
  servicesJson: unknown;
  testimonials: string | null;
  galleryImages: unknown;
  owner: {
    id: string;
    name: string;
    email: string;
    lastLoginAt: string | null;
  };
  _count: {
    artists: number;
    sessions: number;
    contacts: number;
    emailCampaigns: number;
    intakeSubmissions: number;
    intakeLinks: number;
  };
  sessions: Array<{
    id: string;
    dateTime: string;
    status: string;
    paymentStatus: string;
    sessionType: string | null;
    contact: { name: string } | null;
  }>;
  emailCampaigns: Array<{
    id: string;
    subject: string;
    recipientCount: number;
    openCount: number;
    sentAt: string | null;
    createdAt: string;
  }>;
  contactSources: Record<string, number>;
  intakeSubmissions: Array<{
    id: string;
    artistName: string;
    genre: string | null;
    createdAt: string;
    convertedToBookingId: string | null;
    depositPaid: boolean;
  }>;
  intakeConversionRate: number;
};

type GalleryImage = { url?: string; src?: string; alt?: string; caption?: string };
type Testimonial = { name?: string; text?: string; body?: string; rating?: number };
type ServiceItem = { name?: string; title?: string; price?: number | string; duration?: number | string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined, showTime = false) {
  if (!d) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(showTime ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  return new Date(d).toLocaleDateString("en-US", opts);
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#FF9F0A",
  CONFIRMED: "#5AC8FA",
  COMPLETED: "#34C759",
  CANCELLED: "#E85D4A",
};

const CONTACT_SOURCE_LABEL: Record<string, string> = {
  INTAKE_FORM: "Intake Form",
  MANUAL: "Manual",
  INQUIRY: "Inquiry",
  BOOKING: "Booking",
  REFERRAL: "Referral",
  INSTAGRAM: "Instagram",
  WALK_IN: "Walk-in",
};

function parseGallery(raw: unknown): GalleryImage[] {
  try {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw as string);
    return arr as GalleryImage[];
  } catch { return []; }
}

function parseTestimonials(raw: string | null): Testimonial[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function parseServicesJson(raw: unknown): ServiceItem[] {
  try {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw as string);
    return arr as ServiceItem[];
  } catch { return []; }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, ok = true) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, ok });
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);
  return { toast, show };
}

// ─── Auto-save field components ───────────────────────────────────────────────

function AField({
  label,
  value,
  onSave,
  type = "text",
  multiline = false,
  placeholder = "",
  readOnly = false,
}: {
  label: string;
  value: string;
  onSave?: (v: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const handleBlur = () => {
    if (!readOnly && local !== value && onSave) onSave(local);
  };
  const base =
    "w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none focus:ring-1 focus:ring-accent/50" +
    (readOnly ? " opacity-60 cursor-default" : " bg-transparent");
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea
          value={local}
          readOnly={readOnly}
          onChange={(e) => !readOnly && setLocal(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          placeholder={placeholder}
          className={base + " resize-none"}
          style={{ borderColor: "var(--border)", backgroundColor: readOnly ? "rgba(255,255,255,0.03)" : "transparent" }}
        />
      ) : (
        <input
          type={type}
          value={local}
          readOnly={readOnly}
          onChange={(e) => !readOnly && setLocal(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={base}
          style={{ borderColor: "var(--border)", backgroundColor: readOnly ? "rgba(255,255,255,0.03)" : "transparent" }}
        />
      )}
    </div>
  );
}

function ASelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onSave: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function AToggle({
  label,
  description,
  checked,
  onSave,
  activeColor = "#34C759",
}: {
  label: string;
  description?: string;
  checked: boolean;
  onSave: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => onSave(!checked)}
        className="w-11 h-6 rounded-full transition-colors relative shrink-0"
        style={{ backgroundColor: checked ? activeColor : "rgba(255,255,255,0.1)" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, show: showToast } = useToast();
  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [unpublishing, setUnpublishing] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/studios/${id}`)
      .then((r) => r.json())
      .then((d: StudioDetail) => setStudio(d))
      .finally(() => setLoading(false));
  }, [id]);

  const save = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/studios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) showToast("Saved");
      else showToast("Save failed", false);
    },
    [id, showToast]
  );

  async function forceUnpublish() {
    if (!window.confirm("Force unpublish this studio's public page?")) return;
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/admin/studios/${id}/unpublish`, { method: "POST" });
      if (res.ok) {
        setStudio((s) => s ? { ...s, isPublished: false } : s);
        showToast("Studio unpublished");
      } else {
        showToast("Failed to unpublish", false);
      }
    } finally {
      setUnpublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studio) {
    return <div className="text-center py-24 text-muted-foreground text-sm">Studio not found.</div>;
  }

  const effectiveTier = studio.tierOverride ?? studio.studioTier;
  const tierColors: Record<string, string> = { PRO: "#D4A843", ELITE: "#34C759" };

  const totalCampaignRecipients = studio.emailCampaigns.reduce((s, c) => s + c.recipientCount, 0);
  const totalCampaignOpens = studio.emailCampaigns.reduce((s, c) => s + c.openCount, 0);
  const openRate = totalCampaignRecipients > 0
    ? Math.round((totalCampaignOpens / totalCampaignRecipients) * 100)
    : 0;

  const gallery = parseGallery(studio.galleryImages);
  const testimonials = parseTestimonials(studio.testimonials);
  const servicesJson = parseServicesJson(studio.servicesJson);
  const services = studio.services ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: toast.ok ? "#34C759" : "#E85D4A", color: "#fff" }}
        >
          {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/admin/studios")}
            className="mt-1 p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{studio.name}</h1>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ backgroundColor: `${tierColors[effectiveTier] ?? "#888"}18`, color: tierColors[effectiveTier] ?? "#888" }}
              >
                {effectiveTier}{studio.tierOverride ? " (override)" : ""}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{
                  backgroundColor: studio.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)",
                  color: studio.isPublished ? "#34C759" : "rgba(255,255,255,0.35)",
                }}
              >
                {studio.isPublished ? "Published" : "Draft"}
              </span>
              {studio.isEnterprise && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(90,200,250,0.12)", color: "#5AC8FA" }}>
                  Enterprise
                </span>
              )}
            </div>
            {studio.slug && (
              <p className="text-sm text-muted-foreground mt-0.5">/{studio.slug}</p>
            )}
          </div>
        </div>
        {studio.slug && (
          <a
            href={`/${studio.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <ExternalLink size={14} /> Public Page
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Artists", value: studio._count.artists },
          { label: "Bookings", value: studio._count.sessions },
          { label: "Contacts", value: studio._count.contacts },
          { label: "Email Blasts", value: studio._count.emailCampaigns },
          { label: "Intake Links", value: studio._count.intakeLinks },
          { label: "Submissions", value: studio._count.intakeSubmissions },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-3 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Studio Info */}
        <SectionCard title="Studio Info">
          <div className="space-y-3">
            <AField
              label="Studio Name"
              value={studio.name}
              onSave={(v) => { setStudio((s) => s ? { ...s, name: v } : s); save({ name: v }); }}
            />
            <AField
              label="Tagline"
              value={studio.tagline ?? ""}
              placeholder="One-line pitch"
              onSave={(v) => { setStudio((s) => s ? { ...s, tagline: v || null } : s); save({ tagline: v || null }); }}
            />
            <AField
              label="Description"
              value={studio.description ?? ""}
              multiline
              onSave={(v) => { setStudio((s) => s ? { ...s, description: v || null } : s); save({ description: v || null }); }}
            />
            <AField
              label="Bio"
              value={studio.bio ?? ""}
              multiline
              onSave={(v) => { setStudio((s) => s ? { ...s, bio: v || null } : s); save({ bio: v || null }); }}
            />
          </div>

          <div className="space-y-3 pt-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Location</p>
            <AField
              label="Street Address"
              value={studio.streetAddress ?? ""}
              onSave={(v) => { setStudio((s) => s ? { ...s, streetAddress: v || null } : s); save({ streetAddress: v || null }); }}
            />
            <div className="grid grid-cols-3 gap-2">
              <AField
                label="City"
                value={studio.city ?? ""}
                onSave={(v) => { setStudio((s) => s ? { ...s, city: v || null } : s); save({ city: v || null }); }}
              />
              <AField
                label="State"
                value={studio.state ?? ""}
                onSave={(v) => { setStudio((s) => s ? { ...s, state: v || null } : s); save({ state: v || null }); }}
              />
              <AField
                label="ZIP"
                value={studio.zipCode ?? ""}
                onSave={(v) => { setStudio((s) => s ? { ...s, zipCode: v || null } : s); save({ zipCode: v || null }); }}
              />
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Contact &amp; Socials</p>
            <div className="grid grid-cols-2 gap-2">
              <AField
                label="Phone"
                value={studio.phone ?? ""}
                type="tel"
                onSave={(v) => { setStudio((s) => s ? { ...s, phone: v || null } : s); save({ phone: v || null }); }}
              />
              <AField
                label="Email"
                value={studio.email ?? ""}
                type="email"
                onSave={(v) => { setStudio((s) => s ? { ...s, email: v || null } : s); save({ email: v || null }); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AField
                label="Instagram"
                value={studio.instagram ?? ""}
                placeholder="@handle"
                onSave={(v) => { setStudio((s) => s ? { ...s, instagram: v || null } : s); save({ instagram: v || null }); }}
              />
              <AField
                label="TikTok"
                value={studio.tiktok ?? ""}
                placeholder="@handle"
                onSave={(v) => { setStudio((s) => s ? { ...s, tiktok: v || null } : s); save({ tiktok: v || null }); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AField
                label="YouTube"
                value={studio.youtube ?? ""}
                placeholder="Channel URL"
                onSave={(v) => { setStudio((s) => s ? { ...s, youtube: v || null } : s); save({ youtube: v || null }); }}
              />
              <AField
                label="Facebook"
                value={studio.facebook ?? ""}
                placeholder="Page URL"
                onSave={(v) => { setStudio((s) => s ? { ...s, facebook: v || null } : s); save({ facebook: v || null }); }}
              />
            </div>
          </div>
        </SectionCard>

        {/* Right column */}
        <div className="space-y-5">
          {/* Admin Controls */}
          <SectionCard title="Admin Controls">
            <div className="space-y-4">
              <ASelect
                label="Base Tier"
                value={studio.studioTier}
                options={[
                  { value: "PRO", label: "Pro" },
                  { value: "ELITE", label: "Elite" },
                ]}
                onSave={(v) => { setStudio((s) => s ? { ...s, studioTier: v } : s); save({ studioTier: v }); }}
              />
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Tier Override <span className="normal-case font-normal">(overrides subscription tier)</span>
                </label>
                <select
                  value={studio.tierOverride ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setStudio((s) => s ? { ...s, tierOverride: v } : s);
                    save({ tierOverride: v });
                  }}
                  className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="">None (use base tier)</option>
                  <option value="PRO">Pro</option>
                  <option value="ELITE">Elite</option>
                </select>
              </div>
              <AToggle
                label="Published"
                description="Studio public page is visible to the world"
                checked={studio.isPublished}
                onSave={(v) => { setStudio((s) => s ? { ...s, isPublished: v } : s); save({ isPublished: v }); }}
              />
              <AToggle
                label="Enterprise"
                description="Unlocks enterprise-only features"
                checked={studio.isEnterprise}
                onSave={(v) => { setStudio((s) => s ? { ...s, isEnterprise: v } : s); save({ isEnterprise: v }); }}
                activeColor="#5AC8FA"
              />

              {/* Force Unpublish */}
              {studio.isPublished && (
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={forceUnpublish}
                    disabled={unpublishing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.25)" }}
                  >
                    {unpublishing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                    Force Unpublish
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Owner */}
          <SectionCard title="Owner">
            <div
              className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--border)" }}
              onClick={() => router.push(`/admin/users/${studio.owner.id}`)}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{studio.owner.name}</p>
                <p className="text-xs text-muted-foreground">{studio.owner.email}</p>
                <p className="text-xs text-muted-foreground">Last login: {fmt(studio.owner.lastLoginAt)}</p>
              </div>
              <ExternalLink size={14} className="text-muted-foreground" />
            </div>
          </SectionCard>

          {/* System Info */}
          <SectionCard title="System Info">
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                <p className="text-foreground">{fmt(studio.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Template</p>
                <p className="text-foreground">{studio.template}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI Gens (Month)</p>
                <p className="text-foreground">{studio.generationsUsedThisMonth}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stripe Payments</p>
                <p className="text-foreground">{studio.stripePaymentsEnabled ? "Enabled" : "Disabled"}</p>
              </div>
              {studio.customDomain && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Custom Domain</p>
                  <p className="text-foreground font-mono text-xs">{studio.customDomain}</p>
                </div>
              )}
              {studio.accentColor && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Accent Color</p>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: studio.accentColor, borderColor: "var(--border)" }} />
                    <p className="text-foreground font-mono text-xs">{studio.accentColor}</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Intake / Public Page Stats */}
      {studio._count.intakeSubmissions > 0 && (
        <SectionCard title={`Intake Submissions (${studio._count.intakeSubmissions} total · ${studio.intakeConversionRate}% converted)`}>
          <div className="space-y-2">
            {studio.intakeSubmissions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.artistName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.genre ?? "No genre"} · {fmt(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.convertedToBookingId ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>
                      Booked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      Pending
                    </span>
                  )}
                  {s.depositPaid && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                      Deposit Paid
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recent Bookings */}
      {studio.sessions.length > 0 && (
        <SectionCard title={`Recent Bookings (${studio._count.sessions} total)`}>
          <div className="space-y-2">
            {studio.sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.contact?.name ?? "Unknown Contact"}</p>
                  <p className="text-xs text-muted-foreground">{fmt(s.dateTime, true)} · {s.sessionType ?? "Session"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${STATUS_COLOR[s.status] ?? "#888"}18`, color: STATUS_COLOR[s.status] ?? "#888" }}
                  >
                    {s.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{s.paymentStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Email Campaigns */}
        {studio.emailCampaigns.length > 0 && (
          <SectionCard title={`Email Blasts (${studio._count.emailCampaigns} total · ${openRate}% avg open)`}>
            <div className="space-y-2">
              {studio.emailCampaigns.map((c) => (
                <div key={c.id} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate pr-4">{c.subject}</p>
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: c.sentAt ? "#34C759" : "#888" }}>
                      {c.sentAt ? "Sent" : "Draft"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmt(c.sentAt ?? c.createdAt)}
                    {c.recipientCount > 0 && ` · ${c.recipientCount} recipients · ${c.openCount} opens`}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Contact Sources */}
        {Object.keys(studio.contactSources).length > 0 && (
          <SectionCard title={`CRM Contact Sources (${studio._count.contacts} total)`}>
            <div className="space-y-2">
              {Object.entries(studio.contactSources)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => {
                  const total = studio._count.contacts;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={source} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{CONTACT_SOURCE_LABEL[source] ?? source}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Services (read-only) */}
      {(services.length > 0 || servicesJson.length > 0) && (
        <SectionCard title="Services (read-only)">
          {servicesJson.length > 0 ? (
            <div className="space-y-2">
              {servicesJson.map((svc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-sm text-foreground">{svc.name ?? svc.title ?? `Service ${i + 1}`}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {svc.duration && <span>{svc.duration}</span>}
                    {svc.price !== undefined && <span className="font-semibold text-foreground">${svc.price}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {services.map((svc, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                  {svc}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Gallery (read-only) */}
      {gallery.length > 0 && (
        <SectionCard title={`Gallery Photos (${gallery.length})`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gallery.map((img, i) => {
              const src = img.url ?? img.src;
              return (
                <div
                  key={i}
                  className="aspect-square rounded-xl overflow-hidden border relative"
                  style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={img.alt ?? img.caption ?? `Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <ImageIcon size={20} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Testimonials (read-only) */}
      {testimonials.length > 0 && (
        <SectionCard title={`Testimonials (${testimonials.length})`}>
          <div className="space-y-3">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border"
                style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                <p className="text-sm text-foreground italic leading-relaxed">
                  &ldquo;{t.text ?? t.body ?? "—"}&rdquo;
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs font-semibold text-muted-foreground">{t.name ?? "Anonymous"}</p>
                  {t.rating !== undefined && (
                    <p className="text-xs text-muted-foreground">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
