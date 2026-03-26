"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus, Send, Download, Clock, CheckCircle2, AlertTriangle, Link2,
  ToggleLeft, ToggleRight, Mail, Eye, X, UploadCloud, FileAudio,
  FileImage, FileVideo, File as FileIcon, Loader2, Trash2,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadedFile = { name: string; url: string; size: number };

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "aiff", "flac", "ogg", "m4a"].includes(ext)) return FileAudio;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return FileVideo;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return FileImage;
  return FileIcon;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type QuickSend = {
  id: string;
  recipientEmail: string;
  recipientPhone: string | null;
  message: string | null;
  fileUrls: string[];
  token: string;
  expiresAt: string;
  downloadedAt: string | null;
  sendFollowUpSequence: boolean;
  createdAt: string;
};

type Contact = { id: string; name: string; email: string | null; phone: string | null };

type StudioSettings = {
  emailSequenceEnabled: boolean;
  name: string;
  phone?: string | null;
};

// ─── Services ─────────────────────────────────────────────────────────────────

const SERVICES = [
  { key: "mastering",   label: "Mastering",   price: PRICING_DEFAULTS.AI_MASTERING.display },
  { key: "coverArt",    label: "Cover Art",    price: PRICING_DEFAULTS.AI_COVER_ART.display },
  { key: "arReport",    label: "A&R Report",   price: PRICING_DEFAULTS.AI_AAR_REPORT.display },
  { key: "pressKit",    label: "Press Kit",    price: PRICING_DEFAULTS.AI_PRESS_KIT.display },
  { key: "lyricVideo",  label: "Lyric Video",  price: PRICING_DEFAULTS.AI_LYRIC_VIDEO.display },
  { key: "aiVideo",     label: "AI Video",     price: `from ${PRICING_DEFAULTS.AI_VIDEO_SHORT.display}` },
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { dayKey: "day1",  label: "Day 1",  offsetDays: 0  },
  { dayKey: "day3",  label: "Day 3",  offsetDays: 3  },
  { dayKey: "day7",  label: "Day 7",  offsetDays: 7  },
  { dayKey: "day14", label: "Day 14", offsetDays: 14 },
] as const;

type DayKey = (typeof STEPS)[number]["dayKey"];

type StepDraft = {
  enabled:  boolean;
  services: ServiceKey[];
  subject:  string;
  body:     string;
};

// ─── Auto-generate email copy ─────────────────────────────────────────────────

function servicePrice(key: ServiceKey): string {
  return SERVICES.find((s) => s.key === key)?.price ?? "";
}
function serviceLabel(key: ServiceKey): string {
  return SERVICES.find((s) => s.key === key)?.label ?? key;
}

