import { notFound }    from "next/navigation";
import Link            from "next/link";
import { db }          from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import {
  ChevronLeft, CheckCircle2, AlertCircle, Clock, Zap,
  DollarSign, User, Building2, Cpu,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_LABEL: Record<string, string> = {
  VIDEO:       "Music Video",
  COVER_ART:   "Cover Art",
  MASTERING:   "Mastering",
  LYRIC_VIDEO: "Lyric Video",
  AR_REPORT:   "A&R Report",
  PRESS_KIT:   "Press Kit",
};

const TOOL_COLOR: Record<string, string> = {
  VIDEO:       "#E85D4A",
  COVER_ART:   "#D4A843",
  MASTERING:   "#34C759",
  LYRIC_VIDEO: "#5AC8FA",
  AR_REPORT:   "#AF52DE",
  PRESS_KIT:   "#FF9F0A",
};

const COST_ESTIMATE: Record<string, number> = {
  VIDEO: 0.85, COVER_ART: 0.04, MASTERING: 0.12,
  LYRIC_VIDEO: 0.65, AR_REPORT: 0.22, PRESS_KIT: 0.18,
};

// ─── Helper components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-semibold uppercase tracking-wider w-32 shrink-0 pt-0.5"
        style={{ color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span className={`text-sm flex-1 break-all ${mono ? "font-mono text-xs" : ""}`}
        style={{ color: "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, color, children }: {
  title: string; icon: React.ElementType; color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}>
          <Icon size={14} style={{ color }} strokeWidth={1.75} />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  if (data == null) {
    return (
      <p className="text-xs py-3 text-muted-foreground italic">No data</p>
    );
  }
  return (
    <pre className="text-[11px] leading-relaxed overflow-x-auto py-3"
      style={{ color: "var(--muted-foreground)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AIJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireAdminAccess("ai-usage");
  const { jobId } = await params;

  const job = await db.aIJob.findUnique({
    where: { id: jobId },
  });
  if (!job) notFound();

  // Load triggeredBy user + optional artist + optional studio
  const [triggeredByUser, artistUser, studio] = await Promise.all([
    db.user.findUnique({
      where:  { id: job.triggeredById },
      select: { id: true, name: true, email: true, role: true },
    }),
    job.artistId
      ? db.user.findUnique({
          where:  { id: job.artistId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    job.studioId
      ? db.studio.findUnique({
          where:  { id: job.studioId },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const durationMs  = job.completedAt
    ? job.completedAt.getTime() - job.createdAt.getTime()
    : null;
  const durationStr = durationMs != null
    ? durationMs < 60_000
      ? `${(durationMs / 1000).toFixed(1)}s`
      : `${(durationMs / 60_000).toFixed(1)} min`
    : "—";

  const cost     = job.costToUs ?? COST_ESTIMATE[job.type] ?? 0;
  const revenue  = job.priceCharged ?? 0;
  const margin   = revenue - cost;
  const isFree   = revenue === 0;

  const toolColor = TOOL_COLOR[job.type] ?? "#999";

  const statusCfg: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    COMPLETE:   { color: "#34C759", icon: CheckCircle2, label: "Complete"   },
    FAILED:     { color: "#E85D4A", icon: AlertCircle,  label: "Failed"     },
    PROCESSING: { color: "#5AC8FA", icon: Zap,          label: "Processing" },
    QUEUED:     { color: "#FF9F0A", icon: Clock,        label: "Queued"     },
  };
  const sc = statusCfg[job.status] ?? statusCfg.QUEUED;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link href="/admin/ai-usage"
          className="flex items-center gap-1.5 text-xs font-medium transition-colors no-underline"
          style={{ color: "var(--muted-foreground)" }}>
          <ChevronLeft size={14} /> AI Usage
        </Link>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>/</span>
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {job.id.slice(0, 14)}…
        </span>
      </div>

      {/* ── Job header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${toolColor}18` }}>
          <Cpu size={22} style={{ color: toolColor }} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {TOOL_LABEL[job.type] ?? job.type}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${sc.color}18`, color: sc.color }}>
              <sc.icon size={11} strokeWidth={2.5} />
              {sc.label}
            </span>
            <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
              {job.id}
            </span>
          </div>
        </div>
      </div>

      {/* ── Metadata ───────────────────────────────────────────────────── */}
      <Section title="Job Metadata" icon={Cpu} color={toolColor}>
        <InfoRow label="Job ID"      value={job.id} mono />
        <InfoRow label="Type"        value={TOOL_LABEL[job.type] ?? job.type} />
        <InfoRow label="Status"      value={job.status} />
        <InfoRow label="Triggered by" value={job.triggeredBy} />
        <InfoRow label="Provider"    value={job.provider || "—"} />
        <InfoRow label="Created"     value={new Date(job.createdAt).toLocaleString()} />
        <InfoRow label="Completed"
          value={job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"} />
        <InfoRow label="Duration"    value={durationStr} />
        {job.errorMessage && (
          <InfoRow label="Error" value={job.errorMessage} />
        )}
      </Section>

      {/* ── Financials ─────────────────────────────────────────────────── */}
      <Section title="Financials" icon={DollarSign} color="#34C759">
        <InfoRow label="Revenue"
          value={isFree ? "Used credit (free)" : `$${revenue.toFixed(2)}`} />
        <InfoRow label="Platform cost"
          value={`$${cost.toFixed(2)}${!job.costToUs ? " (estimate)" : ""}`} />
        <InfoRow label="Net margin"
          value={`$${margin.toFixed(2)}`} />
      </Section>

      {/* ── User / Actor ───────────────────────────────────────────────── */}
      <Section title="Triggered By" icon={User} color="#D4A843">
        <InfoRow label="User ID"  value={job.triggeredById} mono />
        <InfoRow label="Name"     value={triggeredByUser?.name  ?? "—"} />
        <InfoRow label="Email"    value={triggeredByUser?.email ?? "—"} />
        <InfoRow label="Role"     value={triggeredByUser?.role  ?? "—"} />
        <InfoRow label="Source"   value={job.triggeredBy} />
      </Section>

      {/* ── Artist context (if set) ─────────────────────────────────────── */}
      {artistUser && (
        <Section title="Artist (output destination)" icon={User} color="#5AC8FA">
          <InfoRow label="User ID" value={job.artistId!} mono />
          <InfoRow label="Name"    value={artistUser.name  ?? "—"} />
          <InfoRow label="Email"   value={artistUser.email ?? "—"} />
        </Section>
      )}

      {/* ── Studio context (if set) ─────────────────────────────────────── */}
      {studio && (
        <Section title="Studio" icon={Building2} color="#5AC8FA">
          <InfoRow label="Studio ID" value={job.studioId!} mono />
          <InfoRow label="Name"      value={studio.name} />
          <InfoRow label="Slug"      value={studio.slug} />
        </Section>
      )}

      {/* ── Input data ─────────────────────────────────────────────────── */}
      <Section title="Input Data" icon={Zap} color="#AF52DE">
        <JsonBlock data={job.inputData} />
      </Section>

      {/* ── Output data ─────────────────────────────────────────────────── */}
      <Section title="Output Data" icon={CheckCircle2} color="#34C759">
        <JsonBlock data={job.outputData} />
      </Section>

    </div>
  );
}
