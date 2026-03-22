import Link from "next/link";

export default function StudioStrip() {
  return (
    <section id="studios" style={{
      backgroundColor: "rgba(212,168,67,0.03)",
      borderTop: "1px solid rgba(212,168,67,0.08)",
      padding: "32px 24px",
      scrollMarginTop: "72px",
    }}>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#D4A843", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>
            FOR RECORDING STUDIOS
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6, letterSpacing: "-0.5px" }}>
            Run your studio on IndieThis too.
          </div>
          <p style={{ fontSize: 13, color: "#666", margin: 0, maxWidth: 480 }}>
            CRM, booking, file delivery, invoicing, email blasts, and a public page. Built by a studio owner for studio owners.
          </p>
        </div>
        <Link
          href="/studios"
          style={{
            display: "inline-block",
            border: "1px solid rgba(212,168,67,0.3)",
            color: "#D4A843",
            borderRadius: 100,
            padding: "10px 24px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Onboard Your Studio
        </Link>
      </div>
    </section>
  );
}
