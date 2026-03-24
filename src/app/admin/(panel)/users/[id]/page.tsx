"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MonitorSmartphone,
  ExternalLink,
  CheckCircle,
  Ban,
  Calendar,
  Zap,
  DollarSign,
  Music,
  ShoppingBag,
  Globe,
  ChevronRight,
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
    id: string; tier: string; status: string;
    createdAt: string; canceledAt: string | null; cancelReason: string | null;
    currentPeriodEnd: string | null; stripeSubscriptionId: string | null;
    smsBroadcastsUsed: number;
  } | null;
  smsLimit: number;
  _count: { sessions: number; aiGenerations: number; tracks: number; receipts: number; merchProducts: number; producerLicenses: number };
  sessions: Array<{ id: string; dateTime: string; status: string; paymentStatus: string; sessionType: string | null; studio: { id: string; name: string; slug: string } }>;
  aiGenerations: Array<{ id: string; type: string; status: string; createdAt: string }>;
  receipts: Array<{ id: string; type: string; description: string; amount: number; createdAt: string }>;
  artistSite: { id: string; template: string; isPublished: boolean; draftMode: boolean; customDomain: string | null; showMusic: boolean; showVideos: boolean; showMerch: boolean; showContact: boolean; followGateEnabled: boolean } | null;
  tracks: Array<{ id: string; title: string; status: string; plays: number; downloads: number; earnings: number; createdAt: string }>;
  merchProducts: Array<{ id: string; title: string; productType: string; basePrice: number; isActive: boolean; _count: { orders: number } }>;
  ownedStudios: Array<{ id: string; name: string; slug: string; studioTier: string; tierOverride: string | null; isPublished: boolean; createdAt: string; _count: { artists: number; sessions: number; contacts: number; emailCampaigns: number } }>;
  artistLicenses: Array<{ id: string; licenseType: string; price: number; status: string; createdAt: string; track: { title: string } }>;
  aiBreakdown: Array<{ type: string; _count: { type: number } }>;
  beatLicenses: Array<{ id: string; licenseType: string; price: number; createdAt: string; track: { title: string } }>;
  totalBeatLicenses: number;
  totalMerchOrders: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_LABEL: Record<string, string> = {
  VIDEO: "AI Video", COVER_ART: "Cover Art", MASTERING: "Mastering",
  LYRIC_VIDEO: "Lyric Video", AAR_REPORT: "AAR Report", PRESS_KIT: "Press Kit",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#FF9F0A", CONFIRMED: "#5AC8FA", COMPLETED: "#34C759", CANCELLED: "#E85D4A",
  ACTIVE: "#34C759", PAST_DUE: "#FF9F0A", QUEUED: "#888", PROCESSING: "#5AC8FA", FAILED: "#E85D4A",
};
const TIER_COLOR: Record<string, string> = { LAUNCH: "#888", PUSH: "#D4A843", REIGN: "#34C759" };

function fmt(d: string | null | undefined, time = false) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  });
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

function Toast({ toast }: { toast: { msg: string; ok: boolean } | null }) {
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white animate-in fade-in slide-in-from-bottom-2"
      style={{ backgroundColor: toast.ok ? "#34C759" : "#E85D4A" }}
    >
      {toast.ok ? <CheckCircle size={14} /> : <Ban size={14} />}
      {toast.msg}
    </div>
  );
}

// ─── Auto-save field components ───────────────────────────────────────────────

function AField({
  label, value, onChange, onSave, type = "text", multiline = false, mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void; onSave: (v: string) => void;
  type?: string; multiline?: boolean; mono?: boolean;
}) {
  const baseClass = `w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/40 ${mono ? "font-mono text-xs" : ""}`;
  const style = { borderColor: "var(--border)" };
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onSave(e.target.value)}
          rows={3} className={`${baseClass} resize-none`} style={style} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onSave(e.target.value)} className={baseClass} style={style} />
      )}
    </div>
  );
}

function ASelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: Array<{ v: string; l: string }>; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border text-sm text-foreground outline-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function AToggle({
  label, description, checked, onChange, activeColor = "#34C759",
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; activeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className="w-11 h-6 rounded-full transition-colors relative shrink-0"
        style={{ backgroundColor: checked ? activeColor : "rgba(255,255,255,0.1)" }}>
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }} />
      </button>
    </div>
  );
}

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      {title && <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>}
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, show: showToast } = useToast();

  // Profile
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [bio, setBio] = useState(""); const [artistName, setArtistName] = useState("");
  const [instagram, setInstagram] = useState(""); const [tiktok, setTiktok] = useState("");
  const [spotify, setSpotify] = useState(""); const [appleMusic, setAppleMusic] = useState("");
  const [youtube, setYoutube] = useState("");

  // Account
  const [role, setRole] = useState(""); const [isSuspended, setIsSuspended] = useState(false);
  const [isComped, setIsComped] = useState(false); const [compExpiry, setCompExpiry] = useState("");

  // Subscription
  const [subTier, setSubTier] = useState(""); const [subStatus, setSubStatus] = useState("");

  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d: UserDetail) => {
        setUser(d);
        setName(d.name ?? ""); setEmail(d.email ?? ""); setBio(d.bio ?? "");
        setArtistName(d.artistName ?? ""); setInstagram(d.instagramHandle ?? "");
        setTiktok(d.tiktokHandle ?? ""); setSpotify(d.spotifyUrl ?? "");
        setAppleMusic(d.appleMusicUrl ?? ""); setYoutube(d.youtubeChannel ?? "");
        setRole(d.role); setIsSuspended(d.isSuspended); setIsComped(d.isComped);
        setCompExpiry(d.compExpiresAt ? d.compExpiresAt.slice(0, 10) : "");
        setSubTier(d.subscription?.tier ?? ""); setSubStatus(d.subscription?.status ?? "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const save = useCallback(async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) showToast("Saved");
      else showToast("Save failed", false);
    } catch { showToast("Save failed", false); }
  }, [id, showToast]);

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

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  if (!user) return <div className="text-center py-24 text-muted-foreground text-sm">User not found.</div>;

  // Build activity timeline
  const timeline = [
    ...user.sessions.map((s) => ({ id: s.id, date: s.dateTime, kind: "booking" as const, label: `Session at ${s.studio.name}`, detail: s.sessionType ?? "Recording", status: s.status, studioId: s.studio.id })),
    ...user.aiGenerations.map((g) => ({ id: g.id, date: g.createdAt, kind: "ai" as const, label: AI_LABEL[g.type] ?? g.type, detail: "AI Tool", status: g.status, studioId: undefined })),
    ...user.receipts.map((r) => ({ id: r.id, date: r.createdAt, kind: "payment" as const, label: r.description, detail: `$${r.amount.toFixed(2)}`, status: "PAID", studioId: undefined })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);

  const totalRevenue = user.receipts.reduce((s, r) => s + r.amount, 0);
  const totalAiCount = user.aiBreakdown.reduce((s, b) => s + b._count.type, 0);
  const totalTrackEarnings = user.tracks.reduce((s, t) => s + t.earnings, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push("/admin/users")} className="mt-1 p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                {user.name[0]?.toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(90,200,250,0.12)", color: "#5AC8FA" }}>
                {user.role === "STUDIO_ADMIN" ? "STUDIO" : user.role}
              </span>
              {user.subscription && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${TIER_COLOR[user.subscription.tier] ?? "#888"}18`, color: TIER_COLOR[user.subscription.tier] ?? "#888" }}>
                  {user.subscription.tier}
                </span>
              )}
              {user.isComped && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>COMPED</span>}
              {user.isSuspended && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>SUSPENDED</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-1 ml-[52px]">{user.email} · joined {fmt(user.createdAt)} · last login {fmt(user.lastLoginAt)}</p>
          </div>
        </div>
        <button onClick={handleImpersonate} disabled={impersonating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 shrink-0"
          style={{ borderColor: "var(--border)" }}>
          {impersonating ? <Loader2 size={14} className="animate-spin" /> : <MonitorSmartphone size={14} />}
          Impersonate <ExternalLink size={11} className="text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Bookings", value: user._count.sessions },
          { label: "AI Tools Used", value: user._count.aiGenerations },
          { label: "Total Revenue", value: `$${totalRevenue.toFixed(0)}` },
          { label: "Tracks", value: user._count.tracks },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile */}
        <div className="space-y-5">
          <Card title="Profile">
            <div className="space-y-3">
              <AField label="Full Name" value={name} onChange={setName} onSave={(v) => save({ name: v || null })} />
              <AField label="Email" value={email} onChange={setEmail} onSave={(v) => save({ email: v || null })} type="email" />
              <AField label="Artist Name" value={artistName} onChange={setArtistName} onSave={(v) => save({ artistName: v || null })} />
              <AField label="Bio" value={bio} onChange={setBio} onSave={(v) => save({ bio: v || null })} multiline />
            </div>
          </Card>
          <Card title="Social Links">
            <div className="space-y-3">
              <AField label="Instagram" value={instagram} onChange={setInstagram} onSave={(v) => save({ instagramHandle: v || null })} />
              <AField label="TikTok" value={tiktok} onChange={setTiktok} onSave={(v) => save({ tiktokHandle: v || null })} />
              <AField label="Spotify URL" value={spotify} onChange={setSpotify} onSave={(v) => save({ spotifyUrl: v || null })} />
              <AField label="Apple Music URL" value={appleMusic} onChange={setAppleMusic} onSave={(v) => save({ appleMusicUrl: v || null })} />
              <AField label="YouTube Channel" value={youtube} onChange={setYoutube} onSave={(v) => save({ youtubeChannel: v || null })} />
            </div>
          </Card>
        </div>

        {/* Controls column */}
        <div className="space-y-5">
          <Card title="Account Controls">
            <div className="space-y-3">
              <ASelect label="Role" value={role} onChange={(v) => { setRole(v); save({ role: v }); }}
                options={[{ v: "ARTIST", l: "Artist" }, { v: "STUDIO_ADMIN", l: "Studio Admin" }, { v: "PLATFORM_ADMIN", l: "Platform Admin" }]} />
              <AToggle label="Suspended" description="Blocks login and all platform access"
                checked={isSuspended} onChange={(v) => { setIsSuspended(v); save({ isSuspended: v }); }} activeColor="#E85D4A" />
              <AToggle label="Comped Subscription" description="Full tier access, Stripe does not charge"
                checked={isComped} onChange={(v) => { setIsComped(v); save({ isComped: v, compExpiresAt: isComped && compExpiry ? compExpiry : null }); }} />
              {isComped && (
                <div className="pl-1">
                  <AField label="Comp Expiry (blank = permanent)" value={compExpiry} onChange={setCompExpiry}
                    onSave={(v) => save({ isComped: true, compExpiresAt: v || null })} type="date" />
                </div>
              )}
            </div>
          </Card>

          <Card title="Subscription">
            {user.subscription ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs mb-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Since</p>
                    <p className="text-foreground">{fmt(user.subscription.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Renews</p>
                    <p className="text-foreground">{fmt(user.subscription.currentPeriodEnd)}</p>
                  </div>
                  {user.subscription.canceledAt && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Canceled {fmt(user.subscription.canceledAt)}</p>
                      {user.subscription.cancelReason && <p className="text-muted-foreground italic text-xs">&quot;{user.subscription.cancelReason}&quot;</p>}
                    </div>
                  )}
                  {user.subscription.stripeSubscriptionId && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stripe ID</p>
                      <p className="font-mono text-[10px] text-muted-foreground break-all">{user.subscription.stripeSubscriptionId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">SMS Broadcasts</p>
                  <p className="text-sm text-foreground">
                    {user.subscription.smsBroadcastsUsed} / {user.smsLimit} this billing cycle
                  </p>
                </div>
                <ASelect label="Tier Override" value={subTier} onChange={(v) => { setSubTier(v); save({ subscriptionTier: v }); }}
                  options={[{ v: "LAUNCH", l: "Launch" }, { v: "PUSH", l: "Push" }, { v: "REIGN", l: "Reign" }]} />
                <ASelect label="Status Override" value={subStatus} onChange={(v) => { setSubStatus(v); save({ subscriptionStatus: v }); }}
                  options={[{ v: "ACTIVE", l: "Active" }, { v: "PAST_DUE", l: "Past Due" }, { v: "CANCELLED", l: "Cancelled" }]} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription on record.</p>
            )}
          </Card>

          <Card title="Account Info">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Joined</p><p className="text-foreground">{fmt(user.createdAt)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Login</p><p className="text-foreground">{fmt(user.lastLoginAt)}</p></div>
              {user.stripeCustomerId && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stripe Customer</p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">{user.stripeCustomerId}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Activity Timeline */}
      {timeline.length > 0 && (
        <Card title={`Activity Timeline · ${timeline.length} recent events`}>
          <div className="space-y-0">
            {timeline.map((ev, i) => {
              const isBooking = ev.kind === "booking";
              const isAi = ev.kind === "ai";
              const isPay = ev.kind === "payment";
              const color = isBooking ? "#5AC8FA" : isAi ? "#BF5AF2" : "#34C759";
              const Icon = isBooking ? Calendar : isAi ? Zap : DollarSign;
              return (
                <div key={ev.id} className="flex items-start gap-3 py-3 relative">
                  {i < timeline.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-px" style={{ backgroundColor: "var(--border)" }} />
                  )}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10" style={{ backgroundColor: `${color}18` }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{ev.label}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPay && <span className="text-sm font-bold" style={{ color: "#34C759" }}>{ev.detail}</span>}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${STATUS_COLOR[ev.status] ?? "#888"}18`, color: STATUS_COLOR[ev.status] ?? "#888" }}>
                          {ev.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(ev.date, true)}{!isPay && ` · ${ev.detail}`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Usage Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Breakdown */}
        {user.aiBreakdown.length > 0 && (
          <Card title={`AI Tool Usage · ${totalAiCount} total`}>
            <div className="space-y-3">
              {user.aiBreakdown.map((b) => {
                const pct = totalAiCount > 0 ? Math.round((b._count.type / totalAiCount) * 100) : 0;
                return (
                  <div key={b.type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">{AI_LABEL[b.type] ?? b.type}</span>
                      <span className="text-muted-foreground">{b._count.type} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#BF5AF2" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Receipts by type */}
        {user.receipts.length > 0 && (
          <Card title={`Payments · ${user._count.receipts} total · $${totalRevenue.toFixed(0)}`}>
            <div className="space-y-2">
              {user.receipts.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{r.description}</p>
                    <p className="text-xs text-muted-foreground">{r.type} · {fmt(r.createdAt)}</p>
                  </div>
                  <p className="text-sm font-bold ml-3 shrink-0" style={{ color: "#34C759" }}>${r.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Artist Section */}
      {(user.role === "ARTIST" || user.artistSite || user.tracks.length > 0) && (
        <Card title="Artist Activity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Artist site */}
            {user.artistSite && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mini-Site</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: user.artistSite.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)", color: user.artistSite.isPublished ? "#34C759" : "rgba(255,255,255,0.4)" }}>
                    {user.artistSite.isPublished ? "Published" : "Draft"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                    {user.artistSite.template}
                  </span>
                  {user.artistSite.customDomain && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                      <Globe size={9} /> {user.artistSite.customDomain}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {[
                    { l: "Music", on: user.artistSite.showMusic },
                    { l: "Videos", on: user.artistSite.showVideos },
                    { l: "Merch", on: user.artistSite.showMerch },
                    { l: "Contact", on: user.artistSite.showContact },
                  ].map((f) => (
                    <span key={f.l} className="flex items-center gap-1" style={{ color: f.on ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {f.on ? <CheckCircle size={10} style={{ color: "#34C759" }} /> : <Ban size={10} />} {f.l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tracks */}
            {user.tracks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracks ({user._count.tracks} total · ${totalTrackEarnings.toFixed(0)} earned)</p>
                {user.tracks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Music size={11} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{t.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>{t.status}</span>
                    </div>
                    <span className="text-muted-foreground ml-2 shrink-0">{t.plays} plays</span>
                  </div>
                ))}
              </div>
            )}

            {/* Merch */}
            {user.merchProducts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Merch ({user._count.merchProducts} products · {user.totalMerchOrders} orders)</p>
                {user.merchProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag size={11} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{p.title}</span>
                      {!p.isActive && <span className="text-[9px] text-muted-foreground">(inactive)</span>}
                    </div>
                    <span className="text-muted-foreground">{p._count.orders} orders · ${p.basePrice.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Beat licenses purchased */}
            {user.beatLicenses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beat Licenses ({user.totalBeatLicenses} purchased)</p>
                {user.beatLicenses.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs py-1">
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{l.track.title}</p>
                      <p className="text-muted-foreground">{l.licenseType} · {fmt(l.createdAt)}</p>
                    </div>
                    <span className="font-bold ml-2 shrink-0" style={{ color: "#34C759" }}>${l.price.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Studio Owner Section */}
      {user.ownedStudios.length > 0 && (
        <Card title="Owned Studios">
          <div className="space-y-3">
            {user.ownedStudios.map((s) => {
              const tier = s.tierOverride ?? s.studioTier;
              const tc: Record<string, string> = { PRO: "#D4A843", ELITE: "#34C759" };
              return (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-white/3 transition-colors"
                  style={{ borderColor: "var(--border)" }} onClick={() => router.push(`/admin/studios/${s.id}`)}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${tc[tier] ?? "#888"}18`, color: tc[tier] ?? "#888" }}>
                        {tier}{s.tierOverride ? "*" : ""}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: s.isPublished ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)", color: s.isPublished ? "#34C759" : "rgba(255,255,255,0.35)" }}>
                        {s.isPublished ? "Live" : "Draft"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">/{s.slug}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{s._count.artists} artists</span>
                    <span>{s._count.sessions} bookings</span>
                    <span>{s._count.contacts} contacts</span>
                    <span>{s._count.emailCampaigns} blasts</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
