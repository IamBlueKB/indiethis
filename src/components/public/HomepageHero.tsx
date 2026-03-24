import Link from "next/link";

export default function HomepageHero() {

  return (
    <section
      className="relative overflow-hidden"
      style={{ height: "450px", minHeight: "450px" }}
    >
      {/* Hero image */}
      <img
        src="/images/brand/homepage hero.webp"
        alt="Performer on stage"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center center" }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0A0A0A 0%, rgba(10,10,10,0) 25%, rgba(10,10,10,0) 45%, rgba(10,10,10,0.75) 75%, #0A0A0A 100%)",
        }}
      />

      {/* Content — bottom aligned */}
      <div className="absolute bottom-0 inset-x-0 px-6 pb-14 flex flex-col items-center text-center">
        <h1
          className="font-display font-extrabold leading-tight mb-3"
          style={{
            fontSize: "clamp(36px,5vw,56px)",
            letterSpacing: "-2px",
            color: "#fff",
          }}
        >
          The label you{" "}
          <span style={{ color: "#D4A843" }}>don&apos;t need.</span>
        </h1>

        <p
          className="mb-8 max-w-[480px] mx-auto"
          style={{ fontSize: "14px", color: "#999", lineHeight: 1.65 }}
        >
          AI music videos. Cover art. Mastering. Merch. Beat sales. Your own website. One platform. One login. Total independence.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition-colors"
            style={{ backgroundColor: "#E85D4A", color: "#fff", border: "none" }}
          >
            Start Creating
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors border"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", background: "transparent" }}
          >
            Explore the Platform →
          </Link>
        </div>
      </div>
    </section>
  );
}
