"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Explore",    href: "/explore" },
  { label: "Pricing",    href: "#pricing"  },
  { label: "For Artists", href: "#artists" },
];

export default function HomepageNav() {
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300")}
      style={{
        backgroundColor: scrolled ? "rgba(10,10,10,0.95)" : "transparent",
        backdropFilter:  scrolled ? "blur(12px)" : "none",
        borderBottom:    scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">

        {/* Logo → home (explore) */}
        <Link href="/explore" className="flex items-center no-underline">
          <img
            src="/images/brand/indiethis-logo-dark-bg.svg"
            alt="IndieThis"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{ color: "#999", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
              className="hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {loggedIn ? (
            <>
              <span style={{ color: "#999", fontSize: 14 }}>
                {session.user?.name?.split(" ")[0]}
              </span>
              <Link
                href="/dashboard"
                style={{
                  backgroundColor: "#D4A843",
                  color: "#0A0A0A",
                  borderRadius: 100,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{ color: "#999", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
                className="hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                style={{
                  backgroundColor: "#E85D4A",
                  color: "#fff",
                  borderRadius: 100,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Start Creating
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ backgroundColor: "#0D0D0D", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 24px" }}>
          {NAV_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{ display: "block", color: "#999", fontSize: 16, fontWeight: 500, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", textDecoration: "none" }}
            >
              {item.label}
            </a>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {loggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                style={{ textAlign: "center", padding: "12px", backgroundColor: "#D4A843", borderRadius: 100, color: "#0A0A0A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  style={{ textAlign: "center", padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, color: "#ccc", textDecoration: "none", fontSize: 14, fontWeight: 500 }}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  style={{ textAlign: "center", padding: "12px", backgroundColor: "#E85D4A", borderRadius: 100, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}
                >
                  Start Creating
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
