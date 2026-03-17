import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Zap, Music2, TrendingUp, Wand2, ArrowRight, Calendar, AlertCircle, CreditCard } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const firstName = (session.user.name ?? "Artist").split(" ")[0];

  const [subscription, trackCount, aiCount, totalEarnings, upcomingSessions, userProfile] = await Promise.all([
    db.subscription.findUnique({
      where: { userId },
      select: { tier: true, status: true, aiVideoCreditsUsed: true, aiVideoCreditsLimit: true },
    }),
    db.track.count({ where: { artistId: userId } }),
    db.aIGeneration.count({ where: { artistId: userId } }),
    db.payment.aggregate({
      where: { userId, status: "succeeded" },
      _sum: { amount: true },
    }),
    db.bookingSession.findMany({
      where: { artistId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { dateTime: "asc" },
      take: 3,
      include: { studio: { select: { name: true } } },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { artistName: true, artistSlug: true },
    }),
  ]);

  const creditsLeft = subscription
    ? subscription.aiVideoCreditsLimit - subscription.aiVideoCreditsUsed
    : 0;

  const stats = [
    {
      label: "AI Credits Left", icon: Zap, color: "#D4A843", href: "/dashboard/ai/video",
      value: subscription ? creditsLeft : "—",
      sub: subscription ? `${subscription.tier} plan` : "No plan yet",
    },
    {
      label: "Tracks", icon: Music2, color: "#5AC8FA", href: "/dashboard/music",
      value: trackCount,
      sub: trackCount === 0 ? "No tracks yet" : "saved references",
    },
    {
      label: "Total Earnings", icon: TrendingUp, color: "#34C759", href: "/dashboard/earnings",
      value: `$${(totalEarnings._sum.amount ?? 0).toFixed(2)}`,
      sub: "lifetime",
    },
    {
      label: "AI Generations", icon: Wand2, color: "#D4A843", href: "/dashboard/ai/video",
      value: aiCount,
      sub: aiCount === 0 ? "None yet" : "total jobs",
    },
  ];

  const SESSION_STATUS_COLOR: Record<string, string> = {
    PENDING: "#D4A843", CONFIRMED: "#5AC8FA",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s an overview of your IndieThis account.
        </p>
      </div>

      {/* Profile completion banner */}
      {!userProfile?.artistSlug && (
        <Link
          href="/dashboard/settings"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(232,93,74,0.06)", borderColor: "rgba(232,93,74,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={15} style={{ color: "#E85D4A" }} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Complete your artist profile</p>
              <p className="text-xs text-muted-foreground">Set your artist name and public URL so fans can find you.</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-muted-foreground shrink-0 ml-3" />
        </Link>
      )}

      {/* No plan banner */}
      {!subscription && (
        <Link
          href="/dashboard/upgrade"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <CreditCard size={15} style={{ color: "#D4A843" }} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">No active plan</p>
              <p className="text-xs text-muted-foreground">Choose a plan to unlock AI tools, merch, and your artist site.</p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full shrink-0 ml-3"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            View Plans
          </span>
        </Link>
      )}

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

      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* Upcoming sessions */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-accent" />
              <p className="text-sm font-semibold text-foreground">Upcoming Sessions</p>
            </div>
            <Link href="/dashboard/sessions" className="flex items-center gap-1 text-xs text-accent no-underline hover:opacity-80">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No upcoming sessions. Book studio time to get started.</p>
          ) : (
            upcomingSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.studio.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.dateTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-xs font-semibold" style={{ color: SESSION_STATUS_COLOR[s.status] ?? "#888" }}>
                  {s.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          {[
            { label: "Add References", sub: "Save YouTube inspiration", href: "/dashboard/music", color: "#E85D4A" },
            { label: "Generate AI Video", sub: "Turn your track into content", href: "/dashboard/ai/video", color: "#D4A843" },
            { label: "Artist Site", sub: "Manage your public page", href: "/dashboard/site", color: "#5AC8FA" },
            { label: "Merch Store", sub: "View products & orders", href: "/dashboard/merch", color: "#34C759" },
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
