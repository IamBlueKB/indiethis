import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Eye, MessageSquare, Calendar, BookUser, Mail, TrendingUp, TrendingDown, Minus, BarChart2, Zap } from "lucide-react";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";
import AdminBarChart from "@/components/admin/charts/AdminBarChart";

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

  // ── AI usage ─────────────────────────────────────────────────────────────
  const aiUsed = studio.generationsUsedThisMonth;
  const aiLimit = AI_LIMITS[studio.studioTier] ?? 3;
  const aiPct = Math.min(100, Math.round((aiUsed / aiLimit) * 100));

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
}: {
  label: string;
  value: number;
  sub: string;
  delta: number | null;
  icon: React.ElementType;
  color: string;
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
      <p className="text-2xl font-bold text-foreground font-display">{value.toLocaleString()}</p>
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
