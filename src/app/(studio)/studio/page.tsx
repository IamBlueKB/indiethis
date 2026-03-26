import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Calendar, Users, FolderOpen, DollarSign, ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";

export default async function StudioDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const studio = await db.studio.findFirst({
    where: { ownerId: userId },
    select: { id: true, name: true },
  });

  const firstName = (session?.user?.name ?? "Studio").split(" ")[0];

  if (!studio) redirect("/studio/setup");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    intakesThisMonth,
    totalContacts,
    bookingRequests,
    pendingDeliveries,
    paidInvoicesThisMonth,
    recentIntakes,
  ] = await Promise.all([
    // Intake forms submitted this month = sessions booked
    db.intakeSubmission.count({
      where: { studioId: studio.id, createdAt: { gte: startOfMonth } },
    }),
    // Total contacts in CRM
    db.contact.count({
      where: { studioId: studio.id },
    }),
    // Open booking requests (unprocessed)
    db.contactSubmission.count({
      where: { studioId: studio.id, source: "BOOKING_REQUEST" },
    }),
    // Files sent but not yet downloaded by recipient
    db.quickSend.count({
      where: { studioId: studio.id, downloadedAt: null, expiresAt: { gt: now } },
    }),
    // Revenue from paid invoices this month
    db.invoice.aggregate({
      where: { studioId: studio.id, status: "PAID", updatedAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    // Recent intake submissions for activity feed
    db.intakeSubmission.findMany({
      where: { studioId: studio.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        artistName: true,
        status: true,
        createdAt: true,
        intakeLink: { select: { sessionDate: true } },
      },
    }),
  ]);

  const revenueThisMonth = paidInvoicesThisMonth._sum.total ?? 0;

  const stats = [
    {
      label: "Sessions This Month",
      value: intakesThisMonth,
      sub: intakesThisMonth === 0 ? "No sessions yet" : `intake form${intakesThisMonth !== 1 ? "s" : ""} submitted`,
      icon: Calendar,
      color: "#5AC8FA",
      href: "/studio/bookings",
    },
    {
      label: "Total Contacts",
      value: totalContacts,
      sub: totalContacts === 0 ? "No contacts yet" : `client${totalContacts !== 1 ? "s" : ""} in your CRM`,
      icon: Users,
      color: "#D4A843",
      href: "/studio/contacts",
    },
    {
      label: "Booking Requests",
      value: bookingRequests,
      sub: bookingRequests === 0 ? "No pending requests" : `awaiting response`,
      icon: Inbox,
      color: bookingRequests > 0 ? "#D4A843" : "#34C759",
      href: "/studio/bookings",
    },
    {
      label: "Revenue This Month",
      value: `$${revenueThisMonth.toFixed(2)}`,
      sub: "from paid invoices",
      icon: DollarSign,
      color: "#34C759",
      href: "/studio/payments",
    },
  ];

  const STATUS_COLOR: Record<string, string> = {
    PENDING:   "#D4A843",
    CONFIRMED: "#5AC8FA",
    COMPLETED: "#34C759",
    CANCELLED: "#E85D4A",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Studio Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome back, {firstName}. Here&apos;s your studio overview.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border p-5 no-underline block hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                  {stat.label}
                </p>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${stat.color}18` }}
                >
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Recent intake submissions */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-3.5 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm font-semibold text-foreground">Recent Sessions</p>
            <Link
              href="/studio/bookings"
              className="flex items-center gap-1 text-xs no-underline hover:opacity-80"
              style={{ color: "#D4A843" }}
            >
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {recentIntakes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No sessions yet. Send an intake link to get started.
            </p>
          ) : (
            recentIntakes.map((intake) => (
              <div
                key={intake.id}
                className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{intake.artistName}</p>
                  <p className="text-xs text-muted-foreground">
                    {intake.intakeLink?.sessionDate
                      ? new Date(intake.intakeLink.sessionDate).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })
                      : `Submitted ${new Date(intake.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}`
                    }
                  </p>
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: STATUS_COLOR[intake.status] ?? "#888" }}
                >
                  {intake.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          {[
            { label: "Send Files",       sub: "Quick deliver to an artist",  href: "/studio/deliver",    color: "#34C759" },
            { label: "New Invoice",       sub: "Bill a client",               href: "/studio/payments",   color: "#D4A843" },
            { label: "Send Intake Link",  sub: "Pre-session form",            href: "/studio/bookings",   color: "#5AC8FA" },
            { label: "Email Blast",       sub: "Message all contacts",        href: "/studio/email",      color: "#D4A843" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline hover:border-accent/40 transition-colors group"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.sub}</p>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Pending deliveries callout — only show if there are any */}
      {pendingDeliveries > 0 && (
        <Link
          href="/studio/deliver"
          className="flex items-center justify-between rounded-xl border px-5 py-3.5 no-underline hover:border-accent/40 transition-colors"
          style={{ backgroundColor: "var(--card)", borderColor: "rgba(212,168,67,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
            >
              <FolderOpen size={15} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pendingDeliveries} pending deliver{pendingDeliveries !== 1 ? "ies" : "y"}
              </p>
              <p className="text-xs text-muted-foreground">
                File{pendingDeliveries !== 1 ? "s" : ""} sent but not yet downloaded
              </p>
            </div>
          </div>
          <ArrowRight size={14} className="text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