function generateEmail(
  dayKey: DayKey,
  services: ServiceKey[],
  opts: { contactName: string; studioName: string; studioPhone?: string | null }
): { subject: string; body: string } {
  const { contactName, studioName, studioPhone } = opts;
  const greeting = `Hey ${contactName},`;
  const sign = studioPhone ? `\n\n— ${studioName}\n${studioPhone}` : `\n\n— ${studioName}`;

  const pitches = services
    .map((k) => `• ${serviceLabel(k)} — ${servicePrice(k)}`)
    .join("\n");

  // Subject
  let subject = "";
  if (dayKey === "day1") {
    subject = "Your session files are ready";
  } else if (services.length === 0) {
    subject =
      dayKey === "day3" ? "Following up on your session" :
      dayKey === "day7" ? "Artists are finishing their projects" :
                          "A quick note from the studio";
  } else if (services.length === 1) {
    subject = `${serviceLabel(services[0])} — take your track further`;
  } else {
    subject = `${serviceLabel(services[0])} + ${services.length - 1} more — upgrade your track`;
  }

  // Body
  let body = "";
  if (dayKey === "day1") {
    const downloadLine =
      "Your session files are ready to download: {downloadLink}";
    body = services.length === 0
      ? `${greeting} thanks for coming in to ${studioName}. ${downloadLine}.${sign}`
      : `${greeting} thanks for coming in to ${studioName}. ${downloadLine}.\n\nWant to take your track further?\n\n${pitches}${sign}`;

  } else if (dayKey === "day3") {
    body = services.length === 0
      ? `${greeting} just checking in from ${studioName}. How's the track coming along? Let us know if you need anything.${sign}`
      : `${greeting} just checking in from ${studioName}. Ready to take your track to the next level?\n\n${pitches}${sign}`;

  } else if (dayKey === "day7") {
    body = services.length === 0
      ? `${greeting} artists who recorded at ${studioName} are finishing their projects and getting their music out. Don't let yours sit in a folder.${sign}`
      : `${greeting} artists who recorded at ${studioName} are finishing their projects. Here's what's available to help you do the same:\n\n${pitches}${sign}`;

  } else {
    body = services.length === 0
      ? `${greeting} one last note from ${studioName} — your track deserves to be heard. If there's anything we can do to help you release it, reach out.${sign}`
      : `${greeting} one last note from ${studioName}. These tools are still available for your track:\n\n${pitches}${sign}`;
  }

  return { subject, body };
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  stepLabel,
  subject,
  body,
  studioName,
  onClose,
}: {
  stepLabel: string;
  subject:   string;
  body:      string;
  studioName: string;
  onClose:   () => void;
}) {
  // Substitute {downloadLink} with a sample URL for preview
  const previewBody    = body.replace(/\{downloadLink\}/g, "https://indiethis.com/dl/example-link");
  const previewSubject = subject;

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
        {/* Modal chrome */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Eye size={14} style={{ color: "#D4A843" }} />
            <span className="text-sm font-semibold text-foreground">Preview — {stepLabel}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Email client chrome */}
        <div className="overflow-y-auto" style={{ backgroundColor: "#f4f4f5" }}>
          <div
            className="px-6 py-4 space-y-1 border-b"
            style={{ backgroundColor: "#ffffff", borderColor: "#e4e4e7" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-14 shrink-0">From</span>
              <span className="text-sm text-gray-800">{studioName} &lt;noreply@indiethis.com&gt;</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-14 shrink-0">Subject</span>
              <span className="text-sm font-semibold text-gray-900">{previewSubject || "(no subject)"}</span>
            </div>
          </div>

          <div
            className="px-6 py-6 mx-4 my-4 rounded-xl"
            style={{ backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center gap-3 pb-5 mb-5" style={{ borderBottom: "1px solid #e4e4e7" }}>
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
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{previewBody || "(no body)"}</div>
            <div className="mt-6 pt-5 text-[11px] text-gray-400" style={{ borderTop: "1px solid #e4e4e7" }}>
              You received this email because you recorded at {studioName}. Powered by IndieThis.
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center pb-5">
            Sample — {"{downloadLink}"} replaced with example URL
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  draft,
  contactName,
  studioName,
  studioPhone,
  onChange,
}: {
  step:       typeof STEPS[number];
  draft:      StepDraft;
  contactName: string;
  studioName:  string;
  studioPhone?: string | null;
  onChange:    (d: StepDraft) => void;
}) {
  const [previewing, setPreviewing] = useState(false);

  function toggleService(key: ServiceKey) {
    const next: ServiceKey[] = draft.services.includes(key)
      ? draft.services.filter((s) => s !== key)
      : [...draft.services, key];
    const { subject, body } = generateEmail(step.dayKey, next, { contactName, studioName, studioPhone });
    onChange({ ...draft, services: next, subject, body });
  }

  function handleSubjectChange(v: string) {
    onChange({ ...draft, subject: v });
  }
  function handleBodyChange(v: string) {
    onChange({ ...draft, body: v });
  }

  return (
    <>
      {previewing && (
        <PreviewModal
          stepLabel={step.label}
          subject={draft.subject}
          body={draft.body}
          studioName={studioName}
          onClose={() => setPreviewing(false)}
        />
      )}

      <div
        className="rounded-xl border overflow-hidden"
        style={{
          borderColor: draft.enabled ? "rgba(212,168,67,0.35)" : "var(--border)",
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              if (enabled && !draft.subject) {
                // Auto-generate on first enable
                const gen = generateEmail(step.dayKey, draft.services, { contactName, studioName, studioPhone });
                onChange({ ...draft, enabled, ...gen });
              } else {
                onChange({ ...draft, enabled });
              }
            }}
            className="w-4 h-4 shrink-0 accent-[#D4A843]"
          />
          <span
            className="text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: draft.enabled ? "rgba(212,168,67,0.12)" : "rgba(255,255,255,0.05)",
              color: draft.enabled ? "#D4A843" : "var(--muted-foreground)",
            }}
          >
            {step.label}
          </span>
          <span className="text-xs text-muted-foreground flex-1 truncate">
            {draft.enabled && draft.subject ? draft.subject : draft.enabled ? "No subject yet" : "Skipped"}
          </span>
          {draft.enabled && (
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Eye size={12} />
              Preview
            </button>
          )}
        </div>

        {/* Expanded content */}
        {draft.enabled && (
          <div
            className="px-3.5 pb-3.5 pt-2 space-y-3 border-t"
            style={{ borderColor: "rgba(212,168,67,0.2)" }}
          >
            {/* Service buttons */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Include a pitch for
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICES.map((svc) => {
                  const selected = draft.services.includes(svc.key);
                  return (
                    <button
                      key={svc.key}
                      type="button"
                      onClick={() => toggleService(svc.key)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={{
                        backgroundColor: selected ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.04)",
                        color:           selected ? "#D4A843"               : "var(--muted-foreground)",
                        border:          selected ? "1px solid rgba(212,168,67,0.4)" : "1px solid var(--border)",
                      }}
                    >
                      {svc.label} <span style={{ opacity: 0.7 }}>{svc.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subject
              </label>
              <input
                value={draft.subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Email subject…"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Message
              </label>
              <textarea
                value={draft.body}
                onChange={(e) => handleBodyChange(e.target.value)}
                rows={5}
                placeholder="Email body…"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-y focus:ring-2 focus:ring-accent/40 transition-shadow leading-relaxed"
                style={{ borderColor: "var(--border)" }}
              />
              {step.dayKey === "day1" && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  <code className="font-mono" style={{ color: "#D4A843" }}>{"{downloadLink}"}</code>{" "}
                  will be replaced with the actual download URL when files are sent.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliverPage() {
  const [sends, setSends]       = useState<QuickSend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [copied, setCopied]               = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);
  const [studioSettings, setStudioSettings] = useState<StudioSettings | null>(null);

  // Form state
  const [contactId, setContactId]           = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [uploadedFiles, setUploadedFiles]   = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage]               = useState("");
  const [sendFollowUp, setSendFollowUp]     = useState(false);
  const [sendSms, setSendSms]               = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload, isUploading } = useUploadThing("deliveryFiles", {
    onUploadProgress: (p) => setUploadProgress(p),
    onClientUploadComplete: (res) => {
      if (res) {
        setUploadedFiles((prev) => [
          ...prev,
          ...res.map((f) => ({ name: f.name, url: f.ufsUrl ?? f.url, size: f.size })),
        ]);
      }
      setUploadProgress(0);
    },
  });

  // Per-step drafts
  const buildDefaultDrafts = (opts: { contactName: string; studioName: string; studioPhone?: string | null }): Record<DayKey, StepDraft> => ({
    day1:  { enabled: true,  services: [], ...generateEmail("day1",  [], opts) },
    day3:  { enabled: true,  services: [], ...generateEmail("day3",  [], opts) },
    day7:  { enabled: true,  services: [], ...generateEmail("day7",  [], opts) },
    day14: { enabled: false, services: [], ...generateEmail("day14", [], opts) },
  });

  const [stepDrafts, setStepDrafts] = useState<Record<DayKey, StepDraft>>(() =>
    buildDefaultDrafts({ contactName: "there", studioName: "the studio" })
  );

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/studio/quick-send").then((r) => r.json()),
      fetch("/api/studio/contacts").then((r) => r.json()),
      fetch("/api/studio/settings").then((r) => r.json()),
    ]).then(([qs, con, settingsRes]) => {
      setSends(qs.sends ?? []);
      setContacts(con.contacts ?? []);
      const s: StudioSettings | null = settingsRes?.studio ?? null;
      setStudioSettings(s);
      setSendFollowUp(Boolean(s?.emailSequenceEnabled));
      // Regenerate drafts with real studio name/phone
      if (s) {
        setStepDrafts(buildDefaultDrafts({
          contactName: "there",
          studioName:  s.name,
          studioPhone: s.phone,
        }));
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Contact selection ──────────────────────────────────────────────────────
  function handleContactChange(id: string) {
    setContactId(id);
    const c = contacts.find((c) => c.id === id);
    if (c?.email) setRecipientEmail(c.email);
    if (c?.phone) {
      setRecipientPhone(c.phone);
      setSendSms(true);
    } else {
      setRecipientPhone("");
      setSendSms(false);
    }

    // Re-generate drafts with the contact's actual name
    const contactName = c?.name || "there";
    setStepDrafts(
      buildDefaultDrafts({
        contactName,
        studioName:  studioSettings?.name ?? "the studio",
        studioPhone: studioSettings?.phone,
      })
    );
  }

  // Contact name for display + generation
  const selectedContact = contacts.find((c) => c.id === contactId);
  const contactName     = selectedContact?.name || "this client";
  const genName         = selectedContact?.name || "there";

  function updateStepDraft(dayKey: DayKey, draft: StepDraft) {
    setStepDrafts((prev) => ({ ...prev, [dayKey]: draft }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const urls = uploadedFiles.map((f) => f.url);
    if (!recipientEmail || urls.length === 0) return;
    setCreating(true);

    // Collect enabled steps with non-empty content
    const emailSteps = sendFollowUp
      ? STEPS
          .filter(({ dayKey }) => stepDrafts[dayKey].enabled)
          .map(({ dayKey }) => ({
            dayKey,
            subject: stepDrafts[dayKey].subject.trim(),
            body:    stepDrafts[dayKey].body.trim(),
          }))
          .filter((s) => s.subject && s.body)
      : [];

    try {
      const res = await fetch("/api/studio/quick-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId:           contactId || undefined,
          recipientEmail,
          recipientPhone:      sendSms ? recipientPhone : undefined,
          fileUrls:            urls,
          message,
          sendFollowUpSequence: emailSteps.length > 0,
          emailSteps:          emailSteps.length > 0 ? emailSteps : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSends((prev) => [data.send, ...prev]);
        setShowCreate(false);
        setContactId(""); setRecipientEmail(""); setRecipientPhone("");
        setUploadedFiles([]); setMessage(""); setSendSms(false);
        setSendFollowUp(Boolean(studioSettings?.emailSequenceEnabled));
        setStepDrafts(buildDefaultDrafts({
          contactName: "there",
          studioName:  studioSettings?.name ?? "the studio",
          studioPhone: studioSettings?.phone,
        }));
      }
    } finally {
      setCreating(false);
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/dl/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((prev) => prev === id ? null : prev), 3000);
      return;
    }
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/studio/quick-send/${id}`, { method: "DELETE" });
      setSends((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function getStatus(s: QuickSend) {
    if (s.downloadedAt)
      return { label: "Downloaded", color: "text-emerald-400", icon: CheckCircle2 };
    if (new Date(s.expiresAt) < new Date())
      return { label: "Expired", color: "text-red-400", icon: AlertTriangle };
    return { label: "Pending", color: "text-yellow-400", icon: Clock };
  }

  const sequenceActive = Boolean(studioSettings?.emailSequenceEnabled);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">File Delivery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send files directly to clients</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          {showCreate ? "Cancel" : "New Send"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold text-foreground">Send Files</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contact (optional)
              </label>
              <select
                value={contactId}
                onChange={(e) => handleContactChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", colorScheme: "dark" }}
              >
                <option value="">Select a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient Email *
              </label>
              <input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Also send SMS
                </label>
                <button
                  type="button"
                  onClick={() => setSendSms((v) => !v)}
                  className="shrink-0"
                  title={sendSms ? "Disable SMS" : "Enable SMS"}
                >
                  {sendSms ? (
                    <ToggleRight size={22} style={{ color: "#D4A843" }} />
                  ) : (
                    <ToggleLeft size={22} className="text-muted-foreground" />
                  )}
                </button>
              </div>
              {sendSms && (
                <input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          </div>

          {/* ── File Upload ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Files *
            </label>

            {/* Drop zone */}
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                if (files.length && !isUploading) await startUpload(files);
              }}
              className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 cursor-pointer transition-colors hover:border-accent/40 hover:bg-white/2"
              style={{ borderColor: isUploading ? "rgba(212,168,67,0.5)" : "var(--border)" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) await startUpload(files);
                  e.target.value = "";
                }}
              />
              {isUploading ? (
                <>
                  <Loader2 size={22} className="animate-spin" style={{ color: "#D4A843" }} />
                  <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
                  <div
                    className="absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%`, backgroundColor: "#D4A843" }}
                  />
                </>
              ) : (
                <>
                  <UploadCloud size={22} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Drop files here or <span style={{ color: "#D4A843" }}>browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Audio, video, images, PDF — up to 512 MB each · 20 files max
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Uploaded file chips */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5">
                {uploadedFiles.map((f, i) => {
                  const Icon = fileIcon(f.name);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 border"
                      style={{ borderColor: "rgba(212,168,67,0.25)", backgroundColor: "rgba(212,168,67,0.05)" }}
                    >
                      <Icon size={14} style={{ color: "#D4A843" }} className="shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready to send
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Here are your files from today's session!"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* ── Follow-up sequence ───────────────────────────────────────── */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: sendFollowUp ? "rgba(212,168,67,0.4)" : "var(--border)",
            }}
          >
            {/* Toggle row */}
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
              >
                <Mail size={15} style={{ color: "#D4A843" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Send follow-up emails to {contactName}
                </p>
                {!sequenceActive && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Sequence disabled in{" "}
                    <Link href="/studio/settings" className="underline" style={{ color: "#D4A843" }}>
                      Studio Settings
                    </Link>
                  </p>
                )}
              </div>
              <button
                onClick={() => setSendFollowUp((v) => !v)}
                disabled={!sequenceActive}
                className="shrink-0 disabled:opacity-40"
                title={sendFollowUp ? "Disable follow-up for this send" : "Enable follow-up for this send"}
              >
                {sendFollowUp ? (
                  <ToggleRight size={28} style={{ color: "#D4A843" }} />
                ) : (
                  <ToggleLeft size={28} className="text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Step rows — shown when toggled on */}
            {sendFollowUp && (
              <div
                className="border-t px-3.5 pb-3.5 pt-3 space-y-2"
                style={{ borderColor: "rgba(212,168,67,0.2)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Compose each email step
                </p>
                {STEPS.map((step) => (
                  <StepRow
                    key={step.dayKey}
                    step={step}
                    draft={stepDrafts[step.dayKey]}
                    contactName={genName}
                    studioName={studioSettings?.name ?? "the studio"}
                    studioPhone={studioSettings?.phone}
                    onChange={(d) => updateStepDraft(step.dayKey, d)}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !recipientEmail || uploadedFiles.length === 0 || isUploading}
            className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {creating ? "Sending…" : isUploading ? "Uploading…" : `Send ${uploadedFiles.length > 0 ? `${uploadedFiles.length} File${uploadedFiles.length !== 1 ? "s" : ""}` : "Files"}`}
          </button>
        </div>
      )}

      {/* Send list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-[1fr_60px_110px_130px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span>Recipient</span>
          <span className="text-center">Files</span>
          <span>Status</span>
          <span className="text-right pr-1">Actions</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sends.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Send size={32} className="mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No sends yet. Create your first one above.</p>
          </div>
        ) : (
          sends.map((s) => {
            const st = getStatus(s);
            const StatusIcon = st.icon;
            const expires   = new Date(s.expiresAt);
            const isExpired = expires < new Date();
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_60px_110px_130px] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Recipient */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.recipientEmail}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {!isExpired && ` · expires ${expires.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                    {s.sendFollowUpSequence && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                        title="Follow-up sequence queued"
                      >
                        <Mail size={9} />
                        Follow-up on
                      </span>
                    )}
                  </div>
                </div>

                {/* Files */}
                <span className="text-sm text-muted-foreground text-center">
                  {s.fileUrls.length}
                </span>

                {/* Status */}
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${st.color}`}>
                  <StatusIcon size={12} className="shrink-0" />
                  {st.label}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => copyLink(s.token)}
                    title="Copy download link"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Link2 size={12} />
                    {copied === s.token ? "Copied!" : "Link"}
                  </button>
                  <a
                    href={`/dl/${s.token}`}
                    target="_blank"
                    title="Open download page"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Eye size={14} />
                  </a>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    title={confirmDelete === s.id ? "Click again to confirm" : "Delete"}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{
                      color: confirmDelete === s.id ? "#ef4444" : "var(--muted-foreground)",
                      backgroundColor: confirmDelete === s.id ? "rgba(239,68,68,0.08)" : "transparent",
                    }}
                  >
                    {deleting === s.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                    {confirmDelete === s.id && <span>Delete?</span>}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
