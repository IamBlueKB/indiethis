const testimonials = [
  {
    quote: "I was paying for Linktree, LANDR, Shopify, and Mailchimp. Cancelled all four the day I got on IndieThis.",
    name: "Marcus J.",
    genre: "Hip-Hop",
    city: "Atlanta",
    initials: "MJ",
    color: "#E85D4A",
  },
  {
    quote: "The AI made me a music video from one photo. I posted it on TikTok and got 40K views in 2 days. For $19.",
    name: "Kira Waves",
    genre: "R&B",
    city: "Chicago",
    initials: "KW",
    color: "#D4A843",
  },
  {
    quote: "My fans can hear my music, buy my merch, and book me — all on one page I built in 10 minutes.",
    name: "Dex Monroe",
    genre: "Producer",
    city: "Houston",
    initials: "DM",
    color: "#1D9E74",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 px-6" style={{ backgroundColor: "#0D0D0F" }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-extrabold text-center mb-12" style={{ color: "#fff", fontSize: "clamp(28px,3vw,40px)", letterSpacing: "-1px" }}>
          Early access artists.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                backgroundColor: "#0A0A0A",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "28px 24px",
              }}
            >
              <p style={{ fontSize: 15, color: "#ccc", lineHeight: 1.7, marginBottom: 24, fontStyle: "italic" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  backgroundColor: `${t.color}20`,
                  border: `2px solid ${t.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: t.color,
                }}>
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{t.genre} · {t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
