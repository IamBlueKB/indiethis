"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Music,
  Wand2,
  ShoppingBag,
  Store,
  Globe,
  Calendar,
  TrendingUp,
  Settings,
  LogOut,
  Zap,
  Gift,
  Share2,
  Video,
  Mic2,
  Users,
  BarChart2,
  MessageSquare,
  QrCode,
  Radio,
  ListMusic,
  FileText,
  PieChart,
  DollarSign,
  Archive,
  CalendarDays,
  Bell,
  Building2,
  Upload,
  Compass,
  Sparkles,
  ShoppingCart,
  Disc3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard",              icon: LayoutDashboard },
  { label: "Explore",       href: "/explore",                icon: Compass },
  { label: "Music",         href: "/dashboard/music",        icon: Music },
  { label: "Sales",         href: "/dashboard/music/sales",  icon: ShoppingCart },
  { label: "Videos",        href: "/dashboard/videos",       icon: Video },
  { label: "Shows",         href: "/dashboard/shows",        icon: Mic2 },
  { label: "Fans",          href: "/dashboard/fans",              icon: Users },
  { label: "Automations",   href: "/dashboard/fans/automations", icon: Zap },
  { label: "Analytics",     href: "/dashboard/analytics",    icon: BarChart2 },
  { label: "Broadcasts",    href: "/dashboard/broadcasts",   icon: MessageSquare },
  { label: "QR Code",       href: "/dashboard/qr",           icon: QrCode },
  { label: "AI Tools",      href: "/dashboard/ai/video",     icon: Wand2 },
  { label: "Merch",         href: "/dashboard/merch",        icon: ShoppingBag },
  { label: "Marketplace",   href: "/dashboard/marketplace",  icon: Store },
  { label: "Stream Leases", href: "/dashboard/stream-leases",icon: Radio },
  { label: "License Vault", href: "/dashboard/vault",        icon: Archive },
  { label: "Samples",       href: "/dashboard/samples",     icon: Upload },
  { label: "Artist Site",   href: "/dashboard/site",         icon: Globe },
  { label: "Sessions",        href: "/dashboard/sessions",          icon: Calendar },
  { label: "Book a Studio",   href: "/studios",                     icon: Building2 },
  { label: "Splits",          href: "/dashboard/splits",            icon: Users },
  { label: "Release Planner", href: "/dashboard/release-planner",  icon: CalendarDays },
  { label: "Earnings",        href: "/dashboard/earnings",          icon: TrendingUp },
  { label: "Year in Review",  href: "/dashboard/year-in-review",   icon: Sparkles },
  { label: "Notifications",   href: "/dashboard/notifications",     icon: Bell },
  { label: "Referrals",     href: "/dashboard/referrals",    icon: Gift },
  { label: "Affiliate",     href: "/dashboard/affiliate",    icon: Share2 },
  { label: "Upgrade",       href: "/dashboard/upgrade",      icon: Zap },
  { label: "Settings",      href: "/dashboard/settings",     icon: Settings },
];

const producerNavItems: NavItem[] = [
  { label: "My Beats",           href: "/dashboard/producer/beats",     icon: ListMusic },
  { label: "Licensing",          href: "/dashboard/producer/licensing", icon: FileText },
  { label: "Analytics",          href: "/dashboard/producer/analytics", icon: PieChart },
  { label: "Earnings",           href: "/dashboard/producer/earnings",  icon: DollarSign },
];

const producerStreamLeaseItem: NavItem = {
  label: "Stream Leases",
  href: "/dashboard/producer/stream-leases",
  icon: Radio,
};

const djNavItems: NavItem[] = [
  { label: "Crates",   href: "/dashboard/dj/crates",   icon: Disc3 },
  { label: "Mixes",    href: "/dashboard/dj/mixes",    icon: ListMusic },
  { label: "Sets",     href: "/dashboard/dj/sets",     icon: Video },
  { label: "Events",   href: "/dashboard/dj/events",   icon: CalendarDays },
  { label: "Bookings", href: "/dashboard/dj/bookings", icon: MessageSquare },
];

type Props = {
  hasProducerActivity: boolean;
  hasProducerStreamLeases: boolean;
  djMode?: boolean;
};

export default function DashboardSidebar({ hasProducerActivity, hasProducerStreamLeases, djMode }: Props) {
  const pathname = usePathname();
  const { user } = useUserStore();
  const [djPendingInvites, setDjPendingInvites] = useState(0);

  useEffect(() => {
    if (!djMode) return;
    fetch("/api/dashboard/dj/invites")
      .then(r => r.json())
      .then((d: { invites?: unknown[] }) => setDjPendingInvites(d.invites?.length ?? 0))
      .catch(() => {});
  }, [djMode]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const producerItems = hasProducerStreamLeases
    ? [producerNavItems[0], producerStreamLeaseItem, ...producerNavItems.slice(1)]
    : producerNavItems;

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] h-screen shrink-0 border-r"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "36px", width: "auto" }} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Producer section — only shown when user has beats */}
        {hasProducerActivity && (
          <div className="pt-4">
            <p
              className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "#D4A843" }}
            >
              Producer
            </p>
            {producerItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline",
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* DJ section — only shown when djMode is enabled */}
        {djMode && (
          <div className="pt-4">
            <p
              className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "#D4A843" }}
            >
              DJ
            </p>
            {djNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isCrates = item.href === "/dashboard/dj/crates";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline",
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
                  {item.label}
                  {isCrates && djPendingInvites > 0 && (
                    <span
                      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                    >
                      {djPendingInvites}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold"
            style={user?.avatarUrl ? {} : { backgroundColor: "var(--accent)", color: "var(--background)" }}
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.displayName ?? "Avatar"} className="w-full h-full object-cover" />
            ) : (
              user?.displayName?.[0]?.toUpperCase() ?? "A"
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName ?? "Artist"}
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {user?.tier ?? "launch"} plan
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
