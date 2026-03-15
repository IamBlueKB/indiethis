"use client";

import { Check, Minus, Zap } from "lucide-react";
import Link from "next/link";

const tiers = [
  {
    name: "Spark",
    price: 19,
    tagline: "Start your journey",
    color: "#9A9A9E",
    accentColor: "#9A9A9E",
    popular: false,
    features: [
      { label: "AI Cover Art", value: "5 / month" },
      { label: "AI Music Videos", value: null },
      { label: "AI Mastering", value: "1 / month" },
      { label: "Lyric Video", value: false },
      { label: "AI A&R Report", value: false },
      { label: "Press Kit Generator", value: true },
      { label: "Artist Mini-Site", value: "Profile only" },
      { label: "Merch Storefront", value: false },
      { label: "Beat Marketplace", value: false },
      { label: "Studio Time Included", value: false },
      { label: "10% Off À La Carte", value: false },
    ],
  },
  {
    name: "Flame",
    price: 49,
    tagline: "Serious artists, serious tools",
    color: "#D4A843",
    accentColor: "#D4A843",
    popular: true,
    features: [
      { label: "AI Cover Art", value: "10 / month" },
      { label: "AI Music Videos", value: "2 / month" },
      { label: "AI Mastering", value: "3 / month" },
      { label: "Lyric Video", value: true },
      { label: "AI A&R Report", value: "1 / month" },
      { label: "Press Kit Generator", value: true },
      { label: "Artist Mini-Site", value: "Full site" },
      { label: "Merch Storefront", value: "Yes (15% cut)" },
      { label: "Beat Marketplace", value: false },
      { label: "Studio Time Included", value: false },
      { label: "10% Off À La Carte", value: true },
    ],
  },
  {
    name: "Dynasty",
    price: 149,
    tagline: "Built for breakout artists",
    color: "#E85D4A",
    accentColor: "#E85D4A",
    popular: false,
    features: [
      { label: "AI Cover Art", value: "15 / month" },
      { label: "AI Music Videos", value: "5 / month" },
      { label: "AI Mastering", value: "10 / month" },
      { label: "Lyric Video", value: true },
      { label: "AI A&R Report", value: "3 / month" },
      { label: "Press Kit Generator", value: true },
      { label: "Artist Mini-Site", value: "Full + custom domain" },
      { label: "Merch Storefront", value: "Yes (10% cut)" },
      { label: "Beat Marketplace", value: true },
      { label: "Studio Time Included", value: "2 hrs / month" },
      { label: "10% Off À La Carte", value: true },
    ],
  },
];

const alaCarteItems = [
  { name: "AI Music Video", options: ["$49 Standard", "$99 Premium", "$149 Cinematic"] },
  { name: "AI Cover Art", options: ["$9.99 Single", "$29.99 Promo Pack"] },
  { name: "AI Mastering", options: ["$4.99 Quick", "$14.99 Studio Grade"] },
  { name: "Lyric Video", options: ["$24.99"] },
  { name: "AI A&R Report", options: ["$9.99"] },
  { name: "Press Kit", options: ["$19.99"] },
];

