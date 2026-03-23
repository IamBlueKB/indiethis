"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, CheckCircle2, Circle, Plus, Trash2, Loader2, ExternalLink,
  Pencil, Check, X, Rocket, Clock, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type TaskCategory = "CREATIVE" | "DISTRIBUTION" | "MARKETING" | "MERCH" | "ADMIN";
type TaskActionType = string | null;

type Task = {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  dueDate: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  actionType: TaskActionType;
  actionUrl: string | null;
  linkedItemId: string | null;
};

type ReleasePlan = {
  id: string;
  title: string;
  releaseDate: string;
  status: "PLANNING" | "IN_PROGRESS" | "LAUNCHED" | "CANCELLED";
  track: { id: string; title: string; coverArtUrl: string | null } | null;
  release: { id: string; title: string } | null;
  tasks: Task[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<TaskCategory, { label: string; color: string; bg: string }> = {
  CREATIVE:     { label: "Creative",     color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  DISTRIBUTION: { label: "Publishing",   color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  MARKETING:    { label: "Marketing",    color: "#D4A843", bg: "rgba(212,168,67,0.1)" },
  MERCH:        { label: "Merch",        color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  ADMIN:        { label: "Admin",        color: "#888",    bg: "rgba(136,136,136,0.1)" },
};

const STATUS_META = {
  PLANNING:    { label: "Planning",    bg: "rgba(120,120,120,0.12)", color: "#888",    Icon: Clock },
  IN_PROGRESS: { label: "In Progress", bg: "rgba(212,168,67,0.12)",  color: "#D4A843", Icon: Rocket },
  LAUNCHED:    { label: "Launched",    bg: "rgba(52,199,89,0.12)",   color: "#34C759", Icon: CheckCircle2 },
  CANCELLED:   { label: "Cancelled",   bg: "rgba(232,93,74,0.12)",   color: "#E85D4A", Icon: XCircle },
};

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function dueDateColor(dateStr: string, completed: boolean): string {
  if (completed) return "#666";
  const days = daysUntil(dateStr);
  if (days < 0) return "#E85D4A";   // overdue
  if (days === 0) return "#D4A843"; // today
  return "#34C759";                 // upcoming
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type WeekGroup = {
  key: string;
  label: string;
  subtitle: string;
  daysFromRelease: number;
  tasks: Task[];
};

function groupTasksByWeek(tasks: Task[], releaseDate: string): WeekGroup[] {
  const release = new Date(releaseDate); release.setHours(0, 0, 0, 0);

  const getGroup = (task: Task): WeekGroup => {
    const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0);
    const diff = Math.round((release.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    // diff = days before release (positive = before, 0 = release day, negative = after)
    if (diff >= 28)      return { key: "w4", label: "Week 4", subtitle: "Creative Foundation",   daysFromRelease: 28, tasks: [] };
    if (diff >= 21)      return { key: "w3", label: "Week 3", subtitle: "Content Creation",      daysFromRelease: 21, tasks: [] };
    if (diff >= 14)      return { key: "w2", label: "Week 2", subtitle: "Pre-Launch Prep",        daysFromRelease: 14, tasks: [] };
    if (diff >= 7)       return { key: "w1", label: "Week 1", subtitle: "Final Countdown",        daysFromRelease: 7,  tasks: [] };
    if (diff >= 0)       return { key: "r0", label: "Release Day", subtitle: "Go Time 🚀",        daysFromRelease: 0,  tasks: [] };
    return               { key: "p1", label: "Post-Launch", subtitle: "Momentum & Growth",        daysFromRelease: -7, tasks: [] };
  };

  const map = new Map<string, WeekGroup>();
  const order = ["w4", "w3", "w2", "w1", "r0", "p1"];
  order.forEach((k) => map.set(k, undefined as unknown as WeekGroup));

  for (const task of tasks) {
    const g = getGroup(task);
    if (!map.get(g.key) || map.get(g.key) === undefined) {
      map.set(g.key, { ...g, tasks: [] });
    }
    map.get(g.key)!.tasks.push(task);
  }

  return order.map((k) => map.get(k)).filter((g): g is WeekGroup => !!g && g.tasks.length > 0);
}

// ── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  planId,
  onUpdate,
  onDelete,
}: {
  task: Task;
  planId: string;
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/dashboard/release-plans/${planId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(data.task);
      }
    } finally { setToggling(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/dashboard/release-plans/${planId}/tasks/${task.id}`, { method: "DELETE" });
      onDelete(task.id);
    } finally { setDeleting(false); }
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/release-plans/${planId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(data.task);
        setEditing(false);
      }
    } finally { setSaving(false); }
  }

  const cat = CATEGORY_META[task.category];
  const dateColor = dueDateColor(task.dueDate, task.isCompleted);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-3 group transition-all ${task.isCompleted ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        className="mt-0.5 shrink-0 transition-transform hover:scale-110"
      >
        {toggling
          ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
          : task.isCompleted
            ? <CheckCircle2 size={16} style={{ color: "#34C759" }} />
            : <Circle size={16} className="text-muted-foreground hover:text-foreground" />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 rounded-lg border px-2 py-1 text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
            />
            <button onClick={handleSaveEdit} disabled={saving} className="text-green-500 hover:text-green-400">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
        ) : (
          <p className={`text-sm font-medium leading-snug ${task.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
        )}

        {task.description && !editing && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{task.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Category badge */}
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: cat.bg, color: cat.color }}
          >
            {cat.label}
          </span>

          {/* Due date */}
          <span className="text-[10px] font-medium" style={{ color: dateColor }}>
            {task.isCompleted && task.completedAt
              ? `Completed ${formatDate(task.completedAt)}`
              : `Due ${formatDate(task.dueDate)}`
            }
          </span>
        </div>
      </div>

      {/* Action link */}
      {task.actionUrl && !editing && (
        <Link
          href={task.actionUrl}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-all"
          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
        >
          <ExternalLink size={9} />
          {task.isCompleted ? "View" : "Start"}
        </Link>
      )}

      {/* Edit + delete (hover) */}
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={() => { setEditTitle(task.title); setEditing(true); }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:text-red-400"
            style={{ color: "var(--muted-foreground)" }}
          >
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

function AddTaskForm({ planId, onAdd, onCancel }: {
  planId: string;
  onAdd: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("MARKETING");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/release-plans/${planId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, dueDate, description: description.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdd(data.task);
      }
    } finally { setSaving(false); }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-3 space-y-2.5"
      style={{ borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.04)" }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        required
        className="w-full rounded-lg border px-2.5 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        style={{ borderColor: "var(--border)" }}
        autoFocus
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg border px-2.5 py-2 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          className="rounded-lg border px-2.5 py-2 text-xs bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)" }}
        >
          {(["CREATIVE", "DISTRIBUTION", "MARKETING", "MERCH", "ADMIN"] as TaskCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_META[c].label}</option>
          ))}
        </select>
        <input
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          type="date"
          required
          className="rounded-lg border px-2.5 py-2 text-xs bg-transparent text-foreground outline-none"
          style={{ borderColor: "var(--border)" }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim() || !dueDate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {saving ? <><Loader2 size={11} className="animate-spin" /> Adding…</> : <><Plus size={11} /> Add Task</>}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground" style={{ backgroundColor: "var(--border)" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReleasePlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<ReleasePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingTaskGroup, setAddingTaskGroup] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/dashboard/release-plans/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setPlan(d.plan ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  function updateTask(updated: Task) {
    setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.map((t) => t.id === updated.id ? updated : t) } : prev);
  }

  function deleteTask(taskId: string) {
    setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev);
  }

  function addTask(task: Task) {
    setPlan((prev) => prev ? { ...prev, tasks: [...prev.tasks, task] } : prev);
    setAddingTaskGroup(null);
  }

  async function saveTitle() {
    if (!plan || !titleDraft.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/dashboard/release-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan((prev) => prev ? { ...prev, title: data.plan.title } : prev);
      setEditingTitle(false);
    }
    setSaving(false);
  }

  async function saveDate() {
    if (!plan || !dateDraft) return;
    setSaving(true);
    const res = await fetch(`/api/dashboard/release-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseDate: dateDraft }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan((prev) => prev ? { ...prev, releaseDate: data.plan.releaseDate } : prev);
      setEditingDate(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!plan || !confirm("Delete this release plan? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/dashboard/release-plans/${plan.id}`, { method: "DELETE" });
    router.push("/dashboard/release-planner");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Release plan not found.</p>
        <Link href="/dashboard/release-planner" className="text-sm mt-2 inline-block" style={{ color: "#D4A843" }}>← Back to Release Planner</Link>
      </div>
    );
  }

  const completedCount = plan.tasks.filter((t) => t.isCompleted).length;
  const totalCount = plan.tasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const days = daysUntil(plan.releaseDate);
  const statusMeta = STATUS_META[plan.status];
  const StatusIcon = statusMeta.Icon;

  const weekGroups = groupTasksByWeek(plan.tasks, plan.releaseDate);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/release-planner"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Release Planner
      </Link>

      {/* Plan header card */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {/* Title + status */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="flex-1 rounded-xl border px-3 py-2 text-lg font-bold bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  autoFocus
                />
                <button onClick={saveTitle} disabled={saving} className="text-green-500"><Check size={16} /></button>
                <button onClick={() => setEditingTitle(false)} className="text-muted-foreground"><X size={14} /></button>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 group/title hover:opacity-80 text-left"
                onClick={() => { setTitleDraft(plan.title); setEditingTitle(true); }}
              >
                <h1 className="text-xl font-bold">{plan.title}</h1>
                <Pencil size={13} className="text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
              </button>
            )}

            {/* Release date */}
            <div className="flex items-center gap-2 mt-1.5">
              <CalendarDays size={12} className="text-muted-foreground" />
              {editingDate ? (
                <div className="flex items-center gap-2">
                  <input
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    type="date"
                    className="rounded-lg border px-2 py-1 text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button onClick={saveDate} disabled={saving} className="text-green-500"><Check size={12} /></button>
                  <button onClick={() => setEditingDate(false)} className="text-muted-foreground"><X size={11} /></button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 group/date hover:opacity-80"
                  onClick={() => {
                    const d = new Date(plan.releaseDate);
                    setDateDraft(d.toISOString().split("T")[0]);
                    setEditingDate(true);
                  }}
                >
                  <span className="text-sm text-muted-foreground">
                    {new Date(plan.releaseDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <Pencil size={10} className="text-muted-foreground opacity-0 group-hover/date:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>

          {/* Status + countdown */}
          <div className="text-right shrink-0 space-y-1.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
            >
              <StatusIcon size={10} />
              {statusMeta.label}
            </span>
            <p className="text-[11px] font-semibold"
              style={{ color: days > 0 ? "#D4A843" : days === 0 ? "#34C759" : "#888" }}>
              {days > 0 ? `${days} days to release` : days === 0 ? "Releases today! 🚀" : `Released ${Math.abs(days)}d ago`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">{completedCount} of {totalCount} tasks complete</span>
            <span className="text-xs font-bold" style={{ color: pct === 100 ? "#34C759" : "#D4A843" }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#34C759" : "#D4A843" }}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {weekGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          const groupCompleted = group.tasks.filter((t) => t.isCompleted).length;
          const groupTotal = group.tasks.length;
          const isReleaseDay = group.key === "r0";

          return (
            <div key={group.key} className="space-y-2">
              {/* Week header */}
              <button
                className="w-full flex items-center gap-3"
                onClick={() => setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                  return next;
                })}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="h-px flex-shrink-0 w-4"
                    style={{ backgroundColor: isReleaseDay ? "#D4A843" : "var(--border)" }}
                  />
                  <span
                    className="text-[11px] font-black uppercase tracking-widest shrink-0"
                    style={{ color: isReleaseDay ? "#D4A843" : "var(--foreground)" }}
                  >
                    {group.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">— {group.subtitle}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({groupCompleted}/{groupTotal})</span>
                  <div className="h-px flex-1" style={{ backgroundColor: isReleaseDay ? "rgba(212,168,67,0.3)" : "var(--border)" }} />
                </div>
                {collapsed ? <ChevronDown size={13} className="text-muted-foreground shrink-0" /> : <ChevronUp size={13} className="text-muted-foreground shrink-0" />}
              </button>

              {/* Tasks */}
              {!collapsed && (
                <div className="space-y-1.5 pl-2">
                  {group.tasks
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        planId={plan.id}
                        onUpdate={updateTask}
                        onDelete={deleteTask}
                      />
                    ))
                  }

                  {/* Add task */}
                  {addingTaskGroup === group.key ? (
                    <AddTaskForm
                      planId={plan.id}
                      onAdd={addTask}
                      onCancel={() => setAddingTaskGroup(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingTaskGroup(group.key)}
                      className="w-full flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all border"
                      style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
                    >
                      <Plus size={11} /> Add custom task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add task to new group */}
        {addingTaskGroup === "new" ? (
          <div className="pl-2">
            <AddTaskForm planId={plan.id} onAdd={addTask} onCancel={() => setAddingTaskGroup(null)} />
          </div>
        ) : (
          <button
            onClick={() => setAddingTaskGroup("new")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={13} /> Add task
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div
        className="rounded-2xl border p-4 flex items-center justify-between"
        style={{ borderColor: "rgba(232,93,74,0.2)", backgroundColor: "rgba(232,93,74,0.04)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "#E85D4A" }}>Delete Plan</p>
          <p className="text-xs text-muted-foreground">This will permanently delete the plan and all its tasks.</p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
        </button>
      </div>
    </div>
  );
}
