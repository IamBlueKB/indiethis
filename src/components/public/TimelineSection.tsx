const steps = [
  {
    dot: "#E85D4A",
    time: "MINUTE 1",
    title: "Account live",
    body: "Name, email, pick a tier. Your dashboard and artist page URL are ready.",
  },
  {
    dot: "#E85D4A",
    time: "HOUR 1",
    title: "First track uploaded, AI cover art generated",
    body: "Upload your mix. Describe your vision. 4 cover options in 12 seconds.",
  },
  {
    dot: "#D4A843",
    time: "DAY 1",
    title: "Artist page live with merch store",
    body: "18 sections. Music, videos, merch, shows, booking, tips. Share the link.",
  },
  {
    dot: "#1D9E74",
    time: "WEEK 1",
    title: "First sale, first fan captured",
    body: "Someone buys a hoodie. Someone signs up for your email list. It's working.",
  },
];

export default function TimelineSection() {
  return (
    <section className="py-20 px-6" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-2xl mx-auto">
        <p style={{ fontSize: "10px", color: "#D4A843", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12, fontWeight: 700, textAlign: "center" }}>
          YOUR FIRST WEEK
        </p>
        <h2 className="font-display font-extrabold text-center mb-16" style={{ color: "#fff", fontSize: "clamp(28px,3vw,40px)", letterSpacing: "-1px" }}>
          From signup to first sale.
        </h2>

        <div style={{ position: "relative", paddingLeft: 32 }}>
          {/* Vertical gold line */}
          <div style={{
            position: "absolute", left: 7, top: 8, bottom: 8,
            width: 2, backgroundColor: "#D4A843", opacity: 0.3, borderRadius: 1,
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Dot */}
                <div style={{
                  position: "absolute", left: -29, top: 4,
                  width: 14, height: 14, borderRadius: "50%",
                  backgroundColor: step.dot,
                  boxShadow: `0 0 10px ${step.dot}60`,
                }} />
                <div style={{ fontSize: 10, fontWeight: 800, color: "#555", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>
                  {step.time}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6, letterSpacing: "-0.5px" }}>
                  {step.title}
                </div>
                <p style={{ fontSize: 13, color: "#666", lineHeight: 1.65, margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
