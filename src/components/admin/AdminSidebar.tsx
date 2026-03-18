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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Studios", href: "/admin/studios", icon: Building2 },
  { label: "Revenue", href: "/admin/revenue", icon: BarChart3 },
  { label: "AI Usage", href: "/admin/ai-usage", icon: Cpu },
  { label: "Moderation", href: "/admin/moderation", icon: ShieldAlert },
  { label: "AI Learning", href: "/admin/ai-learning", icon: Brain },
  { label: "Affiliates",   href: "/admin/affiliates",   icon: Link2   },
  { label: "Attribution",  href: "/admin/attribution",  icon: Target  },
  { label: "Settings",     href: "/admin/settings",     icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] h-screen shrink-0 border-r"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/admin" className="flex items-center gap-2.5 no-underline">
          <div className="flex flex-col gap-0.5">
            <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: "24px", width: "auto" }} />
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

      {/* Bottom: sign out */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
          >
            A
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-[11px]" style={{ color: "#E85D4A" }}>Platform Admin</p>
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
