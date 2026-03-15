"use client";

import { UserPlus, Wand2, DollarSign } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Join",
    description:
      "Sign up and connect with your studio — or join on your own. Your account comes pre-loaded with AI credits, a merch storefront builder, and your own artist page. No label required.",
    color: "#D4A843",
    detail: "Setup takes under 5 minutes",
  },
  {
    number: "02",
    icon: Wand2,
    title: "Create",
    description:
      "Use AI to generate music videos, cover art, and mastered tracks. Build your merch catalog. Customize your artist site. All of it in one dashboard, built for working musicians.",
    color: "#E85D4A",
    detail: "AI video in under 30 minutes",
  },
  {
    number: "03",
    icon: DollarSign,
    title: "Earn",
    description:
      "Sell music, merch, and beats directly through your artist page. Keep the majority of every sale. Get paid via Stripe Connect. Track every dollar in your earnings dashboard.",
    color: "#34C759",
    detail: "Direct payouts, no delays",
  },
];

export default function HowItWorks() {
  return (
    <section
      style={{
        padding: "100px 24px",
        backgroundColor: "#0D0D0F",
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
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, #2A2A2E 30%, #2A2A2E 70%, transparent)",
        }}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
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
              How It Works
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
            From first track to{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              first sale.
            </span>
          </h2>
          <p style={{ fontSize: "18px", color: "#9A9A9E", maxWidth: "480px", margin: "0 auto" }}>
            Three steps. No label. No middleman.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            position: "relative",
          }}
        >
          {/* Connector line (desktop only) */}
          <div
            className="hidden lg:block"
            style={{
              position: "absolute",
              top: "72px",
              left: "calc(16.6% + 32px)",
              right: "calc(16.6% + 32px)",
              height: "1px",
              background: "linear-gradient(90deg, #D4A843, #E85D4A, #34C759)",
              opacity: 0.3,
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                style={{
                  backgroundColor: "#141416",
                  border: "1px solid #2A2A2E",
                  borderRadius: "16px",
                  padding: "36px 32px",
                  position: "relative",
                  zIndex: 1,
                  textAlign: "center",
                }}
              >
                {/* Step number */}
                <div
                  style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    fontFamily: "var(--font-mono-base), monospace",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#3A3A3E",
                    letterSpacing: "0.1em",
                  }}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    backgroundColor: `${step.color}15`,
                    border: `2px solid ${step.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 28px",
                    boxShadow: `0 0 32px ${step.color}20`,
                  }}
                >
                  <Icon size={28} color={step.color} strokeWidth={1.8} />
                </div>

                <h3
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "28px",
                    fontWeight: 800,
                    color: step.color,
                    marginBottom: "16px",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {step.title}
                </h3>

                <p
                  style={{
                    fontSize: "15px",
                    color: "#9A9A9E",
                    lineHeight: 1.65,
                    marginBottom: "24px",
                  }}
                >
                  {step.description}
                </p>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: `${step.color}12`,
                    border: `1px solid ${step.color}25`,
                    borderRadius: "9999px",
                    padding: "6px 14px",
                  }}
                >
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      backgroundColor: step.color,
                    }}
                  />
                  <span style={{ fontSize: "13px", color: step.color, fontWeight: 500 }}>
                    {step.detail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
