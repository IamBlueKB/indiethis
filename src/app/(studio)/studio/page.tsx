import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Calendar, Users, FolderOpen, DollarSign, ArrowRight } from "lucide-react";
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

  const [bookingsThisMonth, artistCount, pendingDeliveries, paidInvoicesThisMonth, recentBookings] = await Promise.all([
    db.bookingSession.count({
      where: { studioId: studio.id, dateTime: { gte: startOfMonth } },
    }),
    db.studioArtist.count({ where: { studioId: studio.id } }),
    db.quickSend.count({
      where: { studioId: studio.id, downloadedAt: null, expiresAt: { gt: now } },
    }),
    db.invoice.aggregate({
      where: { studioId: studio.id, status: "PAID", updatedAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    db.bookingSession.findMany({
      where: { studioId: studio.id },
      orderBy: { dateTime: "desc" },
      take: 5,
      include: { artist: { select: { name: true } } },
    }),
  ]);

  const revenueThisMonth = paidInvoicesThisMonth._sum.total ?? 0;

  const stats = [
    { label: "Bookings This Month", value: bookingsThisMonth, sub: bookingsThisMonth === 0 ? "No bookings yet" : "sessions scheduled", icon: Calendar, color: "#5AC8FA", href: "/studio/bookings" },
    { label: "Managed Artists", value: artistCount, sub: artistCount === 0 ? "No artists yet" : "linked accounts", icon: Users, color: "#D4A843", href: "/studio/artists" },
    { label: "Pending Deliveries", value: pendingDeliveries, sub: pendingDeliveries === 0 ? "All clear" : "awaiting download", icon: FolderOpen, color: "#34C759", href: "/studio/deliver" },
    { label: "Revenue This Month", value: `$${revenueThisMonth.toFixed(2)}`, sub: "from paid invoices", icon: DollarSign, color: "#D4A843", href: "/studio/payments" },
  ];

  const SESSION_STATUS_COLOR: Record<string, string> = {
    PENDING: "#D4A843", CONFIRMED: "#5AC8FA", COMPLETED: "#34C759", CANCELLED: "#E85D4A",
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
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                  <Icon size={15} style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Recent bookings */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Recent Bookings</p>
            <Link href="/studio/bookings" className="flex items-center gap-1 text-xs text-accent no-underline hover:opacity-80">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            recentBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{b.artist.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.dateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-xs font-semibold" style={{ color: SESSION_STATUS_COLOR[b.status] ?? "#888" }}>
                  {b.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          {[
            { label: "Send Files", sub: "Quick deliver to an artist", href: "/studio/deliver", color: "#34C759" },
            { label: "New Invoice", sub: "Bill a client", href: "/studio/payments", color: "#D4A843" },
            { label: "Send Intake Link", sub: "Pre-session form", href: "/studio/quick-send", color: "#5AC8FA" },
            { label: "Email Blast", sub: "Message all contacts", href: "/studio/email", color: "#D4A843" },
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
    </div>
  );
}
