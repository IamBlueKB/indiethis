"use client";

import { Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "I dropped my first single with an AI music video and cover art that looked like I paid a studio $2,000. Cost me one month of Flame. IndieThis changed how I move.",
    name: "Marcus Reid",
    title: "Independent Artist · Chicago, IL",
    tier: "Flame",
    initials: "MR",
    color: "#D4A843",
  },
  {
    quote:
      "As the studio owner, I was losing hours every week chasing intake forms, managing deposits, and sending follow-ups. IndieThis turned that into SMS links and auto-confirmations.",
    name: "Blue",
    title: "Clear Ear Studios · Chicago, IL",
    tier: "Studio",
    initials: "BL",
    color: "#E85D4A",
  },
  {
    quote:
      "I built my whole artist site in 20 minutes and connected my Instagram. My fans have a real place to buy my music now. Dynasty tier pays for itself.",
    name: "Amara Diop",
    title: "Independent Artist · Atlanta, GA",
    tier: "Dynasty",
    initials: "AD",
    color: "#5AC8FA",
  },
  {
    quote:
      "The A&R Report blew my mind. It gave me comps I'd never considered, told me exactly which playlists to pitch, and called out the mixing issue I was ignoring. Cold truth.",
    name: "Jaylen Cross",
    title: "Independent Producer · Los Angeles, CA",
    tier: "Flame",
    initials: "JC",
    color: "#34C759",
  },
];

const stats = [
  { value: "2,400+", label: "Artists on Platform" },
  { value: "18", label: "Studios Onboarded" },
  { value: "$1.2M+", label: "Total Artist Earnings" },
  { value: "48K+", label: "Tracks Delivered" },
  { value: "98%", label: "Artist Satisfaction" },
  { value: "4.9★", label: "Average Rating" },
];

export default function SocialProof() {
  return (
    <section
      style={{
        padding: "100px 24px",
        backgroundColor: "#0A0A0B",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, #2A2A2E 30%, #2A2A2E 70%, transparent)",
        }}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "72px" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(212, 168, 67, 0.1)",
              border: "1px solid rgba(212, 168, 67, 0.25)",
              borderRadius: "9999px",
              padding: "5px 16px",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                color: "#D4A843",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Artist Stories
            </span>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 800,
              color: "#F5F0E8",
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              marginBottom: "16px",
            }}
          >
            Real artists.{" "}
            <span style={{ color: "#9A9A9E" }}>Real results.</span>
          </h2>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1px",
            backgroundColor: "#2A2A2E",
            border: "1px solid #2A2A2E",
            borderRadius: "16px",
            overflow: "hidden",
            marginBottom: "64px",
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#141416",
                padding: "24px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#F5F0E8",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  marginBottom: "6px",
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

        {/* Testimonials grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {testimonials.map((t, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#141416",
                border: "1px solid #2A2A2E",
                borderRadius: "16px",
                padding: "28px",
                position: "relative",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3A3A3E";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2A2A2E";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Stars */}
              <div
                style={{
                  display: "flex",
                  gap: "3px",
                  marginBottom: "16px",
                }}
              >
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star key={si} size={14} color="#D4A843" fill="#D4A843" />
                ))}
              </div>

              {/* Quote */}
              <p
                style={{
                  fontSize: "15px",
                  color: "#C8C3BC",
                  lineHeight: 1.7,
                  marginBottom: "24px",
                  fontStyle: "italic",
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: `${t.color}20`,
                    border: `1px solid ${t.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: t.color,
                    flexShrink: 0,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#F5F0E8",
                      marginBottom: "2px",
                    }}
                  >
                    {t.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6A6A6E" }}>{t.title}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <span
                    style={{
                      backgroundColor: `${t.color}15`,
                      border: `1px solid ${t.color}30`,
                      color: t.color,
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                    }}
                  >
                    {t.tier}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
