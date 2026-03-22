import Link from "next/link";

const btnBase: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 100,
  padding: "14px 32px",
  fontSize: 15,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

export default function FinalCTA() {
  return (
    <section
      className="relative py-28 px-6 overflow-hidden text-center"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232,93,74,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto">
        <h2
          className="font-display font-extrabold mb-4"
          style={{ color: "#fff", fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-2px" }}
        >
          The label you{" "}
          <span style={{ color: "#D4A843" }}>don&apos;t need</span> is already built.
        </h2>
        <p style={{ color: "#666", fontSize: 15, marginBottom: 40, lineHeight: 1.65 }}>
          Start creating with AI tools, your own website, merch, and beat sales — for $19/mo.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/signup" style={{ ...btnBase, backgroundColor: "#E85D4A", color: "#fff" }}>
            Start Creating
          </Link>
          <a href="#pricing" style={{ ...btnBase, backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc" }}>
            See Pricing
          </a>
        </div>
      </div>
    </section>
  );
}
