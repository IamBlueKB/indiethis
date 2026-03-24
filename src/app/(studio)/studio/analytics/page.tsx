import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Eye, MessageSquare, Calendar, BookUser, Mail, TrendingUp, TrendingDown, Minus, BarChart2, Zap, MailCheck, SendHorizonal, Clock, Users, Gift, CheckCircle2, ArrowDownCircle, DollarSign } from "lucide-react";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";
import AdminBarChart from "@/components/admin/charts/AdminBarChart";
import { parseHistory, type CreditEvent } from "@/lib/studio-referral";

// AI generation limits by studio tier
const AI_LIMITS: Record<string, number> = { PRO: 3, ELITE: 10 };

const SOURCE_LABELS: Record<string, string> = {
  BOOKING: "Booking",
  INQUIRY: "Inquiry",
  MANUAL: "Manual",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  INTAKE_FORM: "Intake",
  INSTAGRAM: "Instagram",
};

// Build a 90-day array of { date: "Mar 17", ... } objects
function buildDailyBuckets(days: number): { date: string; [key: string]: string | number }[] {
  const now = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    result.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return result;
}

function bucketRecords(
  records: { date: Date | string }[],
  buckets: { date: string; [key: string]: string | number }[],
  key: string
) {
  for (const r of records) {
    const label = new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const bucket = buckets.find((b) => b.date === label);
    if (bucket) bucket[key] = ((bucket[key] as number) ?? 0) + 1;
  }
}

function calcDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function StudioAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      name: true,
      studioTier: true,
      generationsUsedThisMonth: true,
      generationResetDate: true,
      referralCredits:       true,
      referralCreditHistory: true,
      averageSessionRate:    true,
    },
  });

  if (!studio) redirect("/studio/setup");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const [
    viewsThisMonth,
    viewsLastMonth,
    rawPageViews,
    contactSubsThisMonth,
    contactSubsLastMonth,
    rawContactSubs,
    intakeSubsThisMonth,
    intakeSubsLastMonth,
    rawIntakeSubs,
    totalContacts,
    newContactsThisMonth,
    newContactsLastMonth,
    contactsBySource,
    recentCampaigns,
    seqSentThisMonth,
    seqSentLastMonth,
    seqPendingNow,
    seqAllSentEmails,
    seqStepBreakdown,
    convertedThisMonth,
    convertedLastMonth,
  ] = await Promise.all([
    db.pageView.count({
      where: { studioId: studio.id, viewedAt: { gte: startOfMonth } },
    }),
    db.pageView.count({
      where: { studioId: studio.id, viewedAt: { gte: lastMonthStart, lt: startOfMonth } },
    }),
    db.pageView.findMany({
      where: { studioId: studio.id, viewedAt: { gte: ninetyDaysAgo } },
      select: { viewedAt: true },
      orderBy: { viewedAt: "asc" },
    }),
    db.contactSubmission.count({
      where: { studioId: studio.id, createdAt: { gte: startOfMonth } },
    }),
    db.contactSubmission.count({
      where: { studioId: studio.id, createdAt: { gte: lastMonthStart, lt: startOfMonth } },
    }),
    db.contactSubmission.findMany({
      where: { studioId: studio.id, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.intakeSubmission.count({
      where: { studioId: studio.id, createdAt: { gte: startOfMonth } },
    }),
    db.intakeSubmission.count({
      where: { studioId: studio.id, createdAt: { gte: lastMonthStart, lt: startOfMonth } },
    }),
    db.intakeSubmission.findMany({
      where: { studioId: studio.id, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.contact.count({ where: { studioId: studio.id } }),
    db.contact.count({ where: { studioId: studio.id, createdAt: { gte: startOfMonth } } }),
    db.contact.count({ where: { studioId: studio.id, createdAt: { gte: lastMonthStart, lt: startOfMonth } } }),
    db.contact.groupBy({
      by: ["source"],
      where: { studioId: studio.id, createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.emailCampaign.findMany({
      where: { studioId: studio.id, sentAt: { not: null } },
      select: { id: true, subject: true, recipientCount: true, openCount: true, sentAt: true },
      orderBy: { sentAt: "desc" },
      take: 6,
    }),
    // ── Email sequence stats ──────────────────────────────────────────────
    db.scheduledEmail.count({
      where: { studioId: studio.id, status: "SENT", sentAt: { gte: startOfMonth } },
    }),
    db.scheduledEmail.count({
      where: { studioId: studio.id, status: "SENT", sentAt: { gte: lastMonthStart, lt: startOfMonth } },
    }),
    db.scheduledEmail.count({
      where: { studioId: studio.id, status: "PENDING" },
    }),
    // All ever-sent emails (for conversion calculation)
    db.scheduledEmail.findMany({
      where: { studioId: studio.id, status: "SENT" },
      select: { contactEmail: true, sentAt: true },
    }),
    // Per-step breakdown: count by sequenceStep + status
    db.scheduledEmail.groupBy({
      by: ["sequenceStep", "status"],
      where: { studioId: studio.id },
      _count: { id: true },
    }),
    // Booking lead conversions (contacts converted to bookings)
    db.contact.count({
      where: { studioId: studio.id, convertedToBooking: true, convertedAt: { gte: startOfMonth } },
    }),
    db.contact.count({
      where: { studioId: studio.id, convertedToBooking: true, convertedAt: { gte: lastMonthStart, lt: startOfMonth } },
    }),
  ]);

  // ── Build chart data ─────────────────────────────────────────────────────

  // Page views — 90-day buckets
  const pageViewBuckets = buildDailyBuckets(90).map((b) => ({ ...b, views: 0 }));
  bucketRecords(
    rawPageViews.map((v) => ({ date: v.viewedAt })),
    pageViewBuckets,
    "views"
  );

  // Contacts + Bookings — 90-day buckets (two lines on one chart)
  const engagementBuckets = buildDailyBuckets(90).map((b) => ({ ...b, inquiries: 0, bookings: 0 }));
  bucketRecords(
    rawContactSubs.map((c) => ({ date: c.createdAt })),
    engagementBuckets,
    "inquiries"
  );
  bucketRecords(
    rawIntakeSubs.map((i) => ({ date: i.createdAt })),
    engagementBuckets,
    "bookings"
  );

  // Contacts by source bar chart
  const sourceBarData = contactsBySource
    .filter((s) => s._count.id > 0)
    .map((s) => ({
      name: SOURCE_LABELS[s.source] ?? s.source,
      contacts: s._count.id,
    }))
    .sort((a, b) => b.contacts - a.contacts);

  // If no contacts this month, show all sources at 0 as a placeholder
  const sourceChartData =
    sourceBarData.length > 0
      ? sourceBarData
      : Object.values(SOURCE_LABELS)
          .slice(0, 5)
          .map((name) => ({ name, contacts: 0 }));

  // ── Deltas ───────────────────────────────────────────────────────────────
  const viewsDelta = calcDelta(viewsThisMonth, viewsLastMonth);
  const inquiriesDelta = calcDelta(contactSubsThisMonth, contactSubsLastMonth);
  const bookingsDelta = calcDelta(intakeSubsThisMonth, intakeSubsLastMonth);
  const contactsDelta = calcDelta(newContactsThisMonth, newContactsLastMonth);

  // ── Lead tracking ─────────────────────────────────────────────────────────
  const leadsThisMonth   = contactSubsThisMonth + intakeSubsThisMonth;
  const leadsLastMonth   = contactSubsLastMonth + intakeSubsLastMonth;
  const leadsDelta       = calcDelta(leadsThisMonth, leadsLastMonth);
  const avgRate          = studio.averageSessionRate ?? 150;
  const estimatedValue   = convertedThisMonth * avgRate;
  const estimatedValueLast = convertedLastMonth * avgRate;
  const valueDelta       = calcDelta(estimatedValue, estimatedValueLast);

  // ── Email sequence stats ─────────────────────────────────────────────────

  const seqSentDelta = calcDelta(seqSentThisMonth, seqSentLastMonth);

  // Conversion: unique emails that ever received a sequence email → are now subscribers
  const uniqueSentEmails = [...new Set(seqAllSentEmails.map((e) => e.contactEmail))];
  const seqConverted = uniqueSentEmails.length > 0
    ? await db.user.count({
        where: {
          email: { in: uniqueSentEmails },
          subscription: { status: "ACTIVE" },
        },
      })
    : 0;
  const seqConversionRate = uniqueSentEmails.length > 0
    ? Math.round((seqConverted / uniqueSentEmails.length) * 100)
    : null;

  // Per-step breakdown table: { step, sent, pending, cancelled }
  const STEP_ORDER = ["DAY_1", "DAY_3", "DAY_7", "DAY_14"] as const;
  const STEP_LABEL: Record<string, string> = { DAY_1: "Day 1", DAY_3: "Day 3", DAY_7: "Day 7", DAY_14: "Day 14" };

  type StepRow = { step: string; label: string; sent: number; pending: number; cancelled: number; failed: number };
  const seqBreakdownRows: StepRow[] = STEP_ORDER.map((step) => {
    const rows = seqStepBreakdown.filter((r) => r.sequenceStep === step);
    const count = (status: string) => rows.find((r) => r.status === status)?._count.id ?? 0;
    return {
      step,
      label: STEP_LABEL[step],
      sent:      count("SENT"),
      pending:   count("PENDING"),
      cancelled: count("CANCELLED"),
      failed:    count("FAILED"),
    };
  });

  const seqHasData = seqBreakdownRows.some((r) => r.sent + r.pending + r.cancelled + r.failed > 0);

  // ── AI usage ─────────────────────────────────────────────────────────────
  const aiUsed = studio.generationsUsedThisMonth;
  const aiLimit = AI_LIMITS[studio.studioTier] ?? 3;
  const aiPct = Math.min(100, Math.round((aiUsed / aiLimit) * 100));

  // ── Referral credits ──────────────────────────────────────────────────────
  const STUDIO_MONTHLY_PRICE: Record<string, number> = { PRO: 49, ELITE: 99 };
  const monthlyPrice   = STUDIO_MONTHLY_PRICE[studio.studioTier] ?? 49;
  const creditBalance  = studio.referralCredits ?? 0;
  const fullMonths     = Math.floor(creditBalance / monthlyPrice);
  const remainder      = creditBalance - fullMonths * monthlyPrice;
  const creditHistory  = parseHistory(studio.referralCreditHistory)
    .slice()
    .reverse(); // newest first

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <BarChart2 size={22} style={{ color: "var(--accent)" }} />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Performance overview for {studio.name}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value={viewsThisMonth}
          sub="this month"
          delta={viewsDelta}
          icon={Eye}
          color="#5AC8FA"
        />
        <StatCard
          label="Contact Inquiries"
          value={contactSubsThisMonth}
          sub="this month"
          delta={inquiriesDelta}
          icon={MessageSquare}
          color="#E85D4A"
        />
        <StatCard
          label="Bookings"
          value={intakeSubsThisMonth}
          sub="this month"
          delta={bookingsDelta}
          icon={Calendar}
          color="#D4A843"
        />
        <StatCard
          label="Total Contacts"
          value={totalContacts}
          sub={`+${newContactsThisMonth} this month`}
          delta={contactsDelta}
          icon={BookUser}
          color="#34C759"
        />
      </div>

      {/* Lead tracking cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Leads from IndieThis"
          value={leadsThisMonth}
          sub="contact + intake forms this month"
          delta={leadsDelta}
          icon={Users}
          color="#D4A843"
        />
        <StatCard
          label="Estimated Session Value"
          value={estimatedValue}
          sub={`from ${convertedThisMonth} converted booking${convertedThisMonth !== 1 ? "s" : ""}`}
          delta={valueDelta}
          icon={DollarSign}
          color="#34C759"
          prefix="$"
        />
      </div>

      {/* Charts row 1 */}
      <AdminLineChart
        data={pageViewBuckets}
        lines={[{ key: "views", color: "#5AC8FA", label: "Page Views" }]}
        title="Page Views"
        defaultRange="30d"
      />

      <AdminLineChart
        data={engagementBuckets}
        lines={[
          { key: "inquiries", color: "#E85D4A", label: "Contact Inquiries" },
          { key: "bookings", color: "#D4A843", label: "Bookings" },
        ]}
        title="Inquiries & Bookings"
        defaultRange="30d"
      />

      {/* Charts row 2 + Email */}
      <div className="grid grid-cols-[1fr_340px] gap-5">
        <AdminBarChart
          data={sourceChartData}
          bars={[{ key: "contacts", color: "#D4A843", label: "New Contacts" }]}
          title="New Contacts by Source — This Month"
          multiColor
        />

        {/* AI Usage Card */}
        <div
          className="rounded-2xl border p-5 flex flex-col"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} style={{ color: "#D4A843" }} strokeWidth={2} />
            <p className="text-sm font-semibold text-foreground">AI Page Generations</p>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground font-display">{aiUsed}</p>
              <p className="text-sm text-muted-foreground mt-1">
                of <span className="font-semibold text-foreground">{aiLimit}</span> used this month
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {studio.studioTier} plan
              </p>
            </div>
            {/* Progress bar */}
            <div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${aiPct}%`,
                    backgroundColor: aiPct >= 90 ? "#E85D4A" : aiPct >= 60 ? "#D4A843" : "#34C759",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">{aiUsed} used</span>
                <span className="text-xs text-muted-foreground">{aiLimit - aiUsed} remaining</span>
              </div>
            </div>
            {aiUsed >= aiLimit && (
              <p
                className="text-xs text-center px-3 py-2 rounded-xl"
                style={{ backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.2)" }}
              >
                Limit reached — resets next month
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Follow-Up Email Sequence Performance ────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Section header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <MailCheck size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-foreground">Follow-Up Email Sequence</p>
          </div>
          <p className="text-xs text-muted-foreground">Automated post-delivery emails</p>
        </div>

        {!seqHasData ? (
          <div className="px-5 py-12 text-center space-y-2">
            <MailCheck size={28} className="mx-auto opacity-30" style={{ color: "#D4A843" }} />
            <p className="text-sm font-medium text-foreground">No sequences sent yet</p>
            <p className="text-xs text-muted-foreground">
              Enable follow-up sequences on your next file delivery to see stats here.
            </p>
          </div>
        ) : (
          <>
            {/* Mini stat tiles */}
            <div
              className="grid grid-cols-3 gap-px border-b"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--border)" }}
            >
              {/* Sent this month */}
              <div className="px-5 py-4 space-y-1" style={{ backgroundColor: "var(--card)" }}>
                <div className="flex items-center gap-1.5">
                  <SendHorizonal size={13} style={{ color: "#D4A843" }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sent This Month</p>
                </div>
                <p className="text-2xl font-bold text-foreground font-display">{seqSentThisMonth}</p>
                {seqSentDelta !== null ? (
                  <p
                    className="text-xs font-semibold flex items-center gap-0.5"
                    style={{ color: seqSentDelta >= 0 ? "#34C759" : "#E85D4A" }}
                  >
                    {seqSentDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(seqSentDelta)}% vs last month
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">first month</p>
                )}
              </div>

              {/* Pending / queued */}
              <div className="px-5 py-4 space-y-1" style={{ backgroundColor: "var(--card)" }}>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Queued</p>
                </div>
                <p className="text-2xl font-bold text-foreground font-display">{seqPendingNow}</p>
                <p className="text-xs text-muted-foreground">scheduled, not yet sent</p>
              </div>

              {/* Conversion */}
              <div className="px-5 py-4 space-y-1" style={{ backgroundColor: "var(--card)" }}>
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversion</p>
                </div>
                {seqConversionRate !== null ? (
                  <>
                    <p className="text-2xl font-bold text-foreground font-display">{seqConversionRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {seqConverted} of {uniqueSentEmails.length} subscribed
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground font-display">—</p>
                    <p className="text-xs text-muted-foreground">no emails sent yet</p>
                  </>
                )}
              </div>
            </div>

            {/* Per-step breakdown table */}
            <div
              className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
              style={{ borderColor: "var(--border)", gridTemplateColumns: "100px 1fr 1fr 1fr 1fr" }}
            >
              <span>Step</span>
              <span>Sent</span>
              <span>Pending</span>
              <span>Cancelled</span>
              <span>Failed</span>
            </div>
            {seqBreakdownRows.map((row) => (
              <div
                key={row.step}
                className="grid items-center px-5 py-3.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border)", gridTemplateColumns: "100px 1fr 1fr 1fr 1fr" }}
              >
                {/* Step pill */}
                <span
                  className="inline-flex items-center justify-center w-14 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                >
                  {row.label}
                </span>

                <p className="text-sm font-semibold text-foreground">
                  {row.sent > 0 ? row.sent : <span className="text-muted-foreground">0</span>}
                </p>

                <p className="text-sm text-muted-foreground">
                  {row.pending > 0 ? (
                    <span className="font-semibold" style={{ color: "#eab308" }}>{row.pending}</span>
                  ) : "0"}
                </p>

                <p className="text-sm text-muted-foreground">{row.cancelled > 0 ? row.cancelled : "0"}</p>

                <p className="text-sm text-muted-foreground">
                  {row.failed > 0 ? (
                    <span className="font-semibold" style={{ color: "#f87171" }}>{row.failed}</span>
                  ) : "0"}
                </p>
              </div>
            ))}

            {/* Open rate note */}
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Open rate</span> — not tracked yet.
                Connect a Brevo open-tracking webhook to see open rates per step.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Referral Credits ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Gift size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-foreground">Referral Credits</p>
          </div>
          <p className="text-xs text-muted-foreground">Earned when your CRM contacts subscribe to IndieThis</p>
        </div>

        {/* Balance + coverage row */}
        <div
          className="grid grid-cols-3 gap-px border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--border)" }}
        >
          {/* Balance */}
          <div className="px-5 py-5 space-y-1" style={{ backgroundColor: "var(--card)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold font-display" style={{ color: "#D4A843" }}>
              ${creditBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Applied automatically on next invoice
            </p>
          </div>

          {/* Months covered */}
          <div className="px-5 py-5 space-y-1" style={{ backgroundColor: "var(--card)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Covered</p>
            {fullMonths > 0 ? (
              <>
                <p className="text-3xl font-bold text-foreground font-display">{fullMonths}</p>
                <p className="text-xs text-muted-foreground">
                  full month{fullMonths !== 1 ? "s" : ""} free
                  {remainder > 0 && ` + $${remainder.toFixed(2)} toward next`}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground font-display">—</p>
                <p className="text-xs text-muted-foreground">
                  {creditBalance > 0
                    ? `$${creditBalance.toFixed(2)} toward next invoice ($${monthlyPrice}/mo plan)`
                    : `Earn $5 per artist who subscribes`}
                </p>
              </>
            )}
          </div>

          {/* Total earned (EARNED events only) */}
          <div className="px-5 py-5 space-y-1" style={{ backgroundColor: "var(--card)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Earned</p>
            <p className="text-3xl font-bold text-foreground font-display">
              ${creditHistory
                .filter((e: CreditEvent) => e.type === "EARNED")
                .reduce((sum: number, e: CreditEvent) => sum + e.amount, 0)
                .toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">all time</p>
          </div>
        </div>

        {/* Credit history */}
        {creditHistory.length === 0 ? (
          <div className="px-5 py-12 text-center space-y-2">
            <Gift size={28} className="mx-auto opacity-30" style={{ color: "#D4A843" }} />
            <p className="text-sm font-medium text-foreground">No credits yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              When a BOOKING or MANUAL contact in your CRM subscribes to IndieThis,
              you&apos;ll earn $5 per artist — automatically credited to your account.
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
              style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 100px 120px" }}
            >
              <span>Description</span>
              <span>Amount</span>
              <span>Date</span>
            </div>

            {creditHistory.map((event: CreditEvent) => (
              <div
                key={event.id}
                className="grid items-center px-5 py-3.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 100px 120px" }}
              >
                {/* Icon + description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: event.type === "EARNED"
                        ? "rgba(52,199,89,0.12)"
                        : "rgba(90,200,250,0.12)",
                    }}
                  >
                    {event.type === "EARNED"
                      ? <CheckCircle2 size={13} style={{ color: "#34C759" }} />
                      : <ArrowDownCircle size={13} style={{ color: "#5AC8FA" }} />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{event.reason}</p>
                    {event.artistEmail && (
                      <p className="text-xs text-muted-foreground truncate">{event.artistEmail}</p>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <p
                  className="text-sm font-bold"
                  style={{ color: event.type === "EARNED" ? "#34C759" : "#5AC8FA" }}
                >
                  {event.type === "EARNED" ? "+" : ""}${Math.abs(event.amount).toFixed(2)}
                </p>

                {/* Date */}
                <p className="text-xs text-muted-foreground">
                  {new Date(event.date).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Email blast performance */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Mail size={14} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold text-foreground">Email Blast Performance</p>
          </div>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="px-5 py-12 text-center space-y-2">
            <Mail size={28} className="mx-auto text-muted-foreground opacity-30" />
            <p className="text-sm font-medium text-foreground">No blasts sent yet</p>
            <p className="text-xs text-muted-foreground">
              Send your first email blast to see performance here.
            </p>
          </div>
        ) : (
          <>
            <div
              className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
              style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 120px 120px 120px" }}
            >
              <span>Subject</span>
              <span>Sent</span>
              <span>Opened</span>
              <span>Open Rate</span>
            </div>
            {recentCampaigns.map((c) => {
              const openRate =
                c.recipientCount > 0
                  ? Math.round((c.openCount / c.recipientCount) * 100)
                  : 0;
              return (
                <div
                  key={c.id}
                  className="grid items-center px-5 py-3.5 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 120px 120px 120px" }}
                >
                  <p className="text-sm font-medium text-foreground truncate pr-4">{c.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.sentAt
                      ? new Date(c.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{c.openCount}</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-16 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${openRate}%`,
                          backgroundColor: openRate >= 40 ? "#34C759" : openRate >= 20 ? "#D4A843" : "#E85D4A",
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: openRate >= 40 ? "#34C759" : openRate >= 20 ? "#D4A843" : "#E85D4A",
                      }}
                    >
                      {openRate}%
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  color,
  prefix,
}: {
  label: string;
  value: number;
  sub: string;
  delta: number | null;
  icon: React.ElementType;
  color: string;
  prefix?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon size={15} style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground font-display">{prefix ?? ""}{value.toLocaleString()}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-muted-foreground">{sub}</p>
        {delta !== null && (
          <span
            className="text-xs font-semibold flex items-center gap-0.5"
            style={{ color: delta >= 0 ? "#34C759" : "#E85D4A" }}
          >
            {delta >= 0 ? (
              <TrendingUp size={11} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={11} strokeWidth={2.5} />
            )}
            {Math.abs(delta)}%
          </span>
        )}
        {delta === null && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Minus size={10} />
            new
          </span>
        )}
      </div>
    </div>
  );
}
