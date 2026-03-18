"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Send, Download, Clock, CheckCircle2, AlertTriangle, Link2,
  ToggleLeft, ToggleRight, Mail, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Contact = { id: string; name: string; email: string | null };

type StudioSettings = {
  emailSequenceEnabled: boolean;
  emailTemplates: Record<string, unknown> | null;
  name: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function templatesConfigured(settings: StudioSettings | null): boolean {
  if (!settings?.emailTemplates) return false;
  const t = settings.emailTemplates as Record<string, { subject?: string; body?: string }>;
  // Consider configured if at least day1 has a non-empty subject
  return Boolean(t.day1?.subject?.trim());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliverPage() {
  const [sends, setSends]       = useState<QuickSend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [copied, setCopied]         = useState<string | null>(null);
  const [studioSettings, setStudioSettings] = useState<StudioSettings | null>(null);

  // Form state
  const [contactId, setContactId]         = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [fileUrls, setFileUrls]             = useState("");
  const [message, setMessage]               = useState("");
  const [sendFollowUp, setSendFollowUp]     = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/studio/quick-send").then((r) => r.json()),
      fetch("/api/studio/contacts").then((r) => r.json()),
      fetch("/api/studio/settings").then((r) => r.json()),
    ]).then(([qs, con, settings]) => {
      setSends(qs.sends ?? []);
      setContacts(con.contacts ?? []);
      const s: StudioSettings | null = settings?.studio ?? null;
      setStudioSettings(s);
      // Default toggle: on only if sequence is enabled AND templates exist
      setSendFollowUp(
        Boolean(s?.emailSequenceEnabled) && templatesConfigured(s)
      );
      setLoading(false);
    });
  }, []);

  // ── Pre-fill email when contact selected ──────────────────────────────────
  function handleContactChange(id: string) {
    setContactId(id);
    const c = contacts.find((c) => c.id === id);
    if (c?.email) setRecipientEmail(c.email);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const urls = fileUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!recipientEmail || urls.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/studio/quick-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId || undefined,
          recipientEmail,
          recipientPhone,
          fileUrls: urls,
          message,
          sendFollowUpSequence: sendFollowUp,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSends((prev) => [data.send, ...prev]);
        setShowCreate(false);
        setContactId(""); setRecipientEmail(""); setRecipientPhone("");
        setFileUrls(""); setMessage("");
        // Reset toggle to studio default for next send
        setSendFollowUp(
          Boolean(studioSettings?.emailSequenceEnabled) && templatesConfigured(studioSettings)
        );
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

  function getStatus(s: QuickSend) {
    if (s.downloadedAt)
      return { label: "Downloaded", color: "text-emerald-400", icon: CheckCircle2 };
    if (new Date(s.expiresAt) < new Date())
      return { label: "Expired", color: "text-red-400", icon: AlertTriangle };
    return { label: "Pending", color: "text-yellow-400", icon: Clock };
  }

  const hasTemplates   = templatesConfigured(studioSettings);
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
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient Phone (SMS)
              </label>
              <input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File URLs * <span className="normal-case font-normal">(one per line)</span>
            </label>
            <textarea
              value={fileUrls}
              onChange={(e) => setFileUrls(e.target.value)}
              rows={3}
              placeholder={"https://storage.example.com/track.mp3\nhttps://storage.example.com/stems.zip"}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
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

          {/* ── Follow-up sequence toggle ──────────────────────────────────── */}
          <div
            className="rounded-xl border p-3.5 flex items-start gap-3"
            style={{
              borderColor: sendFollowUp ? "rgba(212,168,67,0.4)" : "var(--border)",
              backgroundColor: sendFollowUp ? "rgba(212,168,67,0.05)" : "transparent",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
            >
              <Mail size={15} style={{ color: "#D4A843" }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Send follow-up email sequence to this client
              </p>

              {hasTemplates ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {sendFollowUp
                    ? "Day 1, 3, 7, and 14 follow-up emails will queue after delivery."
                    : "No follow-up emails will be sent for this delivery."}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" />
                  Templates not configured.{" "}
                  <Link
                    href="/studio/settings/email-sequences"
                    className="underline"
                    style={{ color: "#D4A843" }}
                  >
                    Set up your follow-up emails first
                  </Link>
                </p>
              )}

              {!sequenceActive && hasTemplates && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" />
                  Sequence is disabled globally.{" "}
                  <Link
                    href="/studio/settings/email-sequences"
                    className="underline"
                    style={{ color: "#D4A843" }}
                  >
                    Enable it in settings
                  </Link>
                </p>
              )}
            </div>

            <button
              onClick={() => setSendFollowUp((v) => !v)}
              title={sendFollowUp ? "Disable follow-up for this send" : "Enable follow-up for this send"}
              className="shrink-0"
            >
              {sendFollowUp ? (
                <ToggleRight size={28} style={{ color: "#D4A843" }} />
              ) : (
                <ToggleLeft size={28} className="text-muted-foreground" />
              )}
            </button>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !recipientEmail || !fileUrls.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {creating ? "Sending…" : "Send Files"}
          </button>
        </div>
      )}

      {/* Send list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-[1fr_100px_120px_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span>Recipient</span>
          <span>Files</span>
          <span>Status</span>
          <span>Actions</span>
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
            const expires  = new Date(s.expiresAt);
            const isExpired = expires < new Date();
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_100px_120px_auto] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.recipientEmail}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
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
                <span className="text-sm text-muted-foreground">
                  {s.fileUrls.length} file{s.fileUrls.length !== 1 ? "s" : ""}
                </span>
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${st.color}`}>
                  <StatusIcon size={13} />
                  {st.label}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyLink(s.token)}
                    title="Copy download link"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Link2 size={13} />
                    {copied === s.token ? "Copied!" : "Copy Link"}
                  </button>
                  <a
                    href={`/dl/${s.token}`}
                    target="_blank"
                    title="Preview download page"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Download size={14} />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
