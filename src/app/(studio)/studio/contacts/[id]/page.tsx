"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Instagram, Music2, DollarSign,
  Calendar, Send, FolderOpen, FileText, UserCircle2,
  MessageSquare, Link2, Pencil, Check, X, Youtube, Tag, MailX,
} from "lucide-react";

type ActivityLog = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
};

type YoutubeReference = {
  id: string;
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  authorName: string | null;
  projectTag: string | null;
  folder: string | null;
  createdAt: string;
};

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  instagramHandle: string | null;
  genre: string | null;
  notes: string | null;
  source: string;
  totalSpent: number;
  lastSessionDate: string | null;
  createdAt: string;
  sessions: { id: string; dateTime: string; sessionType: string | null; status: string }[];
  deliveredFiles: { id: string; fileName: string; deliveredAt: string }[];
  activityLog: ActivityLog[];
  aiVideoRequested: boolean;
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  INTAKE_SUBMITTED: FileText,
  BOOKING_CREATED: Calendar,
  FILE_DELIVERED: FolderOpen,
  QUICK_SEND: Send,
  INVOICE_SENT: FileText,
  INVOICE_PAID: DollarSign,
  INTAKE_LINK_SENT: Link2,
  NOTE_ADDED: MessageSquare,
  FORM_SUBMITTED: FileText,
  AI_VIDEO_REQUESTED: Tag,
};

const ACTIVITY_COLORS: Record<string, string> = {
  INTAKE_SUBMITTED: "text-blue-400",
  BOOKING_CREATED: "text-accent",
  FILE_DELIVERED: "text-emerald-400",
  QUICK_SEND: "text-blue-400",
  INVOICE_SENT: "text-yellow-400",
  INVOICE_PAID: "text-emerald-400",
  INTAKE_LINK_SENT: "text-muted-foreground",
  NOTE_ADDED: "text-muted-foreground",
  FORM_SUBMITTED: "text-blue-400",
  AI_VIDEO_REQUESTED: "text-purple-400",
};

const SOURCE_LABEL: Record<string, string> = {
  BOOKING:     "Booking",
  INQUIRY:     "Inquiry",
  MANUAL:      "Manual",
  WALK_IN:     "Walk-In",
  REFERRAL:    "Referral",
  INTAKE_FORM: "Intake Form",
  INSTAGRAM:   "Instagram",
};

