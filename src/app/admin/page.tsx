import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Users, Building2, DollarSign, TrendingUp, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 29, REIGN: 79 };

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [artistCount, studioCount, activeSubscriptions, newUsersThisMonth, recentUsers] = await Promise.all([
    db.user.count({ where: { role: "ARTIST" } }),
    db.studio.count(),
    db.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { tier: true },
    }),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);
  const activeSubCount = activeSubscriptions.length;

  const stats = [
    { label: "Total Artists", value: artistCount, sub: `+${newUsersThisMonth} this month`, icon: Users, color: "#5AC8FA", href: "/admin/users" },
    { label: "Total Studios", value: studioCount, sub: "registered studios", icon: Building2, color: "#D4A843", href: "/admin/studios" },
    { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, sub: `${activeSubCount} active subscriptions`, icon: DollarSign, color: "#34C759", href: "/admin/revenue" },
    { label: "Active Subs", value: activeSubCount, sub: "paying users", icon: TrendingUp, color: "#E85D4A", href: "/admin/revenue" },
  ];

  const ROLE_COLOR: Record<string, string> = {
    ARTIST: "#5AC8FA", STUDIO_ADMIN: "#D4A843", PLATFORM_ADMIN: "#E85D4A",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Platform Administration
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">IndieThis platform overview</p>
      </div>

      {/* Stats */}
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

      <div className="grid grid-cols-[1fr_260px] gap-5">
        {/* Recent signups */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Recent Signups</p>
            <Link href="/admin/users" className="flex items-center gap-1 text-xs text-accent no-underline hover:opacity-80">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role] }}>
                {u.role === "STUDIO_ADMIN" ? "STUDIO" : u.role}
              </span>
            </div>
          ))}
        </div>

        {/* Platform status */}
        <div className="rounded-2xl border overflow-hidden h-fit" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">Platform Status</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "Database", ok: true },
              { label: "Auth Service", ok: true },
              { label: "Brevo Email", ok: true },
              { label: "UploadThing", ok: true },
              { label: "Stripe", ok: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="flex items-center gap-1" style={{ color: item.ok ? "#34C759" : "#E85D4A" }}>
                  {item.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  <span className="text-xs font-semibold">{item.ok ? "OK" : "Pending"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
