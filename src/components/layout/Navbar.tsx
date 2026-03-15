"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Music2 } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "all 0.3s ease",
        backgroundColor: scrolled ? "rgba(10, 10, 11, 0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid #2A2A2E" : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #D4A843, #E85D4A)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Music2 size={18} color="#0A0A0B" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontWeight: 700,
              fontSize: "20px",
              color: "#F5F0E8",
              letterSpacing: "-0.3px",
            }}
          >
            IndieThis
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "32px" }} className="hidden md:flex">
          {[
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "For Studios", href: "#studios" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{
                color: "#9A9A9E",
                textDecoration: "none",
                fontSize: "15px",
                fontWeight: 500,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F5F0E8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A9E")}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }} className="hidden md:flex">
          <Link
            href="/login"
            style={{
              color: "#9A9A9E",
              textDecoration: "none",
              fontSize: "15px",
              fontWeight: 500,
              padding: "8px 16px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F5F0E8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9A9A9E")}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            style={{
              backgroundColor: "#D4A843",
              color: "#0A0A0B",
              textDecoration: "none",
              fontSize: "15px",
              fontWeight: 600,
              padding: "9px 20px",
              borderRadius: "9999px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E0B85A")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#D4A843")}
          >
            Start Creating
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            background: "none",
            border: "none",
            color: "#F5F0E8",
            cursor: "pointer",
            padding: "8px",
          }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            backgroundColor: "#141416",
            borderTop: "1px solid #2A2A2E",
            padding: "20px 24px 24px",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "For Studios", href: "#studios" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  color: "#9A9A9E",
                  textDecoration: "none",
                  fontSize: "16px",
                  fontWeight: 500,
                  padding: "12px 0",
                  borderBottom: "1px solid #1F1F22",
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{
                color: "#F5F0E8",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: 500,
                padding: "12px 20px",
                border: "1px solid #2A2A2E",
                borderRadius: "9999px",
                textAlign: "center",
              }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              style={{
                backgroundColor: "#D4A843",
                color: "#0A0A0B",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: 600,
                padding: "12px 20px",
                borderRadius: "9999px",
                textAlign: "center",
              }}
            >
              Start Creating
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
