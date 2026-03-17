"use client";

import { useEffect, useState } from "react";
import { Plus, Send, Download, Clock, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";

type QuickSend = {
  id: string;
  recipientEmail: string;
  recipientPhone: string | null;
  message: string | null;
  fileUrls: string[];
  token: string;
  expiresAt: string;
  downloadedAt: string | null;
  createdAt: string;
};

type Contact = { id: string; name: string; email: string | null };

export default function DeliverPage() {
  const [sends, setSends] = useState<QuickSend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Form
  const [contactId, setContactId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [fileUrls, setFileUrls] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/studio/quick-send").then((r) => r.json()),
      fetch("/api/studio/contacts").then((r) => r.json()),
    ]).then(([qs, con]) => {
      setSends(qs.sends ?? []);
      setContacts(con.contacts ?? []);
      setLoading(false);
    });
  }, []);

  // Pre-fill email when contact selected
  function handleContactChange(id: string) {
    setContactId(id);
    const c = contacts.find((c) => c.id === id);
    if (c?.email) setRecipientEmail(c.email);
  }

  async function handleCreate() {
    const urls = fileUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!recipientEmail || urls.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/studio/quick-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contactId || undefined, recipientEmail, recipientPhone, fileUrls: urls, message }),
      });
      if (res.ok) {
        const data = await res.json();
        setSends((prev) => [data.send, ...prev]);
        setShowCreate(false);
        setContactId(""); setRecipientEmail(""); setRecipientPhone(""); setFileUrls(""); setMessage("");
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
    if (s.downloadedAt) return { label: "Downloaded", color: "text-emerald-400", icon: CheckCircle2 };
    if (new Date(s.expiresAt) < new Date()) return { label: "Expired", color: "text-red-400", icon: AlertTriangle };
    return { label: "Pending", color: "text-yellow-400", icon: Clock };
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
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
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact (optional)</label>
              <select
                value={contactId}
                onChange={(e) => handleContactChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">Select a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient Email *</label>
              <input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient Phone (SMS)</label>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Here are your files from today's session!"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
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
            const expires = new Date(s.expiresAt);
            const isExpired = expires < new Date();
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_100px_120px_auto] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.recipientEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                    {!isExpired && ` · expires ${expires.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{s.fileUrls.length} file{s.fileUrls.length !== 1 ? "s" : ""}</span>
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
