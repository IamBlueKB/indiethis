"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mail, ChevronDown, ChevronUp, Check, Loader2,
  ToggleLeft, ToggleRight, Eye, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailTemplate = {
  enabled: boolean;
  subject: string;
  body: string;
};

type EmailTemplates = {
  day1: EmailTemplate;
  day3: EmailTemplate;
  day7: EmailTemplate;
  day14: EmailTemplate;
};

type StepKey = keyof EmailTemplates;

// ─── Platform pricing (used in preview sample data) ───────────────────────────

const PLATFORM_PRICES = {
  masteringPrice: "$14.99",
  coverArtPrice:  "$9.99",
  arReportPrice:  "$19.99",
};

// ─── Preview sample data ──────────────────────────────────────────────────────

function renderPreview(text: string, studioName: string): string {
  return text
    .replace(/\{artistName\}/g,     "Jordan")
    .replace(/\{sessionDate\}/g,    "March 15, 2026")
    .replace(/\{studioName\}/g,     studioName)
    .replace(/\{studioPhone\}/g,    "(555) 012-3456")
    .replace(/\{downloadLink\}/g,   "https://indiethis.com/dl/example-link")
    .replace(/\{masteringPrice\}/g, PLATFORM_PRICES.masteringPrice)
    .replace(/\{coverArtPrice\}/g,  PLATFORM_PRICES.coverArtPrice)
    .replace(/\{arReportPrice\}/g,  PLATFORM_PRICES.arReportPrice);
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: EmailTemplates = {
  day1: {
    enabled: true,
    subject: "Your session files are ready",
    body: `Hey {artistName}, thanks for coming in to {studioName}. Your session files from {sessionDate} are ready to download: {downloadLink}. Want to take your track further? Get it mastered for {masteringPrice}, create cover art for {coverArtPrice}, or get an A&R report for {arReportPrice}.`,
  },
  day3: {
    enabled: true,
    subject: "Your track could be release-ready",
    body: `Hey {artistName}, just checking in from {studioName}. If you haven't already, mastering your track is the fastest way to get it streaming-ready. One click: {masteringPrice}.`,
  },
  day7: {
    enabled: true,
    subject: "Artists are finishing their projects",
    body: `Hey {artistName}, artists who recorded at {studioName} are releasing music with professional cover art, mastered tracks, and press kits — all from the same platform where your session files live. Check it out.`,
  },
  day14: {
    enabled: false,
    subject: "A better way to manage your music",
    body: `Hey {artistName}, you've been using pay-per-use tools from {studioName}. A subscription plan could save you money. See what's included.`,
  },
};

const STEP_META: { key: StepKey; day: string; title: string; description: string }[] = [
  {
    key: "day1",
    day: "Day 1",
    title: "Session Files Ready",
    description: "Sent immediately after file delivery. Includes the download link.",
  },
  {
    key: "day3",
    day: "Day 3",
    title: "Track Follow-Up",
    description: "Check in and upsell mastering or cover art.",
  },
  {
    key: "day7",
    day: "Day 7",
    title: "Social Proof",
    description: "Encourage sharing and pitch additional services.",
  },
  {
    key: "day14",
    day: "Day 14",
    title: "Subscription Pitch",
    description: "Promote monthly session packages and consistent booking.",
  },
];

const VARIABLES = [
  { token: "{artistName}",      desc: "Contact's full name" },
  { token: "{sessionDate}",     desc: "Date of the session" },
  { token: "{studioName}",      desc: "Your studio name" },
  { token: "{studioPhone}",     desc: "Your studio phone number" },
  { token: "{downloadLink}",    desc: "File delivery download URL" },
  { token: "{masteringPrice}",  desc: "Your mastering service price" },
  { token: "{coverArtPrice}",   desc: "Your cover art service price" },
  { token: "{arReportPrice}",   desc: "Your A&R report price" },
];

// ─── Input styles ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 transition-shadow";

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  meta,
  template,
  studioName,
  onClose,
}: {
  meta: typeof STEP_META[number];
  template: EmailTemplate;
  studioName: string;
  onClose: () => void;
}) {
  const renderedSubject = renderPreview(template.subject, studioName);
  const renderedBody    = renderPreview(template.body,    studioName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Modal chrome header (dark, matches app) */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Eye size={14} style={{ color: "#D4A843" }} />
            <span className="text-sm font-semibold text-foreground">
              Preview — {meta.day}: {meta.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Email client chrome (light — emails render on white) */}
        <div className="overflow-y-auto" style={{ backgroundColor: "#f4f4f5" }}>
          {/* Email header meta */}
          <div
            className="px-6 py-4 space-y-1 border-b"
            style={{ backgroundColor: "#ffffff", borderColor: "#e4e4e7" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-14 shrink-0">From</span>
              <span className="text-sm text-gray-800">{studioName} &lt;noreply@indiethis.com&gt;</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-14 shrink-0">To</span>
              <span className="text-sm text-gray-800">Jordan &lt;jordan@example.com&gt;</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-14 shrink-0">Subject</span>
              <span className="text-sm font-semibold text-gray-900">{renderedSubject}</span>
            </div>
          </div>

          {/* Email body */}
          <div className="px-6 py-6" style={{ backgroundColor: "#ffffff", margin: "16px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            {/* Studio avatar / branding strip */}
            <div
              className="flex items-center gap-3 pb-5 mb-5"
              style={{ borderBottom: "1px solid #e4e4e7" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {studioName[0]?.toUpperCase() ?? "S"}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{studioName}</p>
                <p className="text-[11px] text-gray-500">via IndieThis</p>
              </div>
            </div>

            {/* Body text — preserve newlines */}
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {renderedBody}
            </div>

            {/* Footer */}
            <div
              className="mt-6 pt-5 text-[11px] text-gray-400"
              style={{ borderTop: "1px solid #e4e4e7" }}
            >
              You received this email because you recorded at {studioName}. Powered by IndieThis.
            </div>
          </div>

          {/* Sample data note */}
          <div className="px-6 pb-5">
            <p className="text-[11px] text-gray-500 text-center">
              Sample data — artistName: <strong>Jordan</strong> · sessionDate: <strong>March 15, 2026</strong> · prices from platform defaults
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  meta,
  template,
  studioName,
  onChange,
  onSave,
  onFieldFocus,
}: {
  meta: typeof STEP_META[number];
  template: EmailTemplate;
  studioName: string;
  onChange: (t: EmailTemplate) => void;
  onSave: () => Promise<void>;
  onFieldFocus: (field: "subject" | "body", el: HTMLInputElement | HTMLTextAreaElement) => void;
}) {
  const [open, setOpen]         = useState(meta.key === "day1");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      {previewing && (
        <PreviewModal
          meta={meta}
          template={template}
          studioName={studioName}
          onClose={() => setPreviewing(false)}
        />
      )}

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
          onClick={() => setOpen((v) => !v)}
        >
          {/* Step badge */}
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
          >
            {meta.day}
          </span>

          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{meta.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{meta.description}</p>
          </div>

          {/* Per-step toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ ...template, enabled: !template.enabled });
            }}
            className="shrink-0 transition-opacity"
            title={template.enabled ? "Disable this step" : "Enable this step"}
          >
            {template.enabled ? (
              <ToggleRight size={28} style={{ color: "#D4A843" }} />
            ) : (
              <ToggleLeft size={28} className="text-muted-foreground" />
            )}
          </button>

          {/* Expand chevron */}
          <div className="shrink-0 text-muted-foreground ml-1">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Expanded body */}
        {open && (
          <div
            className="px-5 pb-5 space-y-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Status line */}
            <p className="text-[11px] text-muted-foreground pt-3">
              Status:{" "}
              <span
                className="font-semibold"
                style={{ color: template.enabled ? "#34C759" : "var(--muted-foreground)" }}
              >
                {template.enabled
                  ? "Enabled — this email will send automatically"
                  : "Disabled — this step is skipped"}
              </span>
            </p>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subject Line
              </label>
              <input
                value={template.subject}
                onChange={(e) => onChange({ ...template, subject: e.target.value })}
                onFocus={(e) => onFieldFocus("subject", e.currentTarget)}
                className={inputCls}
                style={{ borderColor: "var(--border)" }}
                placeholder="Email subject…"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Body
              </label>
              <textarea
                value={template.body}
                onChange={(e) => onChange({ ...template, body: e.target.value })}
                onFocus={(e) => onFieldFocus("body", e.currentTarget)}
                rows={8}
                className={inputCls + " resize-y leading-relaxed"}
                style={{ borderColor: "var(--border)" }}
                placeholder="Email body…"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : saved ? (
                  <><Check size={14} /> Saved</>
                ) : (
                  "Save Template"
                )}
              </button>

              <button
                onClick={() => setPreviewing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <Eye size={14} />
                Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Active field tracking (for click-to-insert) ─────────────────────────────

type ActiveField = {
  stepKey: StepKey;
  field: "subject" | "body";
  el: HTMLInputElement | HTMLTextAreaElement;
};

export default function EmailSequencesPage() {
  const [loading, setLoading]               = useState(true);
  const [sequenceEnabled, setSequenceEnabled] = useState(false);
  const [templates, setTemplates]           = useState<EmailTemplates>(DEFAULTS);
  const [studioName, setStudioName]         = useState("Your Studio");

  const [masterSaving, setMasterSaving] = useState(false);
  const [masterSaved,  setMasterSaved]  = useState(false);

  // Track the last-focused subject/body field so variable clicks insert there
  const activeFieldRef = useRef<ActiveField | null>(null);
  const [hasActiveField, setHasActiveField] = useState(false);

  function handleFieldFocus(stepKey: StepKey, field: "subject" | "body", el: HTMLInputElement | HTMLTextAreaElement) {
    activeFieldRef.current = { stepKey, field, el };
    setHasActiveField(true);
  }

  function insertVariable(token: string) {
    const active = activeFieldRef.current;
    if (!active) return;
    const { stepKey, field, el } = active;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const newValue = el.value.slice(0, start) + token + el.value.slice(end);
    setTemplates((prev) => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], [field]: newValue },
    }));
    // Restore focus + cursor after React re-renders the controlled input
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // ── Load studio settings ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.studio;
        if (!s) return;
        if (s.name) setStudioName(s.name);
        setSequenceEnabled(s.emailSequenceEnabled ?? false);
        const raw = s.emailTemplates;
        if (raw && typeof raw === "object") {
          setTemplates({
            day1:  { ...DEFAULTS.day1,  ...(raw.day1  ?? {}) },
            day3:  { ...DEFAULTS.day3,  ...(raw.day3  ?? {}) },
            day7:  { ...DEFAULTS.day7,  ...(raw.day7  ?? {}) },
            day14: { ...DEFAULTS.day14, ...(raw.day14 ?? {}) },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Save a single step ─────────────────────────────────────────────────────
  async function saveStep(key: StepKey) {
    await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailTemplates: { ...templates, [key]: templates[key] },
      }),
    });
  }

  // ── Toggle master sequence ─────────────────────────────────────────────────
  async function handleMasterToggle() {
    const next = !sequenceEnabled;
    setSequenceEnabled(next);
    setMasterSaving(true);
    await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailSequenceEnabled: next }),
    });
    setMasterSaving(false);
    setMasterSaved(true);
    setTimeout(() => setMasterSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Sequences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Automatically follow up with artists after their session. Customize each step below.
        </p>
      </div>

      {/* Master toggle card */}
      <div
        className="rounded-2xl border p-5 flex items-center gap-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
        >
          <Mail size={18} style={{ color: "#D4A843" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Automated Follow-Up Sequence</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {sequenceEnabled
              ? "Enabled — emails send automatically after file delivery."
              : "Disabled — no automated emails will be sent."}
          </p>
        </div>
        <button
          onClick={handleMasterToggle}
          disabled={masterSaving}
          title={sequenceEnabled ? "Disable sequence" : "Enable sequence"}
          className="shrink-0"
        >
          {masterSaving ? (
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          ) : masterSaved ? (
            <Check size={20} style={{ color: "#34C759" }} />
          ) : sequenceEnabled ? (
            <ToggleRight size={32} style={{ color: "#D4A843" }} />
          ) : (
            <ToggleLeft size={32} className="text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Variable legend */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available Placeholder Variables
          </p>
          <p className="text-[11px] text-muted-foreground">
            {hasActiveField
              ? "Click any variable to insert at cursor"
              : "Focus a subject or body field, then click to insert"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VARIABLES.map(({ token, desc }) => (
            <div key={token} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => insertVariable(token)}
                title={hasActiveField ? `Insert ${token}` : "Focus a field first"}
                className="shrink-0 text-left transition-opacity hover:opacity-70 active:scale-95"
              >
                <code
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded-md leading-tight block"
                  style={{
                    backgroundColor: "rgba(212,168,67,0.1)",
                    color: "#D4A843",
                    border: "1px solid rgba(212,168,67,0.2)",
                    cursor: "pointer",
                  }}
                >
                  {token}
                </code>
              </button>
              <span className="text-[11px] text-muted-foreground leading-tight pt-0.5">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {STEP_META.map((meta) => (
          <StepCard
            key={meta.key}
            meta={meta}
            template={templates[meta.key]}
            studioName={studioName}
            onChange={(t) => setTemplates((prev) => ({ ...prev, [meta.key]: t }))}
            onSave={() => saveStep(meta.key)}
            onFieldFocus={(field, el) => handleFieldFocus(meta.key, field, el)}
          />
        ))}
      </div>
    </div>
  );
}
