"use client";

import { useEffect, useState } from "react";
import {
  Zap, ToggleLeft, ToggleRight, Pencil, X, Loader2, CheckCircle2,
  ShoppingBag, Heart, Star, DollarSign, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Automation = {
  id:          string | null;
  triggerType: string;
  label:       string;
  description: string;
  isActive:    boolean;
  subject:     string;
  body:        string;
  updatedAt:   string | null;
};

// ─── Trigger meta ─────────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  FIRST_PURCHASE: { icon: ShoppingBag, color: "#34C759", bg: "rgba(52,199,89,0.10)"   },
  FIRST_TIP:      { icon: Heart,       color: "#AF52DE", bg: "rgba(175,82,222,0.10)"  },
  REPEAT_BUYER:   { icon: Star,        color: "#D4A843", bg: "rgba(212,168,67,0.10)"  },
  BIG_TIPPER:     { icon: DollarSign,  color: "#5AC8FA", bg: "rgba(90,200,250,0.10)"  },
  ANNIVERSARY:    { icon: Calendar,    color: "#E85D4A", bg: "rgba(232,93,74,0.10)"   },
};

// ─── Edit drawer ──────────────────────────────────────────────────────────────

function EditDrawer({
  auto,
  onSave,
  onClose,
}: {
  auto:    Automation;
  onSave:  (subject: string, body: string) => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(auto.subject);
  const [body,    setBody]    = useState(auto.body);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  async function handleSave() {
    if (!subject.trim() || !body.trim()) { setError("Subject and body are required."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(subject, body);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const meta = TRIGGER_META[auto.triggerType];
  const Icon = meta?.icon ?? Zap;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.72)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta?.bg }}>
              <Icon size={14} style={{ color: meta?.color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{auto.label}</p>
              <p className="text-[11px] text-muted-foreground">{auto.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Email subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground bg-transparent outline-none focus:border-accent placeholder:text-muted-foreground/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Email body
            </label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Use <code className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>{"{{fanName}}"}</code> and{" "}
              <code className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>{"{{artistName}}"}</code> as placeholders.
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground bg-transparent outline-none resize-none font-mono placeholder:text-muted-foreground/50 focus:border-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 px-5 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Automation card ──────────────────────────────────────────────────────────

function AutoCard({
  auto,
  onToggle,
  onEdit,
}: {
  auto:     Automation;
  onToggle: (type: string, val: boolean) => Promise<void>;
  onEdit:   (auto: Automation) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [open,     setOpen]     = useState(false);

  const meta = TRIGGER_META[auto.triggerType] ?? { icon: Zap, color: "#D4A843", bg: "rgba(212,168,67,0.10)" };
  const Icon = meta.icon;

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(auto.triggerType, !auto.isActive); }
    finally { setToggling(false); }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        backgroundColor: "var(--card)",
        borderColor:     auto.isActive ? meta.color + "33" : "var(--border)",
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: meta.bg, opacity: auto.isActive ? 1 : 0.5 }}
        >
          <Icon size={18} style={{ color: meta.color }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: auto.isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            {auto.label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{auto.description}</p>
          {auto.updatedAt && (
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              Last edited {new Date(auto.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onEdit(auto)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Edit template"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="transition-opacity disabled:opacity-50"
            title={auto.isActive ? "Disable" : "Enable"}
          >
            {toggling ? (
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            ) : auto.isActive ? (
              <ToggleRight size={28} style={{ color: meta.color }} />
            ) : (
              <ToggleLeft size={28} className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Preview template"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Preview panel */}
      {open && (
        <div
          className="px-5 pb-4 pt-0 border-t space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Subject</p>
            <p className="text-sm text-foreground">{auto.subject}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Body preview</p>
            <div
              className="rounded-xl border p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed"
              style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              {auto.body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FanAutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [editTarget,  setEditTarget]  = useState<Automation | null>(null);
  const [saved,       setSaved]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/fans/automations");
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setAutomations(d.automations ?? []);
    } catch {
      setError("Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(triggerType: string, isActive: boolean) {
    const r = await fetch("/api/fans/automations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ triggerType, isActive }),
    });
    if (!r.ok) throw new Error("Failed to toggle");
    setAutomations((prev) =>
      prev.map((a) => a.triggerType === triggerType ? { ...a, isActive } : a)
    );
  }

  async function handleSaveTemplate(subject: string, body: string) {
    if (!editTarget) return;
    const r = await fetch("/api/fans/automations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ triggerType: editTarget.triggerType, subject, body }),
    });
    if (!r.ok) throw new Error("Failed to save");
    setAutomations((prev) =>
      prev.map((a) =>
        a.triggerType === editTarget.triggerType
          ? { ...a, subject, body, updatedAt: new Date().toISOString() }
          : a
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const activeCount = automations.filter((a) => a.isActive).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border h-20 animate-pulse" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-12">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
          >
            <Zap size={17} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Fan Automations</h1>
            <p className="text-xs text-muted-foreground">
              {activeCount} of {automations.length} automation{automations.length !== 1 ? "s" : ""} active
              {" · "}sent automatically when fans hit milestones
            </p>
          </div>
        </div>
        {saved && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
            style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
          >
            <CheckCircle2 size={12} /> Saved
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/05 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ── Info ─────────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4 text-xs text-muted-foreground space-y-1"
        style={{ backgroundColor: "rgba(212,168,67,0.04)", borderColor: "rgba(212,168,67,0.15)" }}
      >
        <p className="text-foreground font-semibold text-sm">How automations work</p>
        <p>
          When a fan triggers a milestone (first purchase, first tip, etc.), IndieThis automatically
          sends a personalized email from you. Emails include your name as the reply-to address.
        </p>
        <p>Toggle each automation on or off, and click the edit icon to customize the template.</p>
      </div>

      {/* ── Cards ────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {automations.map((auto) => (
          <AutoCard
            key={auto.triggerType}
            auto={auto}
            onToggle={handleToggle}
            onEdit={setEditTarget}
          />
        ))}
      </div>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      {editTarget && (
        <EditDrawer
          auto={editTarget}
          onSave={handleSaveTemplate}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
