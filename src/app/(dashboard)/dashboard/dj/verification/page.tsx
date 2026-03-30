import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, Clock, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import ApplyButton from "./ApplyButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function monthsDiff(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; Icon: React.ElementType }> = {
    NONE:     { label: "Not Verified",      bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", Icon: ShieldAlert },
    PENDING:  { label: "Under Review",      bg: "rgba(234,179,8,0.12)",   color: "#EAB308",              Icon: Clock },
    APPROVED: { label: "Verified",          bg: "rgba(52,199,89,0.12)",   color: "#34C759",              Icon: ShieldCheck },
    DENIED:   { label: "Application Denied",bg: "rgba(232,93,74,0.12)",   color: "#E85D4A",              Icon: ShieldX },
  };
  const s = map[status] ?? map.NONE;
  const Icon = s.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <Icon size={14} />
      {s.label}
    </span>
  );
}

// ─── Requirement Row ──────────────────────────────────────────────────────────

function Requirement({
  label,
  description,
  met,
}: {
  label: string;
  description: string;
  met: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <div className="mt-0.5 shrink-0">
        {met ? (
          <CheckCircle2 size={18} style={{ color: "#34C759" }} />
        ) : (
          <XCircle size={18} style={{ color: "#E85D4A" }} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span
        className="ml-auto shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: met ? "rgba(52,199,89,0.12)" : "rgba(232,93,74,0.12)",
          color: met ? "#34C759" : "#E85D4A",
        }}
      >
        {met ? "Met" : "Not Met"}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DJVerificationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      slug: true,
      isVerified: true,
      verificationStatus: true,
      verifiedAt: true,
      verificationApplication: {
        select: {
          id: true,
          status: true,
          adminNote: true,
          appliedAt: true,
          reviewedAt: true,
        },
      },
      crates: {
        select: {
          _count: { select: { items: true } },
        },
      },
      _count: {
        select: { attributions: true },
      },
      user: {
        select: { createdAt: true },
      },
    },
  });

  if (!djProfile) redirect("/dashboard");

  // ── Compute requirements ──────────────────────────────────────────────────

  const now = new Date();
  const accountAgeMonths = monthsDiff(djProfile.user.createdAt, now);
  const reqAccountAge = accountAgeMonths >= 6;

  const totalCrateItems = djProfile.crates.reduce(
    (sum, c) => sum + c._count.items,
    0
  );
  const reqTracks = totalCrateItems >= 20;

  const attributedSalesCount = await db.dJAttribution.count({
    where: { djProfileId: djProfile.id, amount: { gt: 0 } },
  });
  const reqSales = attributedSalesCount >= 1;

  const allMet = reqAccountAge && reqTracks && reqSales;

  const status = djProfile.verificationStatus;
  const app = djProfile.verificationApplication;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck size={22} style={{ color: "#D4A843" }} />
          <h1 className="text-2xl font-bold text-foreground">DJ Verification</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Verified DJs unlock earnings withdrawals and a verified badge on their profile.
        </p>
      </div>

      {/* Current Status */}
      <div
        className="rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Current Status
          </p>
          <StatusBadge status={status} />
          {status === "APPROVED" && app?.reviewedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Approved on {fmtDate(app.reviewedAt)}
            </p>
          )}
          {status === "PENDING" && app?.appliedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Applied on {fmtDate(app.appliedAt)}
            </p>
          )}
        </div>

        {/* Action area */}
        {(status === "NONE" || status === "DENIED") && (
          <ApplyButton allMet={allMet} isReapply={status === "DENIED"} />
        )}

        {status === "PENDING" && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "rgba(234,179,8,0.1)", color: "#EAB308" }}
          >
            <Clock size={15} />
            Application under review
          </div>
        )}

        {status === "APPROVED" && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
          >
            <ShieldCheck size={15} />
            Verified DJ
          </div>
        )}
      </div>

      {/* Denial reason */}
      {status === "DENIED" && app?.adminNote && (
        <div
          className="rounded-2xl border p-4 flex items-start gap-3"
          style={{ backgroundColor: "rgba(232,93,74,0.06)", borderColor: "rgba(232,93,74,0.25)" }}
        >
          <ShieldX size={16} className="mt-0.5 shrink-0" style={{ color: "#E85D4A" }} />
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Denial Reason</p>
            <p className="text-sm text-muted-foreground">{app.adminNote}</p>
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          Requirements
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          All three requirements must be met before you can apply.
        </p>

        <Requirement
          label="Account Age — 6 Months"
          description={`Your account was created ${fmtDate(djProfile.user.createdAt)}. Account age: ${accountAgeMonths} month${accountAgeMonths !== 1 ? "s" : ""}.`}
          met={reqAccountAge}
        />
        <Requirement
          label="Tracks in Crates — 20 Minimum"
          description={`You have ${totalCrateItems} track${totalCrateItems !== 1 ? "s" : ""} across all your crates. You need at least 20.`}
          met={reqTracks}
        />
        <Requirement
          label="Attributed Sales — At Least 1"
          description={`You have ${attributedSalesCount} attributed sale${attributedSalesCount !== 1 ? "s" : ""}. At least one purchase must have been referred through your DJ links.`}
          met={reqSales}
        />
      </div>

      {/* Info */}
      <div
        className="rounded-2xl border p-4 text-xs text-muted-foreground"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="font-semibold text-foreground mb-1">What verification unlocks</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Ability to withdraw your DJ earnings</li>
          <li>Verified badge on your public DJ profile</li>
          <li>Priority placement in DJ search results</li>
        </ul>
      </div>
    </div>
  );
}
