"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Music", href: "/dashboard/music", icon: Music },
  { label: "AI Tools", href: "/dashboard/ai/video", icon: Wand2 },
  { label: "Merch", href: "/dashboard/merch", icon: ShoppingBag },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
  { label: "Artist Site", href: "/dashboard/site", icon: Globe },
  { label: "Sessions", href: "/dashboard/sessions", icon: Calendar },
  { label: "Earnings", href: "/dashboard/earnings", icon: TrendingUp },
  { label: "Referrals", href: "/dashboard/referrals", icon: Gift },
  { label: "Affiliate", href: "/dashboard/affiliate", icon: Share2 },
  { label: "Upgrade", href: "/dashboard/upgrade", icon: Zap },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useUserStore();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] h-screen shrink-0 border-r"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "26px", width: "auto" }} />
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
              <Icon
                size={17}
                strokeWidth={active ? 2.25 : 1.75}
                className="shrink-0"
              />
              {item.label}
            </Link>
          );
        })}
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
