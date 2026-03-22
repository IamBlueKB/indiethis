export default function TransformationSection() {
  const cards = [
    {
      tag: "CREATE",
      borderColor: "#E85D4A",
      tagColor: "#E85D4A",
      headline: "AI generates it",
      body: "Cover art, music videos, mastering, lyric videos, press kits, A&R reports",
      stat: "6",
      statLabel: "AI tools built in",
    },
    {
      tag: "SELL",
      borderColor: "#D4A843",
      tagColor: "#D4A843",
      headline: "Fans buy it",
      body: "Merch, beats, music, tips — all from your artist page with Stripe checkout",
      stat: "$0",
      statLabel: "upfront inventory cost",
    },
    {
      tag: "OWN",
      borderColor: "#1D9E74",
      tagColor: "#1D9E74",
      headline: "You keep it",
      body: "Your masters. Your fan list. Your data. Your domain. Nothing locked behind a label.",
      stat: "100%",
      statLabel: "your masters, always",
    },
  ];

  return (
    <section className="py-20 px-6" style={{ backgroundColor: "#0D0D0F" }}>
      <div className="max-w-5xl mx-auto">
        <h2
          className="font-display font-extrabold text-center mb-3"
          style={{ color: "#fff", fontSize: "clamp(28px,3vw,40px)", letterSpacing: "-1px" }}
        >
          What happens when you stop stitching tools together.
        </h2>
        <p style={{ color: "#666", fontSize: 14, textAlign: "center", maxWidth: 480, margin: "0 auto 48px" }}>
          Every feature was built to work with every other feature. Not bolted on. Not linked out. Built in.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.tag}
              style={{
                backgroundColor: "#0A0A0A",
                border: "1px solid rgba(255,255,255,0.06)",
                borderTop: `3px solid ${card.borderColor}`,
                borderRadius: "0 0 12px 12px",
                padding: "28px 24px",
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "2px",
                color: card.tagColor, marginBottom: 16, textTransform: "uppercase",
              }}>
                {card.tag}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10, letterSpacing: "-0.5px" }}>
                {card.headline}
              </div>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.65, marginBottom: 24 }}>
                {card.body}
              </p>
              <div>
                <div style={{ fontSize: 40, fontWeight: 800, color: card.tagColor, lineHeight: 1, letterSpacing: "-2px" }}>
                  {card.stat}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{card.statLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
