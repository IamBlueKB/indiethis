"use client";

import { useEffect, useState } from "react";
import {
  Mail, ChevronDown, ChevronUp, Check, Loader2, ToggleLeft, ToggleRight,
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

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: EmailTemplates = {
  day1: {
    enabled: true,
    subject: "Your session files are ready, {artistName}!",
    body: `Hey {artistName},

Your session files from {studioName} are ready for download. We had an amazing time working with you!

Download your files here: {downloadLink}

This link is available for 30 days, so grab your files when you're ready.

If you have any questions or need anything else, give us a call at {studioPhone}.

Looking forward to the next one,
{studioName}`,
  },
  day3: {
    enabled: true,
    subject: "How are your session files sounding, {artistName}?",
    body: `Hey {artistName},

Just checking in — how are your files from {studioName} sounding?

If you haven't had a chance to download them yet, here's your link again: {downloadLink}

Ready to take your track to the next level? We offer professional mastering starting at {masteringPrice} and AI-generated cover art starting at {coverArtPrice}. Reply to this email or call us at {studioPhone} and we'll get you set up.

Talk soon,
{studioName}`,
  },
  day7: {
    enabled: true,
    subject: "{artistName}, your track deserves to be heard",
    body: `Hey {artistName},

It's been a week since your session at {studioName} — how's the track coming along?

We love helping artists like you get their music out into the world. If you're thinking about your next release, we'd love to help with:

• Professional mastering (starting at {masteringPrice})
• AI cover art generation (starting at {coverArtPrice})
• A&R report to sharpen your sound (starting at {arReportPrice})

When you're ready to book your next session, you know where to find us.

Keep creating,
{studioName}
{studioPhone}`,
  },
  day14: {
    enabled: false,
    subject: "Stay sharp between sessions, {artistName}",
    body: `Hey {artistName},

It's been two weeks since your session at {studioName}. We hope the track is sounding great!

We wanted to reach out because we know consistent recording is key to growing as an artist. Our clients who book regularly tend to release more music and grow their audience faster.

If budget is a concern, ask us about our monthly session packages — we work with artists at every level.

Book your next session or reach us anytime at {studioPhone}.

Keep grinding,
{studioName}`,
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

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  meta,
  template,
  onChange,
  onSave,
}: {
  meta: typeof STEP_META[number];
  template: EmailTemplate;
  onChange: (t: EmailTemplate) => void;
  onSave: () => Promise<void>;
}) {
  const [open, setOpen] = useState(meta.key === "day1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
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

        {/* Toggle */}
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

      {/* Body */}
      {open && (
        <div
          className="px-5 pb-5 space-y-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Enabled status line */}
          <p className="text-[11px] text-muted-foreground pt-3">
            Status:{" "}
            <span
              className="font-semibold"
              style={{ color: template.enabled ? "#34C759" : "var(--muted-foreground)" }}
            >
              {template.enabled ? "Enabled — this email will send automatically" : "Disabled — this step is skipped"}
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
              rows={12}
              className={inputCls + " resize-y leading-relaxed"}
              style={{ borderColor: "var(--border)" }}
              placeholder="Email body…"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-1">
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
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailSequencesPage() {
  const [loading, setLoading] = useState(true);
  const [sequenceEnabled, setSequenceEnabled] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplates>(DEFAULTS);

  // Master save state
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterSaved, setMasterSaved] = useState(false);

  // ── Load studio settings ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.studio;
        if (!s) return;
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

  // ── Toggle master sequence on/off ──────────────────────────────────────────
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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Available Placeholder Variables
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VARIABLES.map(({ token, desc }) => (
            <div key={token} className="flex items-start gap-2">
              <code
                className="text-[11px] font-mono px-1.5 py-0.5 rounded-md shrink-0 leading-tight"
                style={{
                  backgroundColor: "rgba(212,168,67,0.1)",
                  color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.2)",
                }}
              >
                {token}
              </code>
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
            onChange={(t) => setTemplates((prev) => ({ ...prev, [meta.key]: t }))}
            onSave={() => saveStep(meta.key)}
          />
        ))}
      </div>
    </div>
  );
}
