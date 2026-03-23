"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Info, Loader2, Plus, Trash2, X, ExternalLink, Check } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = "track" | "streamLease" | "aiJob";

type LicenseDoc = {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  source: string;
  notes: string | null;
  createdAt: string;
};

// ─── Source config ────────────────────────────────────────────────────────────

type SourceConfig = {
  label: string;
  suggest: string;           // auto-suggested title when source is chosen
  color: string;             // badge background (rgba)
  textColor: string;
};

const SOURCE_CONFIG: Record<string, SourceConfig> = {
  SPLICE:           { label: "Splice",            suggest: "Splice License",              color: "rgba(52,199,89,0.15)",   textColor: "#34C759" },
  SUNO:             { label: "Suno",              suggest: "Suno Generation Receipt",     color: "rgba(147,51,234,0.15)",  textColor: "#9333EA" },
  UDIO:             { label: "Udio",              suggest: "Udio Generation Receipt",     color: "rgba(147,51,234,0.15)",  textColor: "#9333EA" },
  SOUNDRAW:         { label: "Soundraw",          suggest: "Soundraw License",            color: "rgba(147,51,234,0.15)",  textColor: "#9333EA" },
  LANDR:            { label: "LANDR",             suggest: "LANDR License",               color: "rgba(147,51,234,0.15)",  textColor: "#9333EA" },
  TRACKLIB:         { label: "Tracklib",          suggest: "Tracklib Sample License",     color: "rgba(212,168,67,0.15)",  textColor: "#D4A843" },
  LOOPCLOUD:        { label: "Loopcloud",         suggest: "Loopcloud License",           color: "rgba(52,199,89,0.15)",   textColor: "#34C759" },
  AI_GENERATION:    { label: "AI Generation",     suggest: "AI Generation Receipt",       color: "rgba(147,51,234,0.15)",  textColor: "#9333EA" },
  SAMPLE_CLEARANCE: { label: "Sample Clearance",  suggest: "Sample Clearance Agreement",  color: "rgba(212,168,67,0.15)",  textColor: "#D4A843" },
  WORK_FOR_HIRE:    { label: "Work for Hire",     suggest: "Work for Hire Agreement",     color: "rgba(59,130,246,0.15)",  textColor: "#3B82F6" },
  CUSTOM:           { label: "Custom",            suggest: "License Document",            color: "rgba(156,163,175,0.15)", textColor: "#9CA3AF" },
  OTHER:            { label: "Other",             suggest: "License Document",            color: "rgba(156,163,175,0.15)", textColor: "#9CA3AF" },
};

