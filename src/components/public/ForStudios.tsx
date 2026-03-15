"use client";

import Link from "next/link";
import { ArrowRight, Users, MessageSquare, BarChart3, Mail, Upload, Calendar } from "lucide-react";

const studioFeatures = [
  {
    icon: Calendar,
    title: "Booking Management",
    description: "Send branded SMS intake links. Artists complete intake forms from their phone — session locked in before they arrive.",
  },
  {
    icon: Users,
    title: "Artist Roster",
    description: "Every artist you work with gets an IndieThis account. Track sessions, files, subscriptions, and revenue in one view.",
  },
  {
    icon: Upload,
    title: "File Delivery",
    description: "Upload mastered tracks, stems, and project files. Artists receive instant notifications and download from their dashboard.",
  },
  {
    icon: Mail,
    title: "Email Campaigns",
    description: "Send targeted email blasts to your roster — by genre, frequency, or subscription tier. Schedule or send immediately.",
  },
  {
    icon: MessageSquare,
    title: "SMS Notifications",
    description: "Automated booking confirmations, session reminders, and file delivery alerts — all powered by Twilio.",
  },
  {
    icon: BarChart3,
    title: "Revenue Tracking",
    description: "Stripe, PayPal, Zelle, and CashApp — all in one payment dashboard with daily, weekly, and monthly reporting.",
  },
];

export default function ForStudios() {
  return (
    <section
      id="studios"
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

      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "-10%",
          width: "500px",
          height: "500px",
          background: "radial-gradient(ellipse, rgba(212, 168, 67, 0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "80px",
            alignItems: "center",
          }}
          className="grid-studios"
        >
          {/* Left: Copy */}
          <div>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "rgba(212, 168, 67, 0.1)",
                border: "1px solid rgba(212, 168, 67, 0.25)",
                borderRadius: "9999px",
                padding: "5px 16px",
                marginBottom: "24px",
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
                For Studios
              </span>
            </div>

            <h2
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "clamp(32px, 3.5vw, 48px)",
                fontWeight: 800,
                color: "#F5F0E8",
                lineHeight: 1.1,
                letterSpacing: "-1.5px",
                marginBottom: "20px",
              }}
            >
              Your studio.{" "}
              <br />
              Our platform.{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                More revenue.
              </span>
            </h2>

            <p
              style={{
                fontSize: "17px",
                color: "#9A9A9E",
                lineHeight: 1.7,
                marginBottom: "32px",
                maxWidth: "480px",
              }}
            >
              IndieThis started in a recording studio in Chicago. We built the tools
              we needed — and now every studio on the platform gets them. CRM,
              booking, file delivery, email campaigns, and payments in one place.
            </p>

            <div
              style={{
                backgroundColor: "#141416",
                border: "1px solid #2A2A2E",
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "36px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6A6A6E",
                  fontWeight: 500,
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Flagship Studio
              </div>
              <div
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#F5F0E8",
                  marginBottom: "4px",
                }}
              >
                Clear Ear Studios
              </div>
              <div style={{ fontSize: "14px", color: "#6A6A6E" }}>
                7411 S Stony Island Ave, Chicago, IL 60649
              </div>
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {["Recording", "Mixing", "Mastering"].map((service) => (
                  <span
                    key={service}
                    style={{
                      backgroundColor: "rgba(212, 168, 67, 0.1)",
                      border: "1px solid rgba(212, 168, 67, 0.2)",
                      color: "#D4A843",
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "3px 12px",
                      borderRadius: "9999px",
                    }}
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href="/studios"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#D4A843",
                  color: "#0A0A0B",
                  textDecoration: "none",
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "13px 24px",
                  borderRadius: "9999px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#E0B85A";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#D4A843";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Onboard Your Studio
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
              <Link
                href="/clearearstudios"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "transparent",
                  color: "#9A9A9E",
                  textDecoration: "none",
                  fontSize: "15px",
                  fontWeight: 500,
                  padding: "13px 24px",
                  borderRadius: "9999px",
                  border: "1px solid #2A2A2E",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#F5F0E8";
                  e.currentTarget.style.borderColor = "#4A4A4E";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#9A9A9E";
                  e.currentTarget.style.borderColor = "#2A2A2E";
                }}
              >
                See Example Studio
              </Link>
            </div>
          </div>

          {/* Right: Feature grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {studioFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: "#141416",
                    border: "1px solid #2A2A2E",
                    borderRadius: "12px",
                    padding: "20px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#3A3A3E";
                    e.currentTarget.style.backgroundColor = "#1A1A1D";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#2A2A2E";
                    e.currentTarget.style.backgroundColor = "#141416";
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(212, 168, 67, 0.1)",
                      border: "1px solid rgba(212, 168, 67, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "14px",
                    }}
                  >
                    <Icon size={16} color="#D4A843" strokeWidth={2} />
                  </div>
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#F5F0E8",
                      marginBottom: "6px",
                      letterSpacing: "-0.2px",
                    }}
                  >
                    {feature.title}
                  </h4>
                  <p style={{ fontSize: "13px", color: "#6A6A6E", lineHeight: 1.55 }}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .grid-studios {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </section>
  );
}
