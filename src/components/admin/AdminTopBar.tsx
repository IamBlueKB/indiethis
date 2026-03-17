"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  ChevronDown,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  Settings,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Studios", href: "/admin/studios", icon: Building2 },
  { label: "Revenue", href: "/admin/revenue", icon: BarChart3 },
  { label: "AI Usage", href: "/admin/ai-usage", icon: Cpu },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminTopBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
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
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors outline-none">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
              >
                A
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">Admin</p>
                <p className="text-[11px] leading-tight" style={{ color: "#E85D4A" }}>
                  Platform Admin
                </p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground">Admin</p>
                  <p className="text-xs" style={{ color: "#E85D4A" }}>Platform Admin</p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:text-red-400 cursor-pointer"
              >
                <LogOut size={14} className="mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={(v) => !v && setMobileOpen(false)}>
        <SheetContent side="left" className="w-[240px] p-0" style={{ backgroundColor: "var(--card)" }}>
          <SheetHeader className="h-16 flex flex-row items-center px-5 border-b" style={{ borderColor: "var(--border)" }}>
            <SheetTitle className="p-0 m-0">
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 no-underline">
                <div
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
                >
                  <ShieldCheck size={16} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="font-display font-bold text-[15px] text-foreground tracking-tight">
                  Platform Admin
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
                    active ? "" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                  style={active ? { backgroundColor: "#E85D4A18", color: "#E85D4A" } : {}}
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
