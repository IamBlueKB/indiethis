"use client";

import { useEffect, useState, useRef } from "react";
import { Mail, Send, Users, CheckCircle2, Clock, Plus, X, Paperclip, Loader2, ChevronDown } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

type Campaign = {
  id: string;
  subject: string;
  body: string;
  recipientCount: number;
  openCount: number;
  sentAt: string | null;
  createdAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  BOOKING:  "Booking",
  INQUIRY:  "Inquiry",
  MANUAL:   "Manual",
  WALK_IN:  "Walk-In",
  REFERRAL: "Referral",
};

export default function EmailPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [countBySource, setCountBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const { startUpload: uploadAttachments, isUploading: attachUploading } = useUploadThing("emailAttachments");

  useEffect(() => {
    fetch("/api/studio/email")
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns ?? []);
        setTotalContacts(d.totalContacts ?? 0);
        setCountBySource(d.countBySource ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSend(sendNow: boolean) {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/studio/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, sendNow, attachmentUrls, sourceFilter: sourceFilter || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns((prev) => [data.campaign, ...prev]);
        setSubject(""); setBody(""); setSourceFilter(""); setAttachmentUrls([]); setAttachmentNames([]); setComposing(false);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Blasts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send updates to your contacts</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> Compose
        </button>
      </div>

      {/* Stat */}
      <div
        className="rounded-xl border px-5 py-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <Users size={16} className="text-accent" />
        <div>
          <p className="text-sm font-semibold text-foreground">{totalContacts} contacts</p>
          <p className="text-xs text-muted-foreground">Will receive your next email blast</p>
        </div>
      </div>

      {/* Compose form */}
      {composing && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">New Campaign</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New tracks dropping Friday 🔥"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Recipient segmentation */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send To</label>
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50 pr-8"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                <option value="">All contacts ({totalContacts})</option>
                {Object.entries(countBySource).map(([val, cnt]) => {
                  const lbl = SOURCE_LABEL[val] ?? val.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <option key={val} value={val}>
                      {lbl} only ({cnt})
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write your message here…"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attachments</label>
            {attachmentNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachmentNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>
                    <Paperclip size={11} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground max-w-[120px] truncate">{name}</span>
                    <button type="button" onClick={() => {
                      setAttachmentUrls((p) => p.filter((_, j) => j !== i));
                      setAttachmentNames((p) => p.filter((_, j) => j !== i));
                    }} className="text-muted-foreground hover:text-red-400 shrink-0"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
            {attachmentNames.length < 5 && (
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={attachUploading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                {attachUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                {attachUploading ? "Uploading…" : "Attach file"}
                <span className="text-[10px]">PDF · Image · Audio — 10 MB max</span>
              </button>
            )}
            <input
              ref={attachInputRef}
              type="file"
              accept=".pdf,image/*,audio/*"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                const result = await uploadAttachments(files.slice(0, 5 - attachmentNames.length));
                if (result) {
                  setAttachmentUrls((p) => [...p, ...result.map((f) => f.ufsUrl ?? f.url)]);
                  setAttachmentNames((p) => [...p, ...result.map((f) => f.name)]);
                }
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSend(true)}
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Send size={14} />
              {sending ? "Sending…" : `Send to ${sourceFilter ? (countBySource[sourceFilter] ?? 0) : totalContacts} contacts`}
            </button>
            <button
              onClick={() => handleSend(false)}
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50 text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--border)" }}
            >
              Save Draft
            </button>
          </div>
        </div>
      )}

      {/* Campaign history */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Mail size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No campaigns yet</p>
          <p className="text-xs text-muted-foreground">Click Compose to send your first email blast.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campaign History</p>
          </div>
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-4 px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {c.sentAt ? (
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Clock size={13} className="text-yellow-400 shrink-0" />
                  )}
                  <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.body}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {c.sentAt
                    ? new Date(c.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Draft"}
                </p>
                {c.sentAt && (
                  <div className="flex items-center gap-3 justify-end text-xs text-muted-foreground">
                    <span><span className="font-semibold text-foreground">{c.recipientCount}</span> sent</span>
                    <span><span className="font-semibold text-accent">{c.openCount}</span> opened</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
