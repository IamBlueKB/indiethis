"use client";

import { useState, useCallback } from "react";
import {
  BarChart3, Bell, Target, History, Send, Eye,
  Plus, Trash2, Pencil, X, Check, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { RevenueReport } from "@/lib/agents/revenue-report";

// ─── Types ────────────────────────────────────────────────────────────────────

type Config = {
  id:              string;
  frequency:       string;
  dayOfWeek:       number;
  dayOfMonth:      number;
  timeUtc:         string;
  recipients:      string[];
  enabledSections: string[];
};

type Alert = {
  id:              string;
  metric:          string;
  condition:       string;
  threshold:       number;
  active:          boolean;
  lastTriggeredAt: string | null;
  createdAt:       string;
};

type Goal = {
  id:           string;
  metric:       string;
  targetValue:  number;
  currentValue: number;
  period:       string;
};

type HistoryLog = {
  id:        string;
  period:    string;
  frequency: string;
  sentTo:    string[];
  createdAt: string;
};

type HistoryResponse = {
  logs:       HistoryLog[];
  total:      number;
  page:       number;
  perPage:    number;
  totalPages: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS_UTC    = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const SECTIONS     = ["revenue", "users", "products", "engagement", "agents", "goals"] as const;
const SECTION_LABELS: Record<string, string> = {
  revenue: "Revenue", users: "Users", products: "Products",
  engagement: "Engagement", agents: "Agents", goals: "Goals",
};
const METRIC_OPTIONS = [
  { value: "DAILY_REVENUE", label: "Daily Revenue",  money: true },
  { value: "DAILY_SIGNUPS", label: "Daily Signups",  money: false },
  { value: "DAILY_CHURN",   label: "Daily Churn",    money: false },
];
const GOAL_METRICS = [
  { value: "SUBSCRIBERS", label: "New Subscribers", money: false },
  { value: "MRR",         label: "MRR",             money: true  },
  { value: "REVENUE",     label: "Total Revenue",   money: true  },
  { value: "SIGNUPS",     label: "New Signups",      money: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function localTime(utcHour: string): string {
  const h = parseInt(utcHour.split(":")[0], 10);
  try {
    const d = new Date(); d.setUTCHours(h, 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return utcHour; }
}

function futureMonths(count = 6): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RevenueReportContent({
  config:        initialConfig,
  alerts:        initialAlerts,
  goals:         initialGoals,
  history:       initialHistory,
  currentPeriod,
}: {
  config:        Config | null;
  alerts:        Alert[];
  goals:         Goal[];
  history:       HistoryResponse;
  currentPeriod: string;
}) {
  const [activeTab, setActiveTab] = useState<"settings" | "alerts" | "goals" | "history">("settings");
  const [config,   setConfig]   = useState<Config | null>(initialConfig);
  const [alerts,   setAlerts]   = useState<Alert[]>(initialAlerts);
  const [goals,    setGoals]    = useState<Goal[]>(initialGoals);
  const [history,  setHistory]  = useState<HistoryResponse>(initialHistory);

  const [toast,    setToast]    = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [preview,  setPreview]  = useState<{ report: RevenueReport; enabledSections: string[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading,    setSendLoading]    = useState(false);
  const [viewLogId,      setViewLogId]      = useState<string | null>(null);
  const [viewLogData,    setViewLogData]    = useState<{ data: RevenueReport; sentTo: string[]; period: string } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Send Now ──────────────────────────────────────────────────────────────

  async function handleSendNow() {
    if (!confirm("Send the revenue report to all recipients now?")) return;
    setSendLoading(true);
    try {
      const res  = await fetch("/api/admin/revenue-report/send-now", { method: "POST" });
      const data = await res.json() as { ok?: boolean; recipients?: number };
      if (res.ok) showToast(`Report sent to ${data.recipients ?? 0} recipients.`);
      else        showToast("Failed to send report.", "error");
    } catch { showToast("Failed to send report.", "error"); }
    finally    { setSendLoading(false); }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const res  = await fetch("/api/admin/revenue-report/preview", { method: "POST" });
      const data = await res.json() as { report?: RevenueReport; enabledSections?: string[] };
      if (res.ok && data.report) setPreview({ report: data.report, enabledSections: data.enabledSections ?? [] });
      else showToast("Failed to generate preview.", "error");
    } catch { showToast("Failed to generate preview.", "error"); }
    finally  { setPreviewLoading(false); }
  }

  // ── History view ──────────────────────────────────────────────────────────

  async function handleViewLog(id: string) {
    setViewLogId(id);
    try {
      const res  = await fetch(`/api/admin/revenue-report/history/${id}`);
      const data = await res.json() as { data: RevenueReport; sentTo: string[]; period: string };
      if (res.ok) setViewLogData(data);
    } catch { showToast("Failed to load report.", "error"); }
  }

  async function loadHistoryPage(page: number) {
    const res  = await fetch(`/api/admin/revenue-report/history?page=${page}`);
    const data = await res.json() as HistoryResponse;
    if (res.ok) setHistory(data);
  }

  const TABS = [
    { id: "settings", label: "Settings",  icon: BarChart3 },
    { id: "alerts",   label: "Alerts",    icon: Bell },
    { id: "goals",    label: "Goals",     icon: Target },
    { id: "history",  label: "History",   icon: History },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{
            backgroundColor: toast.type === "success" ? "#D4A843" : "#E85D4A",
            color:           "#0A0A0A",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 size={20} style={{ color: "#D4A843" }} />
          <h1 className="text-xl font-bold text-foreground">Revenue Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            <Eye size={14} />
            {previewLoading ? "Loading…" : "Preview Report"}
          </button>
          <button
            onClick={handleSendNow}
            disabled={sendLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Send size={14} />
            {sendLoading ? "Sending…" : "Send Report Now"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: activeTab === id ? "#D4A843" : "transparent",
              color:       activeTab === id ? "#D4A843" : "var(--muted-foreground)",
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "settings" && config && (
        <SettingsTab
          config={config}
          onChange={setConfig}
          showToast={showToast}
        />
      )}

      {activeTab === "alerts" && (
        <AlertsTab
          alerts={alerts}
          onChange={setAlerts}
          showToast={showToast}
        />
      )}

      {activeTab === "goals" && (
        <GoalsTab
          goals={goals}
          onChange={setGoals}
          currentPeriod={currentPeriod}
          showToast={showToast}
        />
      )}

      {activeTab === "history" && (
        <HistoryTab
          history={history}
          onViewLog={handleViewLog}
          onLoadPage={loadHistoryPage}
        />
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          report={preview.report}
          enabledSections={preview.enabledSections}
          onClose={() => setPreview(null)}
        />
      )}

      {/* History view modal */}
      {viewLogId && viewLogData && (
        <PreviewModal
          report={viewLogData.data}
          enabledSections={Object.keys(viewLogData.data).filter(k =>
            ["revenue","users","products","engagement","agents","goals"].includes(k)
          )}
          onClose={() => { setViewLogId(null); setViewLogData(null); }}
          title={`Report: ${viewLogData.period}`}
          subtitle={`Sent to: ${viewLogData.sentTo?.join(", ")}`}
        />
      )}
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({
  config, onChange, showToast,
}: {
  config:     Config;
  onChange:   (c: Config) => void;
  showToast:  (msg: string, type?: "success" | "error") => void;
}) {
  const [form,    setForm]    = useState(config);
  const [saving,  setSaving]  = useState(false);
  const [newEmail, setNewEmail] = useState("");

  async function save() {
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/revenue-report/config", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json() as Config;
      if (res.ok) { onChange(data); showToast("Settings saved."); }
      else          showToast("Failed to save.", "error");
    } catch { showToast("Failed to save.", "error"); }
    finally  { setSaving(false); }
  }

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    if (form.recipients.includes(e)) return;
    setForm(f => ({ ...f, recipients: [...f.recipients, e] }));
    setNewEmail("");
  }

  function removeEmail(email: string) {
    if (email === "blue@clearearstudios.com") return; // can't remove Blue
    setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));
  }

  function toggleSection(s: string) {
    setForm(f => ({
      ...f,
      enabledSections: f.enabledSections.includes(s)
        ? f.enabledSections.filter(x => x !== s)
        : [...f.enabledSections, s],
    }));
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card title="Schedule">
        {/* Frequency */}
        <Field label="Frequency">
          <div className="flex gap-2">
            {["DAILY", "WEEKLY", "MONTHLY"].map(f => (
              <button
                key={f}
                onClick={() => setForm(x => ({ ...x, frequency: f }))}
                className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  backgroundColor: form.frequency === f ? "#D4A843" : "var(--card)",
                  color:           form.frequency === f ? "#0A0A0A" : "var(--muted-foreground)",
                  borderColor:     form.frequency === f ? "#D4A843" : "var(--border)",
                }}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </Field>

        {/* Day of week */}
        {form.frequency === "WEEKLY" && (
          <Field label="Day of Week">
            <Select
              value={String(form.dayOfWeek)}
              onChange={v => setForm(x => ({ ...x, dayOfWeek: parseInt(v, 10) }))}
              options={DAYS_OF_WEEK.map((d, i) => ({ value: String(i), label: d }))}
            />
          </Field>
        )}

        {/* Day of month */}
        {form.frequency === "MONTHLY" && (
          <Field label="Day of Month">
            <Select
              value={String(form.dayOfMonth)}
              onChange={v => setForm(x => ({ ...x, dayOfMonth: parseInt(v, 10) }))}
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
          </Field>
        )}

        {/* Time UTC */}
        <Field label="Time (UTC)">
          <div className="flex items-center gap-3">
            <Select
              value={form.timeUtc}
              onChange={v => setForm(x => ({ ...x, timeUtc: v }))}
              options={HOURS_UTC.map(h => ({ value: h, label: h }))}
            />
            <span className="text-xs text-muted-foreground">{localTime(form.timeUtc)} local</span>
          </div>
        </Field>
      </Card>

      <Card title="Recipients">
        <div className="space-y-2">
          {form.recipients.map(email => (
            <div key={email} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
              <span className="text-sm text-foreground">{email}</span>
              {email !== "blue@clearearstudios.com" && (
                <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-red-400 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addEmail()}
              placeholder="Add email address…"
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent border"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            <button
              onClick={addEmail}
              className="px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </Card>

      <Card title="Report Sections">
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map(s => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => toggleSection(s)}
                className="w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  backgroundColor: form.enabledSections.includes(s) ? "#D4A843" : "transparent",
                  borderColor:     form.enabledSections.includes(s) ? "#D4A843" : "var(--border)",
                }}
              >
                {form.enabledSections.includes(s) && <Check size={10} color="#0A0A0A" strokeWidth={3} />}
              </div>
              <span className="text-sm text-foreground">{SECTION_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </Card>

      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab({
  alerts, onChange, showToast,
}: {
  alerts:    Alert[];
  onChange:  (a: Alert[]) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form,     setForm]     = useState({ metric: "DAILY_REVENUE", condition: "BELOW", threshold: "", active: true });
  const [saving,   setSaving]   = useState(false);

  function openAdd() {
    setEditId(null);
    setForm({ metric: "DAILY_REVENUE", condition: "BELOW", threshold: "", active: true });
    setShowForm(true);
  }

  function openEdit(a: Alert) {
    setEditId(a.id);
    const isRevenue = a.metric === "DAILY_REVENUE";
    setForm({
      metric:    a.metric,
      condition: a.condition,
      threshold: isRevenue ? String(a.threshold / 100) : String(a.threshold),
      active:    a.active,
    });
    setShowForm(true);
  }

  async function save() {
    const isRevenue = form.metric === "DAILY_REVENUE";
    const threshold = isRevenue
      ? Math.round(parseFloat(form.threshold) * 100)
      : parseInt(form.threshold, 10);
    if (isNaN(threshold)) { showToast("Invalid threshold.", "error"); return; }

    setSaving(true);
    try {
      const url    = editId ? `/api/admin/revenue-report/alerts/${editId}` : "/api/admin/revenue-report/alerts";
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: form.metric, condition: form.condition, threshold, active: form.active }),
      });
      const data = await res.json() as Alert;
      if (res.ok) {
        onChange(editId ? alerts.map(a => a.id === editId ? data : a) : [...alerts, data]);
        showToast(editId ? "Alert updated." : "Alert created.");
        setShowForm(false);
      } else showToast("Failed to save.", "error");
    } catch { showToast("Failed to save.", "error"); }
    finally  { setSaving(false); }
  }

  async function deleteAlert(id: string) {
    if (!confirm("Delete this alert?")) return;
    const res = await fetch(`/api/admin/revenue-report/alerts/${id}`, { method: "DELETE" });
    if (res.ok) { onChange(alerts.filter(a => a.id !== id)); showToast("Alert deleted."); }
    else          showToast("Failed to delete.", "error");
  }

  async function toggleActive(a: Alert) {
    const res  = await fetch(`/api/admin/revenue-report/alerts/${a.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    const data = await res.json() as Alert;
    if (res.ok) onChange(alerts.map(x => x.id === a.id ? data : x));
  }

  const isRevenue = form.metric === "DAILY_REVENUE";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{alerts.length} alert rule{alerts.length !== 1 ? "s" : ""}</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={13} /> Add Alert
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card title={editId ? "Edit Alert" : "New Alert"}>
          <div className="space-y-3">
            <Field label="Metric">
              <Select
                value={form.metric}
                onChange={v => setForm(f => ({ ...f, metric: v }))}
                options={METRIC_OPTIONS.map(m => ({ value: m.value, label: m.label }))}
              />
            </Field>
            <Field label="Condition">
              <Select
                value={form.condition}
                onChange={v => setForm(f => ({ ...f, condition: v }))}
                options={[{ value: "BELOW", label: "Drops Below" }, { value: "ABOVE", label: "Exceeds" }]}
              />
            </Field>
            <Field label="Threshold">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{isRevenue ? "$" : "#"}</span>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                  placeholder={isRevenue ? "100.00" : "5"}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent border"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </Field>
            <Field label="Active">
              <Toggle checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            </Field>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              {["Metric", "Condition", "Threshold", "Active", "Last Triggered", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No alerts configured.</td></tr>
            )}
            {alerts.map(a => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-foreground">{METRIC_OPTIONS.find(m => m.value === a.metric)?.label ?? a.metric}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.condition === "BELOW" ? "Drops below" : "Exceeds"}</td>
                <td className="px-4 py-3 text-foreground font-mono">
                  {a.metric === "DAILY_REVENUE" ? fmt(a.threshold) : a.threshold.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={a.active} onChange={() => toggleActive(a)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {a.lastTriggeredAt ? new Date(a.lastTriggeredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(a)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteAlert(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab({
  goals, onChange, currentPeriod, showToast,
}: {
  goals:         Goal[];
  onChange:      (g: Goal[]) => void;
  currentPeriod: string;
  showToast:     (msg: string, type?: "success" | "error") => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ metric: "SUBSCRIBERS", target: "", period: currentPeriod });

  const now         = new Date();
  const daysTotal   = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysLeft    = daysTotal - daysElapsed;

  async function addGoal() {
    const targetRaw = parseFloat(form.target);
    if (isNaN(targetRaw)) { showToast("Enter a valid target.", "error"); return; }
    const isMoney   = ["MRR", "REVENUE"].includes(form.metric);
    const targetVal = isMoney ? Math.round(targetRaw * 100) : Math.round(targetRaw);

    setSaving(true);
    try {
      const res  = await fetch("/api/admin/revenue-report/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric: form.metric, targetValue: targetVal, period: form.period }),
      });
      const data = await res.json() as Goal;
      if (res.ok) { onChange([...goals, data]); showToast("Goal created."); setShowForm(false); }
      else          showToast("Failed to create goal.", "error");
    } catch { showToast("Failed to create goal.", "error"); }
    finally  { setSaving(false); }
  }

  async function deleteGoal(id: string) {
    if (!confirm("Delete this goal?")) return;
    const res = await fetch(`/api/admin/revenue-report/goals/${id}`, { method: "DELETE" });
    if (res.ok) { onChange(goals.filter(g => g.id !== id)); showToast("Goal deleted."); }
    else          showToast("Failed to delete.", "error");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{goals.length} goal{goals.length !== 1 ? "s" : ""} for {currentPeriod}</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={13} /> Add Goal
        </button>
      </div>

      {showForm && (
        <Card title="New Goal">
          <div className="space-y-3">
            <Field label="Metric">
              <Select
                value={form.metric}
                onChange={v => setForm(f => ({ ...f, metric: v }))}
                options={GOAL_METRICS.map(m => ({ value: m.value, label: m.label }))}
              />
            </Field>
            <Field label={["MRR","REVENUE"].includes(form.metric) ? "Target ($)" : "Target (count)"}>
              <input
                type="number"
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder={["MRR","REVENUE"].includes(form.metric) ? "5000.00" : "100"}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </Field>
            <Field label="Period">
              <Select
                value={form.period}
                onChange={v => setForm(f => ({ ...f, period: v }))}
                options={futureMonths().map(p => ({ value: p, label: p }))}
              />
            </Field>
            <div className="flex gap-2">
              <button onClick={addGoal} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {goals.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground text-sm">No goals for this period.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const isMoney  = ["MRR", "REVENUE"].includes(g.metric);
          const pct      = g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0;
          const expected = daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 100) : 0;
          const onTrack  = pct >= expected - 5;
          const label    = GOAL_METRICS.find(m => m.value === g.metric)?.label ?? g.metric;
          const current  = isMoney ? fmt(g.currentValue) : g.currentValue.toLocaleString();
          const target   = isMoney ? fmt(g.targetValue)  : g.targetValue.toLocaleString();

          return (
            <div key={g.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <button onClick={() => deleteGoal(g.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{current}</span>
                <span className="text-sm text-muted-foreground">/ {target}</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#222" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: "#D4A843" }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: onTrack ? "#D4A843" : "#E85D4A" }} className="font-semibold">
                  {pct}% — {onTrack ? "On track" : "Behind pace"}
                </span>
                <span className="text-muted-foreground">{daysLeft} days left</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({
  history, onViewLog, onLoadPage,
}: {
  history:    HistoryResponse;
  onViewLog:  (id: string) => void;
  onLoadPage: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{history.total} reports sent</p>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              {["Period", "Frequency", "Sent To", "Date Sent", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No reports sent yet.</td></tr>
            )}
            {history.logs.map(log => (
              <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-foreground">{log.period}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{log.frequency.toLowerCase()}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{log.sentTo?.join(", ")}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewLog(log.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/[0.04]"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {history.totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end text-sm">
          <button
            onClick={() => onLoadPage(history.page - 1)}
            disabled={history.page <= 1}
            className="p-2 rounded-lg border disabled:opacity-40 transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-muted-foreground text-sm">Page {history.page} of {history.totalPages}</span>
          <button
            onClick={() => onLoadPage(history.page + 1)}
            disabled={history.page >= history.totalPages}
            className="p-2 rounded-lg border disabled:opacity-40 transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  report, enabledSections, onClose, title, subtitle,
}: {
  report:          RevenueReport;
  enabledSections: string[];
  onClose:         () => void;
  title?:          string;
  subtitle?:       string;
}) {
  const has = (s: string) => enabledSections.includes(s);
  const now         = new Date();
  const daysTotal   = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysLeft    = daysTotal - daysElapsed;

  const pct = (curr: number, tgt: number) => tgt > 0 ? Math.min(100, Math.round((curr / tgt) * 100)) : 0;
  const changeColor = (c: number) => c > 0 ? "#4CAF50" : c < 0 ? "#E85D4A" : "#888";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div>
            <p className="font-bold text-foreground">{title ?? `Revenue Report — ${report.period}`}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Report content */}
        <div className="px-6 py-5 space-y-5 font-mono text-sm">
          <p style={{ color: "#D4A843", fontFamily: "sans-serif", fontWeight: 800, fontSize: 18 }}>IndieThis</p>
          <p className="text-muted-foreground" style={{ fontFamily: "sans-serif", fontSize: 12, marginTop: -12 }}>
            Revenue Report — {report.period}
          </p>

          {has("revenue") && (
            <Section label="Revenue">
              <Row label="Total" value={fmt(report.revenue.total)} highlight />
              <Row label="  Change" value={
                <span style={{ color: changeColor(report.revenue.changePercent) }}>
                  {report.revenue.changePercent > 0 ? "↑" : report.revenue.changePercent < 0 ? "↓" : "—"} {Math.abs(report.revenue.changePercent)}% vs last period
                </span>
              } />
              <Row label="  Subscriptions" value={fmt(report.revenue.subscriptions)} />
              <Row label="  PPU Tools"     value={fmt(report.revenue.ppu)} />
              <Row label="  Merch"         value={fmt(report.revenue.merchCut)} />
              <Row label="  Beat Licensing" value={fmt(report.revenue.beatLicensing)} />
              <Row label="  Digital Sales" value={fmt(report.revenue.digitalSales)} />
              <Row label="  Fan Funding"   value={fmt(report.revenue.fanFunding)} />
              <Row label="  Sample Packs"  value={fmt(report.revenue.samplePacks)} />
              <Row label="MRR" value={<span style={{ color: "#D4A843", fontWeight: 700 }}>{fmt(report.revenue.mrr)}</span>} />
            </Section>
          )}

          {has("users") && (
            <Section label="Users">
              <Row label="New Signups"      value={`${report.users.newSignups} (Email: ${report.users.signupsByProvider.email}, Google: ${report.users.signupsByProvider.google}, FB: ${report.users.signupsByProvider.facebook})`} />
              <Row label="New Subscribers"  value={report.users.newSubscribers} />
              <Row label="Churned"          value={report.users.churned} />
              <Row label="Net Growth"       value={
                <span style={{ color: report.users.netGrowth >= 0 ? "#4CAF50" : "#E85D4A" }}>
                  {report.users.netGrowth >= 0 ? "+" : ""}{report.users.netGrowth}
                </span>
              } />
              <Row label="Total Active"     value={<strong style={{ color: "#fff" }}>{report.users.totalActive.toLocaleString()}</strong>} />
            </Section>
          )}

          {has("products") && (
            <Section label="Products">
              <Row label="Most Used AI"  value={report.products.mostUsedAiTool ? `${report.products.mostUsedAiTool.name} (${report.products.mostUsedAiTool.count})` : "—"} />
              <Row label="Least Used AI" value={report.products.leastUsedAiTool ? `${report.products.leastUsedAiTool.name} (${report.products.leastUsedAiTool.count})` : "—"} />
              <Row label="Top Merch"     value={report.products.topMerchProduct ? `${report.products.topMerchProduct.name} (${report.products.topMerchProduct.sales} sold)` : "—"} />
              <Row label="Top Digital"   value={report.products.topDigitalProduct ? `${report.products.topDigitalProduct.name} (${report.products.topDigitalProduct.sales} sold)` : "—"} />
              <Row label="Top Beat"      value={report.products.topBeat ? `${report.products.topBeat.name} (${report.products.topBeat.licenses} licensed)` : "—"} />
            </Section>
          )}

          {has("engagement") && (
            <Section label="Engagement">
              <Row label="Track Plays"     value={report.engagement.totalPlays.toLocaleString()} />
              <Row label="Most Played"     value={report.engagement.mostPlayedTrack ? `"${report.engagement.mostPlayedTrack.title}" by ${report.engagement.mostPlayedTrack.artist} (${report.engagement.mostPlayedTrack.plays})` : "—"} />
              <Row label="New Crate Adds"  value={report.engagement.newCrateAdds.toLocaleString()} />
              <Row label="Fan Funding"     value={fmt(report.engagement.fanFundingTotal)} />
            </Section>
          )}

          {has("agents") && (
            <Section label="Agents">
              <Row label="Actions"          value={report.agents.totalActions.toLocaleString()} />
              <Row label="Payment Recovery" value={`${report.agents.paymentRecoverySaves} saves (${fmt(report.agents.paymentRecoveryRevenue)} recovered)`} />
              <Row label="Churn Risk"       value={`${report.agents.churnRiskCount} at risk`} />
            </Section>
          )}

          {has("goals") && report.goals.length > 0 && (
            <Section label="Goals">
              {report.goals.map(g => {
                const isMoney = ["MRR","REVENUE"].includes(g.metric);
                const p       = pct(g.currentValue, g.targetValue);
                const expected = daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 100) : 0;
                const onTrack = p >= expected - 5;
                const label   = GOAL_METRICS.find(m => m.value === g.metric)?.label ?? g.metric;
                const curr    = isMoney ? fmt(g.currentValue) : g.currentValue.toLocaleString();
                const tgt     = isMoney ? fmt(g.targetValue)  : g.targetValue.toLocaleString();
                return (
                  <div key={g.id} className="mb-2">
                    <Row label={label} value={`${curr}/${tgt}`} />
                    <div className="flex items-center gap-2 ml-4 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#222" }}>
                        <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: "#D4A843" }} />
                      </div>
                      <span className="text-xs" style={{ color: onTrack ? "#D4A843" : "#E85D4A" }}>{p}%</span>
                      <span className="text-xs text-muted-foreground">{daysLeft}d left</span>
                    </div>
                  </div>
                );
              })}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <p className="text-sm text-muted-foreground w-28 shrink-0">{label}</p>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options }: {
  value:    string;
  onChange: (v: string) => void;
  options:  { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm border w-full bg-transparent"
      style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: "#111" }}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-10 h-5 rounded-full transition-colors relative"
      style={{ backgroundColor: checked ? "#D4A843" : "#333" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
        style={{ backgroundColor: "#fff", left: checked ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#D4A843", fontFamily: "sans-serif" }}>{label}</p>
      <div className="space-y-1 pl-0">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground w-36 shrink-0">{label}:</span>
      <span style={{ color: highlight ? "#fff" : "inherit", fontWeight: highlight ? 700 : 400 }}>{value}</span>
    </div>
  );
}
