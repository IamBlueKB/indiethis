"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Music2,
  LayoutDashboard,
  BarChart2,
  Calendar,
  Users,
  BookUser,
  Inbox,
  FolderOpen,
  Mail,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Globe,
  ExternalLink,
  Wand2,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/studio", icon: LayoutDashboard },
  { label: "Analytics", href: "/studio/analytics", icon: BarChart2 },
  { label: "Bookings", href: "/studio/bookings", icon: Calendar },
  { label: "Artists", href: "/studio/artists", icon: Users },
  { label: "Contacts", href: "/studio/contacts", icon: BookUser },
  { label: "Inbox", href: "/studio/inbox", icon: Inbox },
  { label: "File Delivery", href: "/studio/deliver", icon: FolderOpen },
  { label: "Email Blasts", href: "/studio/email", icon: Mail },
  { label: "Invoices", href: "/studio/invoices", icon: FileText },
  { label: "Payments", href: "/studio/payments", icon: CreditCard },
  { label: "AI Tools", href: "/studio/ai-tools", icon: Wand2 },
  { label: "Credits", href: "/studio/credits", icon: Gift },
  { label: "Settings", href: "/studio/settings", icon: Settings },
  { label: "Public Page", href: "/studio/settings/public-page", icon: Globe },
];

export default function StudioSidebar() {
  const pathname = usePathname();
  const { user } = useUserStore();
  const [studioSlug, setStudioSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/studio/my-slug")
      .then((r) => r.json())
      .then((d) => setStudioSlug(d.slug ?? null))
      .catch(() => {});
  }, []);

  function isActive(href: string) {
    if (href === "/studio") return pathname === "/studio";
    if (href === "/studio/settings") return pathname === "/studio/settings";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] h-screen shrink-0 border-r"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/studio" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-accent to-cta flex items-center justify-center shrink-0">
            <Music2 size={16} className="text-background" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display font-bold text-[15px] text-foreground tracking-tight leading-tight">
              IndieThis
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">Studio Panel</p>
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

      {/* View Site */}
      {studioSlug && (
        <div className="px-3 pb-3">
          <a
            href={`/${studioSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors w-full"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", opacity: 0.85 }}
          >
            <ExternalLink size={16} strokeWidth={1.75} className="shrink-0" />
            View My Site
          </a>
        </div>
      )}

      {/* Bottom: user + sign out */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
          >
            {user?.displayName?.[0]?.toUpperCase() ?? "S"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName ?? "Studio"}
            </p>
            <p className="text-[11px] text-muted-foreground">Studio Admin</p>
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
