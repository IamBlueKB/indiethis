"use client";

import Link from "next/link";
import { Music2, Instagram, Twitter, Youtube, Facebook } from "lucide-react";
import { useState } from "react";

const footerLinks = {
  Platform: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "For Studios", href: "#studios" },
    { label: "Artist Pages", href: "#" },
    { label: "Beat Marketplace", href: "#" },
  ],
  Artists: [
    { label: "Sign Up", href: "/signup" },
    { label: "AI Music Videos", href: "#" },
    { label: "AI Cover Art", href: "#" },
    { label: "AI Mastering", href: "#" },
    { label: "Merch Store", href: "#" },
  ],
  Studios: [
    { label: "Onboard Your Studio", href: "/studios" },
    { label: "Clear Ear Studios", href: "/clearearstudios" },
    { label: "Studio Features", href: "#" },
    { label: "Contact Us", href: "#" },
  ],
  Legal: [
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
    { label: "Cookie Policy", href: "#" },
    { label: "Artist Agreement", href: "#" },
  ],
};

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <footer
      style={{
        backgroundColor: "#0A0A0B",
        borderTop: "1px solid #1F1F22",
        padding: "72px 24px 32px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Top: Brand + newsletter */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            marginBottom: "64px",
            alignItems: "start",
          }}
          className="footer-top"
        >
          {/* Brand */}
          <div>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "16px" }}>
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
                }}
              >
                IndieThis
              </span>
            </Link>
            <p
              style={{
                fontSize: "14px",
                color: "#6A6A6E",
                lineHeight: 1.7,
                maxWidth: "320px",
                marginBottom: "24px",
              }}
            >
              The platform built for independent music artists and recording studios.
              AI tools, merch, bookings, and sales — all in one place.
            </p>

            {/* Social links */}
            <div style={{ display: "flex", gap: "12px" }}>
              {[
                { icon: Instagram, href: "#", label: "Instagram" },
                { icon: Twitter, href: "#", label: "Twitter" },
                { icon: Youtube, href: "#", label: "YouTube" },
                { icon: Facebook, href: "#", label: "Facebook" },
              ].map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: "#141416",
                      border: "1px solid #2A2A2E",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#6A6A6E",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#D4A843";
                      e.currentTarget.style.color = "#D4A843";
                      e.currentTarget.style.backgroundColor = "rgba(212, 168, 67, 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2A2A2E";
                      e.currentTarget.style.color = "#6A6A6E";
                      e.currentTarget.style.backgroundColor = "#141416";
                    }}
                  >
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h3
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "18px",
                fontWeight: 700,
                color: "#F5F0E8",
                marginBottom: "8px",
                letterSpacing: "-0.3px",
              }}
            >
              Stay in the loop
            </h3>
            <p style={{ fontSize: "14px", color: "#6A6A6E", marginBottom: "20px", lineHeight: 1.6 }}>
              Platform updates, AI tool launches, and tips for independent artists.
              No spam. Unsubscribe anytime.
            </p>
            {submitted ? (
              <div
                style={{
                  backgroundColor: "rgba(52, 199, 89, 0.1)",
                  border: "1px solid rgba(52, 199, 89, 0.3)",
                  borderRadius: "10px",
                  padding: "14px 20px",
                  color: "#34C759",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                You&rsquo;re in! We&rsquo;ll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{
                    flex: 1,
                    backgroundColor: "#141416",
                    border: "1px solid #2A2A2E",
                    borderRadius: "9999px",
                    padding: "11px 18px",
                    color: "#F5F0E8",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#D4A843")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2A2A2E")}
                />
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#D4A843",
                    color: "#0A0A0B",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "11px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E0B85A")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#D4A843")}
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Middle: Link columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "32px",
            marginBottom: "48px",
            paddingBottom: "48px",
            borderBottom: "1px solid #1F1F22",
          }}
          className="footer-links"
        >
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#6A6A6E",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                {category}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {links.map((link) => (
                  <li key={link.label} style={{ marginBottom: "10px" }}>
                    <Link
                      href={link.href}
                      style={{
                        color: "#6A6A6E",
                        textDecoration: "none",
                        fontSize: "14px",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#F5F0E8")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#6A6A6E")}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <p style={{ fontSize: "13px", color: "#4A4A4E" }}>
            © {new Date().getFullYear()} IndieThis LLC. All rights reserved.
          </p>
          <div style={{ display: "flex", gap: "24px" }}>
            {["Terms", "Privacy", "Cookies"].map((label) => (
              <Link
                key={label}
                href="#"
                style={{
                  fontSize: "13px",
                  color: "#4A4A4E",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#9A9A9E")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4A4A4E")}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .footer-top {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .footer-links {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .footer-links {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
