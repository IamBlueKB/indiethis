"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Menu, ChevronDown, User, LogOut } from "lucide-react";
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
import DashboardMobileNav from "./DashboardMobileNav";
import NotificationBell from "@/components/shared/NotificationBell";
import { useUserStore } from "@/store";
import { cn } from "@/lib/utils";

interface DashboardTopBarProps {
  title?: string;
}

export default function DashboardTopBar({ title }: DashboardTopBarProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user } = useUserStore();

  const tierColors: Record<string, string> = {
    launch: "#8A8A8E",
    push: "#D4A843",
    reign: "#34C759",
    studio: "#5AC8FA",
  };
  const tierColor = tierColors[user?.tier ?? "launch"] ?? "#8A8A8E";

  return (
    <>
      <header
        className="h-16 flex items-center justify-between px-5 border-b shrink-0"
        style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
      >
        {/* Left: mobile hamburger + page title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-muted-foreground hover:text-foreground -ml-1"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </Button>
          {title && (
            <h1 className="font-display font-semibold text-[17px] text-foreground tracking-tight">
              {title}
            </h1>
          )}
        </div>

        {/* Right: bell + user dropdown */}
        <div className="flex items-center gap-1">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5 outline-none">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
              style={user?.avatarUrl ? {} : { backgroundColor: "var(--accent)", color: "var(--background)" }}
            >
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.displayName ?? "Avatar"} className="w-full h-full object-cover" />
              ) : (
                user?.displayName?.[0]?.toUpperCase() ?? "A"
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground leading-tight">
                {user?.displayName ?? "Artist"}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: tierColor }}>
                {(user?.tier ?? "launch").charAt(0).toUpperCase() + (user?.tier ?? "launch").slice(1)} plan
              </p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-foreground">
                  {user?.displayName ?? "Artist"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => { window.location.href = "/dashboard/settings"; }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <User size={14} />
              Profile Settings
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

      <DashboardMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </>
  );
}
