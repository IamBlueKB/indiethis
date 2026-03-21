"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, X, Check, Copy, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PromoCode = {
  id: string;
  code: string;
  type: string;
  tier?: string | null;
  value?: number | null;
  durationDays?: number | null;
  durationMonths?: number | null;
  maxRedemptions: number;
  currentRedemptions: number;
  conversionCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  notes?: string | null;
  ambassador?: { id: string; name: string; email: string } | null;
  createdAt: string;
};

type Redemption = {
  id: string;
  user: { name: string; email: string } | null;
  redeemedAt: string;
  status: string;
  convertedAt?: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  FREE_TRIAL: "#5AC8FA",
  DISCOUNT:   "#D4A843",
  COMP:       "#A78BFA",
  CREDIT:     "#34D399",
  AI_BUNDLE:  "#FB923C",
};

const TYPE_LABELS: Record<string, string> = {
  FREE_TRIAL: "Free Trial",
  DISCOUNT:   "Discount",
  COMP:       "Comp",
  CREDIT:     "Credit",
  AI_BUNDLE:  "AI Bundle",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "#34D399",
  CONVERTED: "#D4A843",
  EXPIRED:   "#f87171",
  REVOKED:   "#9A9A9E",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PromoCodesContent() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Record<string, Redemption[]>>({});
  const [loadingRedemptions, setLoadingRedemptions] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(search && { search }),
      ...(typeFilter && { type: typeFilter }),
      ...(statusFilter && { status: statusFilter }),
    });
    try {
      const res = await fetch(`/api/admin/promo-codes?${params}`);
      const data = await res.json();
      setCodes(data.codes ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchCodes();
  }

  async function copyCode(code: string, id: string) {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!redemptions[id]) {
      setLoadingRedemptions(id);
      try {
        const res = await fetch(`/api/admin/promo-codes/${id}/redemptions?limit=20`);
        const data = await res.json();
        setRedemptions((prev) => ({ ...prev, [id]: data.redemptions ?? [] }));
      } finally {
        setLoadingRedemptions(null);
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Promo Codes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} codes total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          <Plus size={16} />
          New Code
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search codes…"
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", minWidth: 200 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={fetchCodes}
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
              <th className="w-8 px-4 py-3" />
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Benefit</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Redemptions</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Expires</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No promo codes found.</td></tr>
            ) : codes.map((code) => (
              <>
                <tr
                  key={code.id}
                  className="border-t transition-colors hover:bg-card/50 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => toggleExpand(code.id)}
                >
                  {/* Expand chevron */}
                  <td className="px-4 py-3">
                    <ChevronDown
                      size={15}
                      className="text-muted-foreground transition-transform"
                      style={{ transform: expandedId === code.id ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold tracking-wider">{code.code}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyCode(code.code, code.id); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === code.id ? <Check size={14} style={{ color: "#34D399" }} /> : <Copy size={14} />}
                      </button>
                    </div>
                    {code.ambassador && (
                      <p className="text-xs text-muted-foreground mt-0.5">via {code.ambassador.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${TYPE_COLORS[code.type] ?? "#888"}22`, color: TYPE_COLORS[code.type] ?? "#888" }}
                    >
                      {TYPE_LABELS[code.type] ?? code.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {code.type === "FREE_TRIAL" && code.tier && `${code.durationDays}d ${code.tier}`}
                    {code.type === "DISCOUNT" && `${code.value}% off × ${code.durationMonths}mo`}
                    {code.type === "COMP" && code.tier && `Comp ${code.tier}`}
                    {code.type === "CREDIT" && `$${code.value?.toFixed(2)} credit`}
                    {code.type === "AI_BUNDLE" && "AI Credits Bundle"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{code.currentRedemptions}</span>
                    <span className="text-muted-foreground">/{code.maxRedemptions}</span>
                    {code.conversionCount > 0 && (
                      <span className="ml-2 text-xs" style={{ color: "#34D399" }}>{code.conversionCount} converted</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "No expiry"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: code.isActive ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                        color: code.isActive ? "#34D399" : "#f87171",
                      }}
                    >
                      {code.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleActive(code.id, code.isActive)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {code.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>

                {/* Expanded redemptions sub-table */}
                {expandedId === code.id && (
                  <tr key={`${code.id}-expanded`} style={{ borderColor: "var(--border)" }} className="border-t">
                    <td colSpan={8} className="px-8 py-4" style={{ backgroundColor: "var(--background)" }}>
                      {loadingRedemptions === code.id ? (
                        <p className="text-xs text-muted-foreground py-2">Loading redemptions…</p>
                      ) : !redemptions[code.id] || redemptions[code.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No redemptions yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1.5 pr-6">User</th>
                              <th className="text-left py-1.5 pr-6">Redeemed</th>
                              <th className="text-left py-1.5 pr-6">Status</th>
                              <th className="text-left py-1.5">Converted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {redemptions[code.id].map((r) => (
                              <tr key={r.id}>
                                <td className="py-1.5 pr-6">
                                  <p className="font-medium">{r.user?.name ?? "—"}</p>
                                  <p className="text-muted-foreground">{r.user?.email ?? "—"}</p>
                                </td>
                                <td className="py-1.5 pr-6 text-muted-foreground">
                                  {new Date(r.redeemedAt).toLocaleDateString()}
                                </td>
                                <td className="py-1.5 pr-6">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                                    style={{ color: STATUS_COLORS[r.status] ?? "#888", backgroundColor: `${STATUS_COLORS[r.status] ?? "#888"}22` }}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-1.5 text-muted-foreground">
                                  {r.convertedAt ? new Date(r.convertedAt).toLocaleDateString() : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
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

      {/* Create modal */}
      {showCreate && <CreateCodeModal onClose={() => setShowCreate(false)} onCreated={fetchCodes} />}
    </div>
  );
}

// ── Create Code Modal ─────────────────────────────────────────────────────────

function CreateCodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState("FREE_TRIAL");
  const [code, setCode] = useState("");
  const [tier, setTier] = useState("PUSH");
  const [value, setValue] = useState("");
  const [durationDays, setDurationDays] = useState("14");
  const [durationMonths, setDurationMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  // AI Bundle fields
  const [bundleArt, setBundleArt] = useState("10");
  const [bundleMaster, setBundleMaster] = useState("3");
  const [bundleVideo, setBundleVideo] = useState("1");
  const [bundleLyric, setBundleLyric] = useState("1");
  const [bundleAar, setBundleAar] = useState("0");
  const [bundlePress, setBundlePress] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body: Record<string, unknown> = {
      type,
      maxRedemptions: parseInt(maxRedemptions),
      notes: notes || undefined,
      expiresAt: expiresAt || undefined,
    };
    if (code.trim()) body.code = code.trim();
    if (type === "FREE_TRIAL") { body.tier = tier; body.durationDays = parseInt(durationDays); }
    if (type === "COMP") { body.tier = tier; }
    if (type === "DISCOUNT") { body.value = parseFloat(value); body.durationMonths = parseInt(durationMonths); }
    if (type === "CREDIT") { body.value = parseFloat(value); }
    if (type === "AI_BUNDLE") {
      body.metadata = {
        ...(parseInt(bundleArt)    > 0 ? { art:    parseInt(bundleArt)    } : {}),
        ...(parseInt(bundleMaster) > 0 ? { master: parseInt(bundleMaster) } : {}),
        ...(parseInt(bundleVideo)  > 0 ? { video:  parseInt(bundleVideo)  } : {}),
        ...(parseInt(bundleLyric)  > 0 ? { lyric:  parseInt(bundleLyric)  } : {}),
        ...(parseInt(bundleAar)    > 0 ? { aar:    parseInt(bundleAar)    } : {}),
        ...(parseInt(bundlePress)  > 0 ? { press:  parseInt(bundlePress)  } : {}),
      };
    }

    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create code."); return; }
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = "w-full rounded-lg px-3 py-2 text-sm border outline-none bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]";
  const numInputStyle = "rounded-lg px-2 py-1.5 text-sm border outline-none bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] w-20 text-right";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl border p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">New Promo Code</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Code (blank = auto)</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="AUTO-GENERATED" className={inputStyle} maxLength={20} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputStyle}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Type-conditional fields */}
          {(type === "FREE_TRIAL" || type === "COMP") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</label>
                <select value={tier} onChange={e => setTier(e.target.value)} className={inputStyle}>
                  <option value="LAUNCH">Launch</option>
                  <option value="PUSH">Push</option>
                  <option value="REIGN">Reign</option>
                </select>
              </div>
              {type === "FREE_TRIAL" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration (days)</label>
                  <input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} className={inputStyle} min={1} />
                </div>
              )}
            </div>
          )}

          {type === "DISCOUNT" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount %</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} className={inputStyle} min={1} max={100} placeholder="20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration (months)</label>
                <input type="number" value={durationMonths} onChange={e => setDurationMonths(e.target.value)} className={inputStyle} min={1} />
              </div>
            </div>
          )}

          {type === "CREDIT" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dollar Amount</label>
              <input type="number" value={value} onChange={e => setValue(e.target.value)} className={inputStyle} min={0} step={0.01} placeholder="10.00" />
            </div>
          )}

          {type === "AI_BUNDLE" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Credits per Tool</label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {([
                  ["Art Credits",     bundleArt,    setBundleArt],
                  ["Master Credits",  bundleMaster, setBundleMaster],
                  ["Video Credits",   bundleVideo,  setBundleVideo],
                  ["Lyric Video",     bundleLyric,  setBundleLyric],
                  ["AAR Reports",     bundleAar,    setBundleAar],
                  ["Press Kits",      bundlePress,  setBundlePress],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <input
                      type="number"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      className={numInputStyle}
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Redemptions</label>
              <input type="number" value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value)} className={inputStyle} min={1} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires At</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputStyle} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (internal)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Who is this for? Campaign name…" className={inputStyle} />
          </div>

          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:opacity-80" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {loading ? "Creating…" : "Create Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