const SOURCE_OPTIONS = Object.entries(SOURCE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.OTHER;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
      style={{ backgroundColor: cfg.color, color: cfg.textColor }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="More info"
      >
        <Info size={13} />
      </button>
      {show && (
        <span
          className="absolute left-5 top-0 z-50 w-60 rounded-xl border text-xs p-3 shadow-xl"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LicenseAttachment({
  contentType,
  contentId,
}: {
  contentType: ContentType;
  contentId: string;
  optional?: boolean; // always optional — accepted but unused
}) {
  const [expanded, setExpanded]   = useState(false);
  const [docs, setDocs]           = useState<LicenseDoc[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);

  // Form state
  const [source, setSource]   = useState("SPLICE");
  const [title, setTitle]     = useState("");
  const [notes, setNotes]     = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);

  // Removal confirmation
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build query param based on contentType
  const queryParam =
    contentType === "track"       ? `trackId=${contentId}`
    : contentType === "streamLease" ? `streamLeaseId=${contentId}`
    : `aiJobId=${contentId}`;

  const bodyKey =
    contentType === "track"       ? "trackId"
    : contentType === "streamLease" ? "streamLeaseId"
    : "aiJobId";

  // Load existing docs when expanded
  useEffect(() => {
    if (!expanded || docsLoaded) return;
    fetch(`/api/dashboard/license-documents?${queryParam}`)
      .then((r) => r.json())
      .then((d: { docs: LicenseDoc[] }) => {
        setDocs(d.docs ?? []);
        setDocsLoaded(true);
      })
      .catch(() => setDocsLoaded(true));
  }, [expanded, docsLoaded, queryParam]);

  // Auto-suggest title when source changes (only if title is empty or was auto-suggested)
  const lastSuggested = useRef<string>("");
  function handleSourceChange(val: string) {
    setSource(val);
    const suggested = SOURCE_CONFIG[val]?.suggest ?? "License Document";
    if (!title || title === lastSuggested.current) {
      setTitle(suggested);
      lastSuggested.current = suggested;
    }
  }

  // UploadThing
  const { startUpload, isUploading } = useUploadThing("licenseDocument", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) { setFileUrl(url); }
    },
    onUploadError: () => {
      setAttachError("File upload failed. Try again.");
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileUrl(null);
    setAttachError(null);
    startUpload([file]);
    e.target.value = "";
  }

  async function handleAttach() {
    if (!fileUrl) { setAttachError("Please upload a file first."); return; }
    if (!title.trim()) { setAttachError("Please enter a title."); return; }

    setAttaching(true);
    setAttachError(null);
    try {
      const ext = (fileUrl.split(".").pop() ?? "pdf").toLowerCase();
      const fileType = ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "pdf";

      const res = await fetch("/api/dashboard/license-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          fileUrl,
          fileType,
          source,
          notes: notes.trim() || undefined,
          [bodyKey]: contentId,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setAttachError(d.error ?? "Something went wrong.");
        return;
      }
      const d = await res.json() as { doc: LicenseDoc };
      setDocs((prev) => [d.doc, ...prev]);
      // Reset form
      setFileUrl(null); setFileName(null);
      setTitle(""); setNotes("");
      setSource("SPLICE"); lastSuggested.current = "";
      setAttachSuccess(true);
      setTimeout(() => setAttachSuccess(false), 2500);
    } finally {
      setAttaching(false);
    }
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/dashboard/license-documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setRemovingId(null);
    }
  }

  const inputCls = "w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50";
  const borderStyle = { borderColor: "var(--border)" } as React.CSSProperties;

  return (
    <div className="rounded-xl border overflow-hidden" style={borderStyle}>
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/3"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Attach Licenses &amp; Receipts</span>
          {docs.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
            >
              {docs.length}
            </span>
          )}
          <InfoTooltip text="Upload proof of ownership for samples, AI-generated content, or licensed material. Private — only visible to you and IndieThis support." />
        </div>
        <ChevronDown
          size={14}
          className="text-muted-foreground transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>

          {/* ── Attach form ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Document</p>

            {/* Source + Title row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</label>
                <div className="relative">
                  <select
                    value={source}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer pr-7`}
                    style={borderStyle}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); lastSuggested.current = ""; }}
                  placeholder="e.g. Splice License — Piano Loop"
                  className={inputCls}
                  style={borderStyle}
                />
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">File</label>
              <div
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={borderStyle}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Uploading…
                  </div>
                ) : fileUrl ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-sm text-foreground truncate">{fileName ?? "File uploaded"}</span>
                    <button
                      type="button"
                      onClick={() => { setFileUrl(null); setFileName(null); }}
                      className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Plus size={14} />
                    Choose PDF, PNG, or JPG (max 10 MB)
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notes <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context about this license…"
                className={`${inputCls} resize-none`}
                style={borderStyle}
              />
            </div>

            {attachError && <p className="text-xs text-red-400">{attachError}</p>}

            <button
              type="button"
              onClick={handleAttach}
              disabled={attaching || isUploading || !fileUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {attachSuccess
                ? <><Check size={13} /> Attached</>
                : attaching
                ? <><Loader2 size={13} className="animate-spin" /> Attaching…</>
                : <><Plus size={13} /> Attach Document</>}
            </button>
          </div>

          {/* ── Attached documents list ── */}
          {docsLoaded && docs.length > 0 && (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attached ({docs.length})
              </p>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                  >
                    {/* Icon */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: "var(--border)" }}
                    >
                      <FileText size={13} className="text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SourceBadge source={doc.source} />
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {doc.notes && (
                        <p className="text-[11px] text-muted-foreground italic truncate">{doc.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
                        title="View document"
                      >
                        <ExternalLink size={13} />
                      </a>

                      {removingId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemove(doc.id)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                            style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemovingId(null)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemovingId(doc.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Remove document"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docsLoaded && docs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No documents attached yet.</p>
          )}

          {!docsLoaded && (
            <div className="flex items-center justify-center py-3">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
