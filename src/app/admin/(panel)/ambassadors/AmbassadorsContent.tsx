"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, X, Star } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Ambassador = {
  id: string;
  name: string;
  email: string;
  tier: string;
  rewardType: string;
  rewardValue: number;
  creditBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  isActive: boolean;
  notes?: string | null;
  user?: { id: string; name: string; email: string } | null;
  _count: { promoCodes: number };
  createdAt: string;
};

const TIER_COLORS: Record<string, string> = {
  STANDARD:  "#9A9A9E",
  PREFERRED: "#D4A843",
  ELITE:     "#E85D4A",
};

const REWARD_LABELS: Record<string, string> = {
  FLAT_PER_SIGNUP:      "Flat / Signup",
  FLAT_PER_CONVERSION:  "Flat / Conversion",
  PERCENTAGE_FIRST:     "% First Payment",
  PERCENTAGE_RECURRING: "% Recurring",
  UPGRADE_BONUS:        "Upgrade Bonus",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AmbassadorsContent() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAmbassadors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(search && { search }),
    });
    try {
      const res = await fetch(`/api/admin/ambassadors?${params}`);
      const data = await res.json();
      setAmbassadors(data.ambassadors ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchAmbassadors(); }, [fetchAmbassadors]);

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/ambassadors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchAmbassadors();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Ambassadors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} ambassadors total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          <Plus size={16} />
          New Ambassador
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name or email…"
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", minWidth: 240 }}
        />
        <button
          onClick={fetchAmbassadors}
          className="p-2 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ambassador</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tier</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reward</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Codes</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Balance</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total Earned</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : ambassadors.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No ambassadors yet.</td></tr>
            ) : ambassadors.map((amb) => (
              <tr key={amb.id} className="border-t transition-colors hover:bg-card/50" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{amb.name}</p>
                  <p className="text-xs text-muted-foreground">{amb.email}</p>
                  {amb.user && <p className="text-xs" style={{ color: "#5AC8FA" }}>IndieThis user</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs font-bold" style={{ color: TIER_COLORS[amb.tier] ?? "#888" }}>
                    <Star size={12} fill="currentColor" />
                    {amb.tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {REWARD_LABELS[amb.rewardType] ?? amb.rewardType}
                  <br />
                  <span className="font-medium text-foreground">${amb.rewardValue.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 font-medium">{amb._count.promoCodes}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "#34D399" }}>${amb.creditBalance.toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">${amb.totalEarned.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: amb.isActive ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                      color: amb.isActive ? "#34D399" : "#f87171",
                    }}
                  >
                    {amb.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(amb.id, amb.isActive)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {amb.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "var(--border)" }}>← Prev</button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "var(--border)" }}>Next →</button>
        </div>
      )}

      {showCreate && <CreateAmbassadorModal onClose={() => setShowCreate(false)} onCreated={fetchAmbassadors} />}
    </div>
  );
}

// ── Create Ambassador Modal ───────────────────────────────────────────────────

function CreateAmbassadorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("STANDARD");
  const [rewardType, setRewardType] = useState("FLAT_PER_CONVERSION");
  const [rewardValue, setRewardValue] = useState("5.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, tier, rewardType, rewardValue: parseFloat(rewardValue), notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create ambassador."); return; }
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = "w-full rounded-lg px-3 py-2 text-sm border outline-none bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">New Ambassador</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className={inputStyle} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} placeholder="jane@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value)} className={inputStyle}>
                <option value="STANDARD">Standard</option>
                <option value="PREFERRED">Preferred</option>
                <option value="ELITE">Elite</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reward Type</label>
              <select value={rewardType} onChange={e => setRewardType(e.target.value)} className={inputStyle}>
                {Object.entries(REWARD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reward Value ($)</label>
            <input type="number" value={rewardValue} onChange={e => setRewardValue(e.target.value)} className={inputStyle} min={0} step={0.01} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (internal)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context, referral source…" className={inputStyle} />
          </div>

          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80" style={{ borderColor: "var(--border)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
              {loading ? "Creating…" : "Create Ambassador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
