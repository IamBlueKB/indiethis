"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, ExternalLink } from "lucide-react";

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
};

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 resize-none"
          style={{ borderColor: "var(--border)" }}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
          style={{ borderColor: "var(--border)" }}
        />
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  activeColor = "#34C759",
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black disabled:opacity-50 transition-colors"
      style={{ backgroundColor: "#D4A843" }}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      Save
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable state — info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bio, setBio] = useState("");
  const [tagline, setTagline] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // Editable state — admin controls
  const [studioTier, setStudioTier] = useState("");
  const [tierOverride, setTierOverride] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [savingControls, setSavingControls] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/studios/${id}`)
      .then((r) => r.json())
      .then((d: StudioDetail) => {
        setStudio(d);
        setName(d.name ?? "");
        setDescription(d.description ?? "");
        setBio(d.bio ?? "");
        setTagline(d.tagline ?? "");
        setStreetAddress(d.streetAddress ?? "");
        setCity(d.city ?? "");
        setState(d.state ?? "");
        setZipCode(d.zipCode ?? "");
        setPhone(d.phone ?? "");
        setEmail(d.email ?? "");
        setInstagram(d.instagram ?? "");
        setStudioTier(d.studioTier);
        setTierOverride(d.tierOverride ?? "");
        setIsPublished(d.isPublished);
        setIsEnterprise(d.isEnterprise);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/studios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function saveInfo() {
    setSavingInfo(true);
    try {
      await patch({
        name,
        description: description || null,
        bio: bio || null,
        tagline: tagline || null,
        streetAddress: streetAddress || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        phone: phone || null,
        email: email || null,
        instagram: instagram || null,
      });
      setStudio((s) => s ? { ...s, name, description: description || null, bio: bio || null, tagline: tagline || null } : s);
    } finally { setSavingInfo(false); }
  }

  async function saveControls() {
    setSavingControls(true);
    try {
      await patch({
        studioTier: studioTier || undefined,
        tierOverride: tierOverride || null,
        isPublished,
        isEnterprise,
      });
      setStudio((s) => s ? { ...s, studioTier, tierOverride: tierOverride || null, isPublished, isEnterprise } : s);
    } finally { setSavingControls(false); }
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
  const openRate = studio._count.emailCampaigns > 0
    ? Math.round((studio.emailCampaigns.reduce((s, c) => s + c.openCount, 0) / Math.max(studio.emailCampaigns.reduce((s, c) => s + c.recipientCount, 0), 1)) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
                style={{ backgroundColor: studio.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)", color: studio.isPublished ? "#34C759" : "rgba(255,255,255,0.35)" }}
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
              <p className="text-sm text-muted-foreground mt-0.5 ml-0">
                /{studio.slug}
              </p>
            )}
          </div>
        </div>
        {studio.slug && (
          <a
            href={`/${studio.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <ExternalLink size={14} /> Public Page
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Artists", value: studio._count.artists },
          { label: "Bookings", value: studio._count.sessions },
          { label: "CRM Contacts", value: studio._count.contacts },
          { label: "Email Blasts", value: studio._count.emailCampaigns },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Studio Info */}
        <SectionCard title="Studio Info">
          <div className="space-y-3">
            <Field label="Studio Name" value={name} onChange={setName} />
            <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="One-line pitch" />
            <Field label="Description" value={description} onChange={setDescription} multiline />
            <Field label="Bio" value={bio} onChange={setBio} multiline />
          </div>
          <div className="space-y-3 pt-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Location</p>
            <Field label="Street Address" value={streetAddress} onChange={setStreetAddress} />
            <div className="grid grid-cols-3 gap-2">
              <Field label="City" value={city} onChange={setCity} />
              <Field label="State" value={state} onChange={setState} />
              <Field label="ZIP" value={zipCode} onChange={setZipCode} />
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Contact</p>
            <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Instagram" value={instagram} onChange={setInstagram} />
          </div>
          <div className="flex justify-end">
            <SaveButton onClick={saveInfo} saving={savingInfo} />
          </div>
        </SectionCard>

        {/* Right column */}
        <div className="space-y-5">
          {/* Admin Controls */}
          <SectionCard title="Admin Controls">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Base Tier</label>
                <select
                  value={studioTier}
                  onChange={(e) => setStudioTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="PRO">Pro</option>
                  <option value="ELITE">Elite</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Tier Override <span className="normal-case font-normal">(overrides subscription tier)</span>
                </label>
                <select
                  value={tierOverride}
                  onChange={(e) => setTierOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="">None (use base tier)</option>
                  <option value="PRO">Pro</option>
                  <option value="ELITE">Elite</option>
                </select>
              </div>
              <Toggle
                label="Published"
                description="Studio public page is visible to the world"
                checked={isPublished}
                onChange={setIsPublished}
              />
              <Toggle
                label="Enterprise"
                description="Unlocks enterprise-only features"
                checked={isEnterprise}
                onChange={setIsEnterprise}
                activeColor="#5AC8FA"
              />
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={saveControls} saving={savingControls} />
            </div>
          </SectionCard>

          {/* Owner */}
          <SectionCard title="Owner">
            <div
              className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-white/3 transition-colors"
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

      {/* Recent Bookings */}
      {studio.sessions.length > 0 && (
        <SectionCard title={`Recent Bookings (${studio._count.sessions} total)`}>
          <div className="space-y-2">
            {studio.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.contact?.name ?? "Unknown Contact"}</p>
                  <p className="text-xs text-muted-foreground">{fmt(s.dateTime, true)} · {s.sessionType ?? "Session"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLOR[s.status] ?? "#888"}18`, color: STATUS_COLOR[s.status] ?? "#888" }}>
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
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
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
    </div>
  );
}
