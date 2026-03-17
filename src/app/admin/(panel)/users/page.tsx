"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  User,
  Gift,
  MonitorSmartphone,
  Ban,
  CheckCircle,
  X,
  ExternalLink,
} from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  isComped: boolean;
  compExpiresAt: string | null;
  isSuspended: boolean;
  subscription: { tier: string; status: string } | null;
  _count: { sessions: number };
};

type UserDetail = UserRow & {
  bio: string | null;
  artistName: string | null;
  photo: string | null;
  subscription: {
    tier: string;
    status: string;
    createdAt: string;
    canceledAt: string | null;
    cancelReason: string | null;
    currentPeriodEnd: string | null;
  } | null;
  _count: { sessions: number; aiGenerations: number; tracks: number };
  ownedStudios: Array<{ id: string; name: string; slug: string; studioTier: string }>;
};

type ApiResponse = {
  users: UserRow[];
  total: number;
  pages: number;
  page: number;
};

const ROLE_COLOR: Record<string, string> = {
  ARTIST: "#5AC8FA",
  STUDIO_ADMIN: "#D4A843",
  PLATFORM_ADMIN: "#E85D4A",
};

const TIER_COLOR: Record<string, string> = {
  LAUNCH: "#888",
  PUSH: "#D4A843",
  REIGN: "#34C759",
};

type SortField = "name" | "email" | "joined" | "lastLogin" | "sessions";

