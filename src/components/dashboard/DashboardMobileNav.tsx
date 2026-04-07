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
  X,
  Gift,
  Zap,
  Share2,
  Compass,
  UserCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard",       icon: LayoutDashboard },
  { label: "Explore",   href: "/explore",          icon: Compass },
  { label: "Music",     href: "/dashboard/music",  icon: Music },
  { label: "AI Tools",      href: "/dashboard/ai/video",  icon: Wand2 },
  { label: "Avatar Studio", href: "/dashboard/avatar",    icon: UserCircle },
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

interface DashboardMobileNavProps {
  open: boolean;
  onClose: () => void;
}

export default function DashboardMobileNav({ open, onClose }: DashboardMobileNavProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[240px] p-0" style={{ backgroundColor: "var(--card)" }}>
        <SheetHeader className="h-16 flex flex-row items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
          <SheetTitle className="p-0 m-0">
            <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5 no-underline">
              <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "36px", width: "auto" }} />
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
        </nav>

        <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
