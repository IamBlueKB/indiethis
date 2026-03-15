"use client";

import { Video, ImageIcon, Zap, FileText, ShoppingBag, Globe, Calendar, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Video,
    title: "AI Music Videos",
    description:
      "Upload your track and a photo. Our AI generates cinematic music videos — vertical, horizontal, and square — in minutes.",
    color: "#E85D4A",
    badge: "Most Popular",
  },
  {
    icon: ImageIcon,
    title: "AI Cover Art",
    description:
      "Describe your vision or upload a reference image. Get 4 stunning 3000×3000 options generated in seconds.",
    color: "#D4A843",
  },
  {
    icon: Zap,
    title: "AI Mastering",
    description:
      "Upload your unmastered track. Set your target loudness and style. A/B compare with your original before downloading.",
    color: "#5AC8FA",
  },
  {
    icon: FileText,
    title: "AI A&R Report",
    description:
      "Get professional genre positioning, comparable artists, quality scores, playlist recommendations, and social strategy.",
    color: "#34C759",
  },
  {
    icon: ShoppingBag,
    title: "Merch Storefronts",
    description:
      "Upload your artwork, apply it to 7 product types, set your markup, and sell — with zero inventory.",
    color: "#D4A843",
  },
  {
    icon: Globe,
    title: "Artist Mini-Sites",
    description:
      "Your music, videos, merch, and bio — live on your own artist page. Dynasty tier gets a custom domain.",
    color: "#E85D4A",
  },
  {
    icon: Calendar,
    title: "Studio Booking",
    description:
      "Studios send you a branded SMS intake link. Everything from session details to deposit happens in one tap.",
    color: "#5AC8FA",
  },
  {
    icon: TrendingUp,
    title: "Beat Marketplace",
    description:
      "Sell beats with license tiers, preview clips, and direct checkout. Dynasty artists only.",
    color: "#34C759",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      style={{
        padding: "100px 24px",
        backgroundColor: "#0A0A0B",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Section divider */}
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
        {/* Section header */}
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
              Platform Features
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
            Your label. Your studio.{" "}
            <span style={{ color: "#9A9A9E" }}>Your rules.</span>
          </h2>
          <p
            style={{
              fontSize: "18px",
              color: "#9A9A9E",
              maxWidth: "520px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Six tools that used to cost six subscriptions — now in one platform
            built specifically for indie artists.
          </p>
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                style={{
                  backgroundColor: "#141416",
                  border: "1px solid #2A2A2E",
                  borderRadius: "12px",
                  padding: "28px",
                  position: "relative",
                  transition: "all 0.25s ease",
                  cursor: "default",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "#3A3A3E";
                  el.style.backgroundColor = "#1A1A1D";
                  el.style.transform = "translateY(-2px)";
                  el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4)`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "#2A2A2E";
                  el.style.backgroundColor = "#141416";
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                }}
              >
                {feature.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      backgroundColor: "rgba(232, 93, 74, 0.15)",
                      border: "1px solid rgba(232, 93, 74, 0.3)",
                      color: "#E85D4A",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {feature.badge}
                  </div>
                )}

                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    backgroundColor: `${feature.color}18`,
                    border: `1px solid ${feature.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                  }}
                >
                  <Icon size={20} color={feature.color} strokeWidth={2} />
                </div>

                <h3
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#F5F0E8",
                    marginBottom: "10px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {feature.title}
                </h3>

                <p
                  style={{
                    fontSize: "14px",
                    color: "#9A9A9E",
                    lineHeight: 1.65,
                  }}
                >
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