// ─── User Detail Modal ────────────────────────────────────────────────────────

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d) => setUser(d as UserDetail))
      .finally(() => setLoading(false));
  }, [userId]);

  function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold text-foreground">User Profile</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        {loading || !user ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{user.name}</p>
                {user.artistName && <p className="text-xs text-muted-foreground">aka {user.artistName}</p>}
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${ROLE_COLOR[user.role]}18`, color: ROLE_COLOR[user.role] }}>
                {user.role === "STUDIO_ADMIN" ? "STUDIO" : user.role}
              </span>
              {user.isComped && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>
                  COMPED{user.compExpiresAt ? ` · expires ${fmt(user.compExpiresAt)}` : " · permanent"}
                </span>
              )}
              {user.isSuspended && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>
                  SUSPENDED
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Sessions", value: user._count.sessions },
                { label: "AI Gens", value: user._count.aiGenerations },
                { label: "Tracks", value: user._count.tracks },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--background)" }}>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Subscription */}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--background)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</p>
              {user.subscription ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-medium">{user.subscription.tier}</span>
                    <span className="text-xs" style={{ color: user.subscription.status === "ACTIVE" ? "#34C759" : "#E85D4A" }}>
                      {user.subscription.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Since {fmt(user.subscription.createdAt)}</p>
                  {user.subscription.canceledAt && (
                    <p className="text-xs text-muted-foreground">
                      Canceled {fmt(user.subscription.canceledAt)}
                      {user.subscription.cancelReason && ` · "${user.subscription.cancelReason}"`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No subscription</p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Joined</p>
                <p className="text-sm text-foreground">{fmt(user.createdAt)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Login</p>
                <p className="text-sm text-foreground">{fmt(user.lastLoginAt)}</p>
              </div>
            </div>

            {/* Studios */}
            {user.ownedStudios.length > 0 && (
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owned Studios</p>
                {user.ownedStudios.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">/{s.slug} · {s.studioTier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Comp Modal ────────────────────────────────────────────────────────────────

function CompModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: (updated: Partial<UserRow>) => void;
}) {
  const [enabled, setEnabled] = useState(user.isComped);
  const [permanent, setPermanent] = useState(!user.compExpiresAt);
  const [expiresAt, setExpiresAt] = useState(
    user.compExpiresAt ? user.compExpiresAt.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/comp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, expiresAt: permanent ? null : expiresAt || null }),
      });
      if (res.ok) {
        const data = await res.json() as { isComped: boolean; compExpiresAt: string | null };
        onDone({ isComped: data.isComped, compExpiresAt: data.compExpiresAt });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-2xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold text-foreground">Comp Subscription</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            Comped users keep their tier features without being charged by Stripe.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Comp enabled</span>
            <button
              onClick={() => setEnabled((v) => !v)}
              className="w-11 h-6 rounded-full transition-colors relative"
              style={{ backgroundColor: enabled ? "#34C759" : "rgba(255,255,255,0.1)" }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
                style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPermanent(true)}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: permanent ? "#E85D4A" : "var(--muted-foreground)" }}
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: permanent ? "#E85D4A" : "var(--border)" }}>
                    {permanent && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#E85D4A" }} />}
                  </div>
                  Permanent
                </button>
                <button
                  onClick={() => setPermanent(false)}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: !permanent ? "#E85D4A" : "var(--muted-foreground)" }}
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: !permanent ? "#E85D4A" : "var(--border)" }}>
                    {!permanent && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#E85D4A" }} />}
                  </div>
                  Set expiry
                </button>
              </div>
              {!permanent && (
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#34C759" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Actions Dropdown ─────────────────────────────────────────────────────────

function UserActions({
  user,
  onRefresh,
}: {
  user: UserRow;
  onRefresh: (updated: Partial<UserRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"detail" | "comp" | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSuspend() {
    setSuspending(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: !user.isSuspended }),
      });
      if (res.ok) {
        const data = await res.json() as { isSuspended: boolean };
        onRefresh({ isSuspended: data.isSuspended });
      }
    } finally {
      setSuspending(false);
    }
  }

  async function handleImpersonate() {
    setImpersonating(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: "POST" });
      if (res.ok) {
        const { token } = await res.json() as { token: string };
        window.open(`/api/admin/impersonate/start?t=${encodeURIComponent(token)}`, "_blank");
      }
    } finally {
      setImpersonating(false);
    }
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {suspending || impersonating ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <MoreHorizontal size={15} />
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1 w-48 rounded-xl border shadow-xl z-30 py-1"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setModal("detail"); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
            >
              <User size={14} className="text-muted-foreground" /> View Profile
            </button>
            <button
              onClick={() => { setModal("comp"); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
            >
              <Gift size={14} className="text-muted-foreground" />
              {user.isComped ? "Edit Comp" : "Comp Subscription"}
            </button>
            <button
              onClick={handleImpersonate}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
            >
              <MonitorSmartphone size={14} className="text-muted-foreground" /> Impersonate
              <ExternalLink size={11} className="text-muted-foreground ml-auto" />
            </button>
            <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
            <button
              onClick={handleSuspend}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm hover:bg-white/5 transition-colors"
              style={{ color: user.isSuspended ? "#34C759" : "#E85D4A" }}
            >
              {user.isSuspended ? (
                <><CheckCircle size={14} /> Unsuspend</>
              ) : (
                <><Ban size={14} /> Suspend</>
              )}
            </button>
          </div>
        )}
      </div>

      {modal === "detail" && (
        <UserDetailModal userId={user.id} onClose={() => setModal(null)} />
      )}
      {modal === "comp" && (
        <CompModal
          user={user}
          onClose={() => setModal(null)}
          onDone={(updated) => { onRefresh(updated); setModal(null); }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortField>("joined");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        role,
        tier,
        status,
        sort,
        order,
        page: String(page),
        limit: "50",
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) setData(await res.json() as ApiResponse);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, role, tier, status, sort, order, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function toggleSort(field: SortField) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(field); setOrder("desc"); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ChevronDown size={12} className="opacity-25" />;
    return order === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }

  function updateUser(id: string, patch: Partial<UserRow>) {
    setData((prev) =>
      prev
        ? { ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
        : prev
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} users` : "Loading…"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Roles</option>
          <option value="ARTIST">Artist</option>
          <option value="STUDIO_ADMIN">Studio</option>
          <option value="PLATFORM_ADMIN">Admin</option>
        </select>
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Tiers</option>
          <option value="LAUNCH">Launch</option>
          <option value="PUSH">Push</option>
          <option value="REIGN">Reign</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 140px 90px 80px 100px 80px 40px" }}
        >
          <button className="flex items-center gap-1 hover:text-foreground transition-colors text-left" onClick={() => toggleSort("name")}>
            User <SortIcon field="name" />
          </button>
          <span>Role</span>
          <span>Plan</span>
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("sessions")}>
            Sessions <SortIcon field="sessions" />
          </button>
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("lastLogin")}>
            Last Login <SortIcon field="lastLogin" />
          </button>
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("joined")}>
            Joined <SortIcon field="joined" />
          </button>
          <span />
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : !data?.users.length ? (
          <div className="py-12 text-center">
            <Users size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No users found.</p>
          </div>
        ) : (
          data.users.map((u) => (
            <div
              key={u.id}
              className="grid items-center px-5 py-3.5 border-b last:border-b-0"
              style={{
                borderColor: "var(--border)",
                gridTemplateColumns: "1fr 140px 90px 80px 100px 80px 40px",
                opacity: u.isSuspended ? 0.6 : 1,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
                >
                  {u.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    {u.isComped && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>
                        COMPED
                      </span>
                    )}
                    {u.isSuspended && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>
                        SUSPENDED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full w-fit"
                style={{ backgroundColor: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role] }}
              >
                {u.role === "STUDIO_ADMIN" ? "STUDIO" : u.role}
              </span>
              <div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: u.subscription ? (TIER_COLOR[u.subscription.tier] ?? "#888") : "#555" }}
                >
                  {u.subscription?.tier ?? "—"}
                </span>
                {u.subscription?.status === "CANCELLED" && (
                  <span className="text-[10px] text-muted-foreground block">canceled</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{u._count.sessions}</span>
              <span className="text-xs text-muted-foreground">{formatDate(u.lastLoginAt)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
              <UserActions user={u} onRefresh={(patch) => updateUser(u.id, patch)} />
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground text-xs">
            Page {data.page} of {data.pages} · {data.total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
