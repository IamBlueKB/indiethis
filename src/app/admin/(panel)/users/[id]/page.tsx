"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  MonitorSmartphone,
  ExternalLink,
  CheckCircle,
  Ban,
  Gift,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  photo: string | null;
  bio: string | null;
  artistName: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  youtubeChannel: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isComped: boolean;
  compExpiresAt: string | null;
  isSuspended: boolean;
  subscription: {
    id: string;
    tier: string;
    status: string;
    createdAt: string;
    canceledAt: string | null;
    cancelReason: string | null;
    currentPeriodEnd: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  _count: { sessions: number; aiGenerations: number; tracks: number; receipts: number };
  sessions: Array<{
    id: string;
    dateTime: string;
    status: string;
    paymentStatus: string;
    sessionType: string | null;
    studio: { name: string; slug: string };
  }>;
  aiGenerations: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  receipts: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    createdAt: string;
  }>;
  artistSite: {
    id: string;
    template: string;
    isPublished: boolean;
    customDomain: string | null;
    showMusic: boolean;
    showVideos: boolean;
    showMerch: boolean;
  } | null;
  ownedStudios: Array<{
    id: string;
    name: string;
    slug: string;
    studioTier: string;
    tierOverride: string | null;
    isPublished: boolean;
    createdAt: string;
    _count: { artists: number; sessions: number; contacts: number };
  }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined, showTime = false) {
  if (!d) return "—";
  const date = new Date(d);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(showTime ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  return date.toLocaleDateString("en-US", opts);
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#FF9F0A",
  CONFIRMED: "#5AC8FA",
  COMPLETED: "#34C759",
  CANCELLED: "#E85D4A",
  ACTIVE: "#34C759",
  PAST_DUE: "#FF9F0A",
  CANCELLED_SUB: "#E85D4A",
};

const TIER_COLOR: Record<string, string> = {
  LAUNCH: "#888",
  PUSH: "#D4A843",
  REIGN: "#34C759",
};

const AI_TYPE_LABEL: Record<string, string> = {
  VIDEO: "AI Video",
  COVER_ART: "Cover Art",
  MASTERING: "Mastering",
  LYRIC_VIDEO: "Lyric Video",
  AAR_REPORT: "AAR Report",
  PRESS_KIT: "Press Kit",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 resize-none"
          style={{ borderColor: "var(--border)" }}
        />
      ) : (
        <input
          type={type}
          value={value}
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

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable state — profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [artistName, setArtistName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [spotify, setSpotify] = useState("");
  const [appleMusic, setAppleMusic] = useState("");
  const [youtube, setYoutube] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable state — account
  const [role, setRole] = useState("");
  const [isSuspended, setIsSuspended] = useState(false);
  const [isComped, setIsComped] = useState(false);
  const [compExpiry, setCompExpiry] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  // Editable state — subscription
  const [subTier, setSubTier] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  // Impersonation
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d: UserDetail) => {
        setUser(d);
        setName(d.name ?? "");
        setEmail(d.email ?? "");
        setBio(d.bio ?? "");
        setArtistName(d.artistName ?? "");
        setInstagram(d.instagramHandle ?? "");
        setTiktok(d.tiktokHandle ?? "");
        setSpotify(d.spotifyUrl ?? "");
        setAppleMusic(d.appleMusicUrl ?? "");
        setYoutube(d.youtubeChannel ?? "");
        setRole(d.role);
        setIsSuspended(d.isSuspended);
        setIsComped(d.isComped);
        setCompExpiry(d.compExpiresAt ? d.compExpiresAt.slice(0, 10) : "");
        setSubTier(d.subscription?.tier ?? "");
        setSubStatus(d.subscription?.status ?? "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await patch({ name, email, bio: bio || null, artistName: artistName || null, instagramHandle: instagram || null, tiktokHandle: tiktok || null, spotifyUrl: spotify || null, appleMusicUrl: appleMusic || null, youtubeChannel: youtube || null });
      setUser((u) => u ? { ...u, name, email, bio: bio || null, artistName: artistName || null } : u);
    } finally { setSavingProfile(false); }
  }

  async function saveAccount() {
    setSavingAccount(true);
    try {
      await patch({ role, isSuspended, isComped, compExpiresAt: isComped && compExpiry ? compExpiry : null });
      setUser((u) => u ? { ...u, role, isSuspended, isComped, compExpiresAt: isComped && compExpiry ? compExpiry : null } : u);
    } finally { setSavingAccount(false); }
  }

  async function saveSub() {
    setSavingSub(true);
    try {
      await patch({ subscriptionTier: subTier || undefined, subscriptionStatus: subStatus || undefined });
      setUser((u) => u && u.subscription ? { ...u, subscription: { ...u.subscription, tier: subTier, status: subStatus } } : u);
    } finally { setSavingSub(false); }
  }

  async function handleImpersonate() {
    setImpersonating(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: "POST" });
      if (res.ok) {
        const { token } = await res.json() as { token: string };
        window.open(`/api/admin/impersonate/start?t=${encodeURIComponent(token)}`, "_blank");
      }
    } finally { setImpersonating(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-24 text-muted-foreground text-sm">User not found.</div>
    );
  }

  const totalRevenue = user.receipts.reduce((s, r) => s + r.amount, 0);
  const effectiveRole = user.role;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/admin/users")}
            className="mt-1 p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              {user.isComped && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>
                  COMPED
                </span>
              )}
              {user.isSuspended && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>
                  SUSPENDED
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 ml-14">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleImpersonate}
          disabled={impersonating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {impersonating ? <Loader2 size={14} className="animate-spin" /> : <MonitorSmartphone size={14} />}
          Impersonate
          <ExternalLink size={11} className="text-muted-foreground" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Bookings", value: user._count.sessions },
          { label: "AI Gens", value: user._count.aiGenerations },
          { label: "Tracks", value: user._count.tracks },
          { label: "Total Revenue", value: `$${totalRevenue.toFixed(0)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile */}
        <SectionCard title="Profile">
          <div className="space-y-3">
            <Field label="Full Name" value={name} onChange={setName} />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Artist Name" value={artistName} onChange={setArtistName} />
            <Field label="Bio" value={bio} onChange={setBio} multiline />
          </div>
          <div className="space-y-3 pt-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Social Links</p>
            <Field label="Instagram" value={instagram} onChange={setInstagram} />
            <Field label="TikTok" value={tiktok} onChange={setTiktok} />
            <Field label="Spotify URL" value={spotify} onChange={setSpotify} />
            <Field label="Apple Music URL" value={appleMusic} onChange={setAppleMusic} />
            <Field label="YouTube Channel" value={youtube} onChange={setYoutube} />
          </div>
          <div className="flex justify-end">
            <SaveButton onClick={saveProfile} saving={savingProfile} />
          </div>
        </SectionCard>

        {/* Account Controls */}
        <div className="space-y-5">
          <SectionCard title="Account Controls">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="ARTIST">Artist</option>
                  <option value="STUDIO_ADMIN">Studio Admin</option>
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
                </select>
              </div>
              <Toggle
                label="Suspended"
                description="Prevents login and access to all features"
                checked={isSuspended}
                onChange={setIsSuspended}
                activeColor="#E85D4A"
              />
              <Toggle
                label="Comped Subscription"
                description="Full tier access without Stripe charges"
                checked={isComped}
                onChange={setIsComped}
              />
              {isComped && (
                <div className="space-y-1 pl-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Comp Expiry (leave blank for permanent)
                  </label>
                  <input
                    type="date"
                    value={compExpiry}
                    onChange={(e) => setCompExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={saveAccount} saving={savingAccount} />
            </div>
          </SectionCard>

          {/* Subscription */}
          <SectionCard title="Subscription">
            {user.subscription ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1">Since</p>
                    <p className="text-foreground">{fmt(user.subscription.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1">Renews</p>
                    <p className="text-foreground">{fmt(user.subscription.currentPeriodEnd)}</p>
                  </div>
                  {user.subscription.canceledAt && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider mb-1">Canceled</p>
                      <p className="text-foreground">{fmt(user.subscription.canceledAt)}</p>
                      {user.subscription.cancelReason && (
                        <p className="text-muted-foreground italic">&quot;{user.subscription.cancelReason}&quot;</p>
                      )}
                    </div>
                  )}
                  {user.subscription.stripeSubscriptionId && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider mb-1">Stripe ID</p>
                      <p className="font-mono text-[10px] text-muted-foreground break-all">{user.subscription.stripeSubscriptionId}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Tier Override</label>
                  <select
                    value={subTier}
                    onChange={(e) => setSubTier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                  >
                    <option value="LAUNCH">Launch</option>
                    <option value="PUSH">Push</option>
                    <option value="REIGN">Reign</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status Override</label>
                  <select
                    value={subStatus}
                    onChange={(e) => setSubStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PAST_DUE">Past Due</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <SaveButton onClick={saveSub} saving={savingSub} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription on record.</p>
            )}
          </SectionCard>

          {/* Account info */}
          <SectionCard title="Account Info">
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Joined</p>
                <p className="text-foreground">{fmt(user.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Login</p>
                <p className="text-foreground">{fmt(user.lastLoginAt)}</p>
              </div>
              {user.stripeCustomerId && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stripe Customer</p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">{user.stripeCustomerId}</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Recent Bookings */}
      {user.sessions.length > 0 && (
        <SectionCard title={`Recent Bookings (${user._count.sessions} total)`}>
          <div className="space-y-2">
            {user.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.studio.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(s.dateTime, true)} · {s.sessionType ?? "Session"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLOR[s.status] ?? "#888"}18`, color: STATUS_COLOR[s.status] ?? "#888" }}>
                    {s.status}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">{s.paymentStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* AI Usage */}
      {user.aiGenerations.length > 0 && (
        <SectionCard title={`AI Tool Usage (${user._count.aiGenerations} total)`}>
          <div className="space-y-2">
            {user.aiGenerations.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{AI_TYPE_LABEL[g.type] ?? g.type}</p>
                  <p className="text-xs text-muted-foreground">{fmt(g.createdAt)}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLOR[g.status] ?? "#888"}18`, color: STATUS_COLOR[g.status] ?? "#888" }}>
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Payment History */}
      {user.receipts.length > 0 && (
        <SectionCard title={`Payment History (${user._count.receipts} total)`}>
          <div className="space-y-2">
            {user.receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{r.description}</p>
                  <p className="text-xs text-muted-foreground">{r.type} · {fmt(r.createdAt)}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: "#34C759" }}>${r.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Artist Site (if ARTIST) */}
      {(effectiveRole === "ARTIST" || user.artistSite) && user.artistSite && (
        <SectionCard title="Artist Site">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--background)" }}>
              <p className="text-xs font-semibold text-foreground">{user.artistSite.template}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Template</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--background)" }}>
              <div className="flex items-center justify-center">
                {user.artistSite.isPublished
                  ? <CheckCircle size={16} style={{ color: "#34C759" }} />
                  : <Ban size={16} style={{ color: "#888" }} />}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{user.artistSite.isPublished ? "Published" : "Draft"}</p>
            </div>
            {user.artistSite.customDomain && (
              <div className="col-span-2 rounded-xl p-3" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Custom Domain</p>
                <p className="text-xs text-foreground">{user.artistSite.customDomain}</p>
              </div>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            {[
              { label: "Music", on: user.artistSite.showMusic },
              { label: "Videos", on: user.artistSite.showVideos },
              { label: "Merch", on: user.artistSite.showMerch },
            ].map((f) => (
              <span key={f.label} className="flex items-center gap-1" style={{ color: f.on ? "var(--foreground)" : "var(--muted-foreground)" }}>
                {f.on ? <CheckCircle size={11} style={{ color: "#34C759" }} /> : <Ban size={11} />}
                {f.label}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Owned Studios (if STUDIO_ADMIN) */}
      {user.ownedStudios.length > 0 && (
        <SectionCard title="Owned Studios">
          <div className="space-y-3">
            {user.ownedStudios.map((s) => {
              const effectiveTier = s.tierOverride ?? s.studioTier;
              const tierColors: Record<string, string> = { PRO: "#D4A843", ELITE: "#34C759" };
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-white/3 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => router.push(`/admin/studios/${s.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${tierColors[effectiveTier] ?? "#888"}18`, color: tierColors[effectiveTier] ?? "#888" }}>
                        {effectiveTier}
                        {s.tierOverride ? "*" : ""}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: s.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)", color: s.isPublished ? "#34C759" : "rgba(255,255,255,0.35)" }}>
                        {s.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">/{s.slug}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground text-right">
                    <span>{s._count.artists} artists</span>
                    <span>{s._count.sessions} bookings</span>
                    <span>{s._count.contacts} contacts</span>
                    <Gift size={13} className="text-muted-foreground" style={{ color: "var(--accent)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
