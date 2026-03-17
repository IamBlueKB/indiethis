"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu,
  ChevronDown,
  User,
  LogOut,
  LayoutDashboard,
  Calendar,
  Users,
  BookUser,
  Inbox,
  FolderOpen,
  Mail,
  CreditCard,
  FileText,
  Settings,
  Music2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/shared/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store";

const navItems = [
  { label: "Dashboard", href: "/studio", icon: LayoutDashboard },
  { label: "Bookings", href: "/studio/bookings", icon: Calendar },
  { label: "Artists", href: "/studio/artists", icon: Users },
  { label: "Contacts", href: "/studio/contacts", icon: BookUser },
  { label: "Inbox", href: "/studio/inbox", icon: Inbox },
  { label: "File Delivery", href: "/studio/deliver", icon: FolderOpen },
  { label: "Email Blasts", href: "/studio/email", icon: Mail },
  { label: "Invoices", href: "/studio/invoices", icon: FileText },
  { label: "Payments", href: "/studio/payments", icon: CreditCard },
  { label: "Settings", href: "/studio/settings", icon: Settings },
];

export default function StudioTopBar({ studioSlug }: { studioSlug: string | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUserStore();
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/studio") return pathname === "/studio";
    return pathname.startsWith(href);
  }

  return (
    <>
      <header
        className="h-16 flex items-center justify-between px-5 border-b shrink-0"
        style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground -ml-1"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </Button>

        <div className="ml-auto flex items-center gap-1">
        {studioSlug && (
          <a
            href={`/${studioSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border no-underline transition-colors hover:bg-white/5 mr-1"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <ExternalLink size={12} />
            View Site
          </a>
        )}
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors outline-none">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
            >
              {user?.displayName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground leading-tight">
                {user?.displayName ?? "Studio"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Studio Admin</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-foreground">{user?.displayName ?? "Studio"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => { window.location.href = "/studio/settings"; }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <User size={14} />
              Studio Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-400 focus:text-red-400 cursor-pointer"
            >
              <LogOut size={14} className="mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      {/* Mobile nav sheet */}
      <Sheet open={mobileOpen} onOpenChange={(v) => !v && setMobileOpen(false)}>
        <SheetContent side="left" className="w-[240px] p-0" style={{ backgroundColor: "var(--card)" }}>
          <SheetHeader className="h-16 flex flex-row items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
            <SheetTitle className="p-0 m-0">
              <Link href="/studio" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 no-underline">
                <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-accent to-cta flex items-center justify-center shrink-0">
                  <Music2 size={16} className="text-background" strokeWidth={2.5} />
                </div>
                <span className="font-display font-bold text-[17px] text-foreground tracking-tight">
                  Studio Panel
                </span>
              </Link>
            </SheetTitle>
          </SheetHeader>
          <nav className="py-4 px-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline",
                    active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
