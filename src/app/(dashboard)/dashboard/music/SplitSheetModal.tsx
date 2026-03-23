"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Loader2, Users, Copy, Check, Search, UserCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type SplitEntry = {
  id?: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  percentage: number;
  agreedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

type SplitSheetData = {
  id: string;
  status: "PENDING" | "ACTIVE" | "DISPUTED" | "EXPIRED";
  splits: SplitEntry[];
  track: { id: string; title: string };
};

type UserResult = { id: string; name: string; email: string };

const ROLES = ["ARTIST", "PRODUCER", "SONGWRITER", "ENGINEER", "COMPOSER", "VOCALIST", "FEATURED", "OTHER"] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:  { bg: "rgba(212,168,67,0.12)",  color: "#D4A843", label: "Pending" },
  ACTIVE:   { bg: "rgba(52,199,89,0.12)",   color: "#34C759", label: "Active" },
  DISPUTED: { bg: "rgba(232,93,74,0.12)",   color: "#E85D4A", label: "Disputed" },
  EXPIRED:  { bg: "rgba(120,120,120,0.12)", color: "#888",    label: "Expired" },
};

// ── Contributor row ─────────────────────────────────────────────────────────

function ContributorRow({
  entry,
  index,
  onChange,
  onRemove,
  currentUserId,
  isCreating,
}: {
  entry: SplitEntry;
  index: number;
  onChange: (i: number, field: keyof SplitEntry, value: string | number) => void;
  onRemove: (i: number) => void;
  currentUserId: string;
  isCreating: boolean;
}) {
  const [query, setQuery] = useState(entry.name || "");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelf = entry.userId === currentUserId;

  function handleSearch(q: string) {
    setQuery(q);
    onChange(index, "name", q);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (q.length < 2) { setResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/dashboard/splits/user-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.users ?? []);
      } finally { setSearching(false); }
    }, 300);
  }

  function selectUser(u: UserResult) {
    onChange(index, "userId", u.id);
    onChange(index, "name", u.name);
    onChange(index, "email", u.email);
    setQuery(u.name);
    setResults([]);
  }

  return (
    <div
      className="rounded-xl border p-3 space-y-2.5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contributor {index + 1}{isSelf ? " (you)" : ""}
        </span>
        {!isSelf && isCreating && (
          <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-foreground">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Name / search */}
        <div className="relative">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Name or search user"
              disabled={isSelf || !isCreating}
              className="w-full rounded-lg border pl-7 pr-2.5 py-2 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            />
            {searching && <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {results.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                >
                  <UserCircle size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email */}
        <input
          value={entry.email}
          onChange={(e) => onChange(index, "email", e.target.value)}
          placeholder="Email"
          type="email"
          disabled={isSelf || !isCreating}
          className="rounded-lg border px-2.5 py-2 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Role */}
        <select
          value={entry.role}
          onChange={(e) => onChange(index, "role", e.target.value)}
          disabled={!isCreating}
          className="rounded-lg border px-2.5 py-2 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Percentage */}
        <div className="relative">
          <input
            value={entry.percentage}
            onChange={(e) => onChange(index, "percentage", parseFloat(e.target.value) || 0)}
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={!isCreating}
            className="w-full rounded-lg border px-2.5 py-2 pr-7 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">%</span>
        </div>
      </div>

      {/* Status pill (view mode) */}
      {!isCreating && (
        <div className="flex items-center gap-1.5">
          {entry.agreedAt
            ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>✓ Agreed</span>
            : entry.rejectedAt
              ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>✗ Rejected{entry.rejectionReason ? ` — ${entry.rejectionReason}` : ""}</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>⏳ Pending</span>
          }
        </div>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function SplitSheetModal({
  trackId,
  trackTitle,
  currentUserId,
  currentUserName,
  currentUserEmail,
  onClose,
}: {
  trackId: string;
  trackTitle: string;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SplitSheetData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load existing sheet
  useEffect(() => {
    fetch("/api/dashboard/splits")
      .then((r) => r.json())
      .then((d) => {
        const all = [...(d.created ?? []), ...(d.participating ?? [])];
        const found = all.find((s: SplitSheetData) => s.track.id === trackId);
        setSheet(found ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [trackId]);

  function startCreate() {
    setSplits([
      { userId: currentUserId, name: currentUserName, email: currentUserEmail, role: "ARTIST", percentage: 100 },
    ]);
    setIsCreating(true);
  }

  function startEdit() {
    if (!sheet) return;
    setSplits(sheet.splits.map((s) => ({ ...s })));
    setIsCreating(true);
  }

  function addContributor() {
    setSplits((prev) => [...prev, { name: "", email: "", role: "ARTIST", percentage: 0 }]);
  }

  function removeContributor(i: number) {
    setSplits((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSplit(i: number, field: keyof SplitEntry, value: string | number) {
    setSplits((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  const total = splits.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);

  async function handleSave() {
    if (Math.abs(total - 100) > 0.01) return;
    setSaving(true);
    try {
      let res: Response;
      if (sheet && sheet.status !== "EXPIRED") {
        // PATCH existing
        res = await fetch(`/api/dashboard/splits/${sheet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ splits }),
        });
      } else {
        // POST new
        res = await fetch("/api/dashboard/splits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId, splits }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        setSheet(data.sheet);
        setIsCreating(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!sheet) return;
    setCancelling(true);
    try {
      await fetch(`/api/dashboard/splits/${sheet.id}`, { method: "DELETE" });
      setSheet(null);
      setIsCreating(false);
    } finally {
      setCancelling(false);
    }
  }

  function copyLink(reviewToken: string) {
    const url = `${window.location.origin}/splits/review/${reviewToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(reviewToken);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const statusStyle = sheet ? STATUS_STYLES[sheet.status] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: "#D4A843" }} />
            <div>
              <p className="font-bold text-sm">Split Sheet</p>
              <p className="text-[11px] text-muted-foreground truncate max-w-xs">{trackTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sheet && statusStyle && (
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
              >
                {statusStyle.label}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : isCreating ? (
            /* ── Create / Edit form ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  Contributors ({splits.length})
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: Math.abs(total - 100) <= 0.01 ? "#34C759" : "#E85D4A" }}
                  >
                    {total.toFixed(1)}% total
                  </span>
                  {Math.abs(total - 100) > 0.01 && (
                    <span className="text-[10px] text-muted-foreground">must equal 100%</span>
                  )}
                </div>
              </div>

              {splits.map((s, i) => (
                <ContributorRow
                  key={i}
                  entry={s}
                  index={i}
                  onChange={updateSplit}
                  onRemove={removeContributor}
                  currentUserId={currentUserId}
                  isCreating={isCreating}
                />
              ))}

              <button
                onClick={addContributor}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
                style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
              >
                <Plus size={12} /> Add Contributor
              </button>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || Math.abs(total - 100) > 0.01}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : sheet ? "Update & Re-send Invites" : "Create & Send Invites"}
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                  style={{ backgroundColor: "var(--border)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : sheet ? (
            /* ── View existing sheet ── */
            <div className="space-y-3">
              <div className="space-y-2">
                {sheet.splits.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border p-3 flex items-center gap-3"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold" style={{ color: "#D4A843" }}>{s.percentage}%</p>
                      <p className="text-[10px] text-muted-foreground">{s.role}</p>
                    </div>
                    <div className="shrink-0">
                      {s.agreedAt
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>✓ Agreed</span>
                        : s.rejectedAt
                          ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>✗ Rejected</span>
                          : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>⏳ Pending</span>
                      }
                    </div>
                    {/* Copy review link (for non-user contributors) */}
                    {!s.userId && s.id && (
                      <button
                        onClick={() => copyLink((s as SplitEntry & { reviewToken?: string }).reviewToken ?? "")}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
                        title="Copy review link"
                      >
                        {copied === (s as SplitEntry & { reviewToken?: string }).reviewToken ? <Check size={12} style={{ color: "#34C759" }} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              {sheet.status === "PENDING" && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={startEdit}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                  >
                    Edit Splits
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                    style={{ backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A" }}
                  >
                    {cancelling ? <Loader2 size={12} className="animate-spin" /> : "Cancel Sheet"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── No sheet yet ── */
            <div className="text-center py-8 space-y-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
              >
                <Users size={24} style={{ color: "#D4A843" }} />
              </div>
              <div>
                <p className="font-bold">No Split Sheet Yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create a split sheet to share earnings from this track with collaborators.</p>
              </div>
              <button
                onClick={startCreate}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <Plus size={14} /> Create Split Sheet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