type BadgeStyle = { bg: string; color: string; border: string };
const SOURCE_BADGE: Record<string, BadgeStyle> = {
  BOOKING:     { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", border: "rgba(34,197,94,0.25)"  },
  INQUIRY:     { bg: "rgba(212,168,67,0.12)", color: "#D4A843", border: "rgba(212,168,67,0.25)" },
  MANUAL:      { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  WALK_IN:     { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  REFERRAL:    { bg: "rgba(251,146,60,0.12)", color: "#fb923c", border: "rgba(251,146,60,0.25)" },
  INTAKE_FORM: { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", border: "rgba(34,197,94,0.25)"  },
  INSTAGRAM:   { bg: "rgba(168,85,247,0.12)", color: "#a855f7", border: "rgba(168,85,247,0.25)" },
};

const SESSION_STATUS_COLOR: Record<string, string> = {
  PENDING: "text-yellow-400",
  CONFIRMED: "text-blue-400",
  COMPLETED: "text-emerald-400",
  CANCELLED: "text-red-400",
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [youtubeRefs, setYoutubeRefs] = useState<YoutubeReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingEmailCount, setPendingEmailCount] = useState(0);
  const [cancellingSequence, setCancellingSequence] = useState(false);

  useEffect(() => {
fetch(`/api/studio/contacts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const aiVideoRequested = (d.contact?.activityLog ?? []).some(
          (a: ActivityLog) => a.type === "AI_VIDEO_REQUESTED"
        );
        setContact({ ...d.contact, aiVideoRequested });
        setNotes(d.contact?.notes ?? "");
        setYoutubeRefs(d.youtubeReferences ?? []);
        setPendingEmailCount(d.pendingEmailCount ?? 0);
        setLoading(false);
      });
  }, [id]);

  async function cancelSequence() {
    if (!contact || cancellingSequence) return;
    setCancellingSequence(true);
    try {
      const res = await fetch(`/api/studio/contacts/${id}/cancel-sequence`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPendingEmailCount(0);
        // Log a note in the UI via the contact's activityLog if desired — for now just clear count
        void data;
      }
    } finally {
      setCancellingSequence(false);
    }
  }

  async function saveNotes() {
    if (!contact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setContact((prev) => prev ? { ...prev, notes } : prev);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6 text-center text-muted-foreground">Contact not found.</div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/studio/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        <ArrowLeft size={14} /> Back to Contacts
      </Link>

      {/* Header */}
      <div
        className="rounded-2xl border p-6 flex items-start gap-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="shrink-0">
          {contact.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contact.photoUrl} alt={contact.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
            >
              {contact.name[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{contact.name}</h1>
            {contact.source && (() => {
              const style = SOURCE_BADGE[contact.source] ?? SOURCE_BADGE.MANUAL;
              return (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                >
                  {SOURCE_LABEL[contact.source] ?? contact.source}
                </span>
              );
            })()}
            {contact.aiVideoRequested && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f733" }}>
                🎬 AI Video requested — photo uploaded
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground no-underline">
                <Mail size={13} /> {contact.email}
              </a>
            )}
            {contact.phone && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone size={13} /> {contact.phone}
              </span>
            )}
            {contact.instagramHandle && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Instagram size={13} /> @{contact.instagramHandle}
              </span>
            )}
            {contact.genre && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Music2 size={13} /> {contact.genre}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-2">
          <div className="flex items-center gap-1 text-emerald-400 font-bold text-lg justify-end">
            <DollarSign size={16} />{contact.totalSpent.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Total Spent</p>
          {pendingEmailCount > 0 && (
            <button
              onClick={cancelSequence}
              disabled={cancellingSequence}
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
              title={`Cancel ${pendingEmailCount} pending follow-up email${pendingEmailCount === 1 ? "" : "s"}`}
            >
              <MailX size={12} />
              {cancellingSequence ? "Cancelling…" : `Cancel sequence (${pendingEmailCount})`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Left: Sessions + Files */}
        <div className="space-y-5">
          {/* Sessions */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
              <Calendar size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
            </div>
            {contact.sessions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              contact.sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(s.dateTime).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.sessionType ?? "Studio Session"}</p>
                  </div>
                  <span className={`text-xs font-semibold ${SESSION_STATUS_COLOR[s.status] ?? "text-muted-foreground"}`}>
                    {s.status}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Delivered Files */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
              <FolderOpen size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Delivered Files</h2>
            </div>
            {contact.deliveredFiles.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No files delivered yet.</p>
            ) : (
              contact.deliveredFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-5 py-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-sm text-foreground truncate">{f.fileName}</p>
                  <p className="text-xs text-muted-foreground shrink-0 ml-4">
                    {new Date(f.deliveredAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* YouTube References */}
          {youtubeRefs.length > 0 && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
                <Youtube size={15} className="text-red-400" />
                <h2 className="text-sm font-semibold text-foreground">Artist References</h2>
                <span className="ml-auto text-xs text-muted-foreground">{youtubeRefs.length} saved</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {youtubeRefs.map((ref) => (
                  <a
                    key={ref.id}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border overflow-hidden group no-underline block"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="relative">
                      <img
                        src={ref.thumbnailUrl}
                        alt={ref.title}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                          <Youtube size={14} className="text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{ref.title}</p>
                      {ref.authorName && (
                        <p className="text-[10px] text-muted-foreground">{ref.authorName}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ref.projectTag && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                            style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
                          >
                            <Tag size={7} /> {ref.projectTag}
                          </span>
                        )}
                        {ref.folder && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                            <FolderOpen size={7} /> {ref.folder}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
              </div>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={saveNotes} disabled={saving} className="p-1.5 rounded-lg text-emerald-400 hover:bg-white/5">
                    <Check size={13} />
                  </button>
                  <button onClick={() => { setEditing(false); setNotes(contact.notes ?? ""); }} className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/5">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            {editing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes about this contact…"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {contact.notes || "No notes yet. Click the pencil to add."}
              </p>
            )}
          </div>
        </div>

        {/* Right: Activity Log */}
        <div
          className="rounded-2xl border overflow-hidden h-fit"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <UserCircle2 size={15} className="text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          </div>
          {contact.activityLog.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="relative px-5 py-4">
              {/* Timeline line */}
              <div
                className="absolute left-[28px] top-4 bottom-4 w-px"
                style={{ backgroundColor: "var(--border)" }}
              />
              <div className="space-y-4">
                {contact.activityLog.map((log) => {
                  const Icon = ACTIVITY_ICONS[log.type] ?? MessageSquare;
                  const color = ACTIVITY_COLORS[log.type] ?? "text-muted-foreground";
                  return (
                    <div key={log.id} className="flex gap-3 relative">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10"
                        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                      >
                        <Icon size={13} className={color} />
                      </div>
                      <div className="pt-0.5 min-w-0">
                        <p className="text-xs text-foreground leading-snug">{log.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(log.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
