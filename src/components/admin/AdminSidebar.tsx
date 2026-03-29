"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Cpu,
  ShieldAlert,
  Brain,
  Link2,
  Target,
  MessageSquare,
  UsersRound,
  Tag,
  Star,
  TrendingUp,
  DollarSign,
  Archive,
  Compass,
  Megaphone,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/admin-permissions";
import type { AdminRole } from "@prisma/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  page: string;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/admin",             icon: LayoutDashboard, page: "dashboard"    },
  { label: "Explore",     href: "/explore",            icon: Compass,         page: "explore-public" },
  { label: "Users",       href: "/admin/users",        icon: Users,           page: "users"        },
  { label: "Studios",     href: "/admin/studios",      icon: Building2,       page: "studios"      },
  { label: "Revenue",     href: "/admin/revenue",      icon: BarChart3,       page: "revenue"      },
  { label: "AI Usage",    href: "/admin/ai-usage",     icon: Cpu,             page: "ai-usage"     },
  { label: "Moderation",  href: "/admin/moderation",   icon: ShieldAlert,     page: "moderation"   },
  { label: "Content",     href: "/admin/content",      icon: Archive,         page: "content"      },
  { label: "AI Learning", href: "/admin/ai-learning",  icon: Brain,           page: "ai-usage"     },
  { label: "Support",     href: "/admin/support-chat", icon: MessageSquare,   page: "support-chat" },
  { label: "Affiliates",  href: "/admin/affiliates",   icon: Link2,           page: "affiliates"   },
  { label: "Promo Codes", href: "/admin/promo-codes",      icon: Tag,         page: "promo-codes"      },
  { label: "Ambassadors", href: "/admin/ambassadors",      icon: Star,        page: "ambassadors"      },
  { label: "Promo Analytics", href: "/admin/promo-analytics", icon: TrendingUp, page: "promo-analytics" },
  { label: "Signup Funnel",   href: "/admin/analytics/funnel", icon: Filter,     page: "analytics"       },
  { label: "Explore",      href: "/admin/explore",           icon: Compass,     page: "explore"          },
  { label: "Lead Submissions", href: "/admin/lead-tracking/leads", icon: Megaphone, page: "lead-tracking" },
  { label: "Lead Value",       href: "/admin/lead-tracking/value", icon: DollarSign, page: "lead-tracking" },
  { label: "Attribution", href: "/admin/attribution",      icon: Target,      page: "attribution"      },
  { label: "Team",        href: "/admin/team",         icon: UsersRound,      page: "team"         },
  { label: "Settings",    href: "/admin/settings",         icon: Settings,    page: "settings"     },
  { label: "Pricing",     href: "/admin/settings/pricing", icon: DollarSign,  page: "settings"     },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN:   "Super Admin",
  OPS_ADMIN:     "Ops Admin",
  SUPPORT_ADMIN: "Support Admin",
};

export default function AdminSidebar({
  role,
  name,
  email,
}: {
  role: AdminRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = ALL_NAV_ITEMS.filter((item) => canAccess(role, item.page));

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] h-screen shrink-0 border-r"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/admin" className="flex items-center gap-2.5 no-underline">
          <div className="flex flex-col gap-0.5">
            <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "36px", width: "auto" }} />
            <p className="text-[10px] text-muted-foreground leading-tight ml-0.5">Platform Admin</p>
          </div>
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
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              style={active ? { backgroundColor: "#E85D4A18", color: "#E85D4A" } : {}}
            >
              <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: account + sign out */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            <p className="text-[11px] truncate" style={{ color: "#E85D4A" }}>{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
