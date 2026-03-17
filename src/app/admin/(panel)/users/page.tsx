"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  subscription: { tier: string; status: string } | null;
  _count: { sessions: number };
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

  // Debounce search
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

  const filterChanged = () => { setPage(1); };

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
        {/* Search */}
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

        {/* Role filter */}
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); filterChanged(); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Roles</option>
          <option value="ARTIST">Artist</option>
          <option value="STUDIO_ADMIN">Studio</option>
          <option value="PLATFORM_ADMIN">Admin</option>
        </select>

        {/* Tier filter */}
        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); filterChanged(); }}
          className="px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <option value="">All Tiers</option>
          <option value="LAUNCH">Launch</option>
          <option value="PUSH">Push</option>
          <option value="REIGN">Reign</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); filterChanged(); }}
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
        {/* Header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 140px 90px 80px 100px 80px" }}
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
              style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 140px 90px 80px 100px 80px" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
                >
                  {u.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
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
