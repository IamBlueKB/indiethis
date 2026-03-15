"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

function WaveformBars() {
  const bars = Array.from({ length: 40 });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "3px",
        height: "60px",
        opacity: 0.35,
      }}
    >
      {bars.map((_, i) => {
        const height = Math.sin(i * 0.5) * 0.5 + 0.5;
        const delay = i * 0.05;
        return (
          <div
            key={i}
            style={{
              width: "3px",
              height: `${20 + height * 40}px`,
              backgroundColor: "#D4A843",
              borderRadius: "2px",
              animation: `waveform ${1.2 + (i % 5) * 0.3}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        padding: "120px 24px 80px",
        textAlign: "center",
        backgroundColor: "#0A0A0B",
      }}
    >
      {/* Radial gradient glow behind content */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "900px",
          height: "600px",
          background:
            "radial-gradient(ellipse at center, rgba(212, 168, 67, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: "20%",
          width: "400px",
          height: "400px",
          background:
            "radial-gradient(ellipse at center, rgba(232, 93, 74, 0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(42,42,46,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(42,42,46,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "860px", margin: "0 auto" }}>
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(212, 168, 67, 0.1)",
            border: "1px solid rgba(212, 168, 67, 0.25)",
            borderRadius: "9999px",
            padding: "6px 16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#D4A843",
              boxShadow: "0 0 8px rgba(212, 168, 67, 0.8)",
            }}
          />
          <span
            style={{
              color: "#D4A843",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            The Artist's Platform
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-outfit), sans-serif",
            fontSize: "clamp(42px, 6vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-2px",
            color: "#F5F0E8",
            marginBottom: "24px",
          }}
        >
          Everything an{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #D4A843 0%, #E0B85A 50%, #E85D4A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            indie artist
          </span>{" "}
          needs in one place.
        </h1>

        {/* Subheadline */}
        <p
          style={{
            fontSize: "clamp(17px, 2vw, 21px)",
            color: "#9A9A9E",
            lineHeight: 1.6,
            maxWidth: "580px",
            margin: "0 auto 48px",
            fontWeight: 400,
          }}
        >
          AI music videos, cover art, mastering, merch storefronts, studio booking,
          and your own artist site — built for independent musicians who don't have
          a label.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
            marginBottom: "64px",
          }}
        >
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#D4A843",
              color: "#0A0A0B",
              textDecoration: "none",
              fontSize: "16px",
              fontWeight: 700,
              padding: "14px 28px",
              borderRadius: "9999px",
              transition: "all 0.2s",
              boxShadow: "0 4px 24px rgba(212, 168, 67, 0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E0B85A";
              e.currentTarget.style.boxShadow = "0 6px 32px rgba(212, 168, 67, 0.4)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#D4A843";
              e.currentTarget.style.boxShadow = "0 4px 24px rgba(212, 168, 67, 0.25)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Start Creating Free
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>

          <a
            href="#studios"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "transparent",
              color: "#F5F0E8",
              textDecoration: "none",
              fontSize: "16px",
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: "9999px",
              border: "1px solid #2A2A2E",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#4A4A4E";
              e.currentTarget.style.backgroundColor = "#141416";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2A2A2E";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Onboard Your Studio
          </a>
        </div>

        {/* Waveform animation */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <WaveformBars />
          <div
            style={{
              display: "flex",
              gap: "32px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {[
              { value: "2,400+", label: "Artists" },
              { value: "18", label: "Studios" },
              { value: "$1.2M+", label: "Artist Earnings" },
              { value: "48K+", label: "Tracks Delivered" },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#F5F0E8",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "13px", color: "#6A6A6E", fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          color: "#6A6A6E",
          animation: "float 3s ease-in-out infinite",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "0.1em" }}>
          SCROLL
        </span>
        <ChevronDown size={16} />
      </div>
    </section>
  );
}
