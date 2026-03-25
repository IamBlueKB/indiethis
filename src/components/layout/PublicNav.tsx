"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { href: "/explore",  label: "Explore"  },
  { href: "/beats",    label: "Beats"    },
  { href: "/studios",  label: "Studios"  },
  { href: "/artists",  label: "Artists"  },
  { href: "/about",    label: "About"    },
  { href: "/pricing",  label: "Pricing"  },
];

/**
 * Shared top navigation for all public-facing pages.
 * Pass `center` to render custom content (e.g. search bar) in the middle slot.
 */
export default function PublicNav({ center }: { center?: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname          = usePathname();
  const loggedIn          = !!session?.user;
  const [menuOpen, setMenuOpen]   = useState(false);
  const menuRef                   = useRef<HTMLDivElement>(null);

  const dashboardHref = (session?.user as any)?.role?.startsWith("STUDIO") ? "/studio" : "/dashboard";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: "rgba(10,10,10,0.92)",
        backdropFilter:  "blur(12px)",
        borderColor:     "#1a1a1a",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">

        {/* Logo */}
        <Link href="/explore" className="shrink-0">
          <img
            src="/images/brand/indiethis-logo-dark-bg.svg"
            alt="IndieThis"
            style={{ height: 36, width: "auto" }}
          />
        </Link>

        {/* Nav links — hidden on small screens */}
        <nav className="hidden md:flex items-center gap-0.5 shrink-0">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              pathname === href ||
              (href === "/explore" && pathname === "/") ||
              (href !== "/explore" && href !== "/" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                style={{ color: active ? "#D4A843" : "#888" }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Center slot (e.g. search bar) */}
        {center && (
          <div className="flex-1 min-w-0">
            {center}
          </div>
        )}

        {/* Spacer when no center content */}
        {!center && <div className="flex-1" />}

        {/* Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {loggedIn ? (
            <div className="relative" ref={menuRef}>
              {/* Avatar button */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 focus:outline-none"
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? ""}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    {(session.user?.name ?? "?")[0].toUpperCase()}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 rounded-xl overflow-hidden shadow-xl"
                  style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
                >
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: "#2a2a2a" }}>
                    <p className="text-xs font-semibold text-white truncate">{session.user?.name}</p>
                    <p className="text-[11px] truncate" style={{ color: "#666" }}>{session.user?.email}</p>
                  </div>
                  <Link
                    href={dashboardHref}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ color: "#D4A843" }}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/explore" })}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ color: "#888" }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold px-3 py-1.5 rounded-lg hidden sm:block"
                style={{ color: "#888" }}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm font-bold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