function FeatureValue({ value }: { value: string | boolean | null }) {
  if (value === null || value === false) {
    return <Minus size={16} color="#3A3A3E" />;
  }
  if (value === true) {
    return <Check size={16} color="#34C759" strokeWidth={2.5} />;
  }
  return (
    <span style={{ fontSize: "13px", color: "#F5F0E8", fontWeight: 500 }}>
      {value}
    </span>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      style={{
        padding: "100px 24px",
        backgroundColor: "#0A0A0B",
        position: "relative",
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
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
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
              Pricing
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
            Simple pricing.{" "}
            <span style={{ color: "#9A9A9E" }}>No surprises.</span>
          </h2>
          <p style={{ fontSize: "18px", color: "#9A9A9E", maxWidth: "460px", margin: "0 auto" }}>
            Every tier is month-to-month. Cancel anytime. All plans billed monthly.
          </p>
        </div>

        {/* Tier cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
            alignItems: "start",
            marginBottom: "64px",
          }}
        >
          {tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                backgroundColor: tier.popular ? "#141416" : "#0E0E10",
                border: tier.popular
                  ? `2px solid ${tier.accentColor}50`
                  : "1px solid #2A2A2E",
                borderRadius: "16px",
                padding: "36px 32px",
                position: "relative",
                transform: tier.popular ? "scale(1.02)" : "scale(1)",
                boxShadow: tier.popular
                  ? `0 0 60px ${tier.accentColor}18`
                  : "none",
              }}
            >
              {tier.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: "-14px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: tier.accentColor,
                    color: "#0A0A0B",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 16px",
                    borderRadius: "9999px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Zap size={11} strokeWidth={3} />
                  Most Popular
                </div>
              )}

              {/* Tier header */}
              <div style={{ marginBottom: "28px" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "22px",
                    fontWeight: 800,
                    color: tier.accentColor,
                    marginBottom: "6px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {tier.name}
                </h3>
                <p style={{ fontSize: "14px", color: "#6A6A6E", marginBottom: "20px" }}>
                  {tier.tagline}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-outfit), sans-serif",
                      fontSize: "52px",
                      fontWeight: 800,
                      color: "#F5F0E8",
                      lineHeight: 1,
                      letterSpacing: "-2px",
                    }}
                  >
                    ${tier.price}
                  </span>
                  <span style={{ fontSize: "16px", color: "#6A6A6E", fontWeight: 500 }}>
                    /mo
                  </span>
                </div>
              </div>

              {/* Features list */}
              <div style={{ marginBottom: "32px" }}>
                {tier.features.map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: i < tier.features.length - 1 ? "1px solid #1F1F22" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        color:
                          feature.value === null || feature.value === false
                            ? "#4A4A4E"
                            : "#9A9A9E",
                      }}
                    >
                      {feature.label}
                    </span>
                    <FeatureValue value={feature.value} />
                  </div>
                ))}
              </div>

              <Link
                href="/signup"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  textDecoration: "none",
                  padding: "13px",
                  borderRadius: "9999px",
                  fontSize: "15px",
                  fontWeight: 700,
                  transition: "all 0.2s",
                  backgroundColor: tier.popular ? tier.accentColor : "transparent",
                  color: tier.popular ? "#0A0A0B" : tier.accentColor,
                  border: tier.popular ? "none" : `1px solid ${tier.accentColor}50`,
                }}
                onMouseEnter={(e) => {
                  if (tier.popular) {
                    e.currentTarget.style.opacity = "0.9";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  } else {
                    e.currentTarget.style.backgroundColor = `${tier.accentColor}15`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (tier.popular) {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "translateY(0)";
                  } else {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                Get {tier.name}
              </Link>
            </div>
          ))}
        </div>

        {/* À La Carte */}
        <div
          style={{
            backgroundColor: "#141416",
            border: "1px solid #2A2A2E",
            borderRadius: "16px",
            padding: "40px",
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h3
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "22px",
                fontWeight: 700,
                color: "#F5F0E8",
                marginBottom: "8px",
                letterSpacing: "-0.3px",
              }}
            >
              À La Carte Pricing
            </h3>
            <p style={{ fontSize: "14px", color: "#6A6A6E" }}>
              Buy individual AI tools without a subscription. Flame and Dynasty subscribers get 10% off all à la carte purchases.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {alaCarteItems.map((item, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "#0E0E10",
                  border: "1px solid #1F1F22",
                  borderRadius: "10px",
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#F5F0E8",
                    marginBottom: "8px",
                  }}
                >
                  {item.name}
                </div>
                {item.options.map((opt, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: "13px",
                      color: "#D4A843",
                      fontWeight: 500,
                      lineHeight: 1.8,
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
