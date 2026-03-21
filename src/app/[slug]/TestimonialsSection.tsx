// Server component

type Testimonial = {
  id:          string;
  quote:       string;
  attribution: string;
};

export default function TestimonialsSection({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  if (testimonials.length === 0) return null;

  return (
    <section className="space-y-3">
      {testimonials.map((t) => (
        <div
          key={t.id}
          className="rounded-[8px]"
          style={{ backgroundColor: "#111", padding: 12 }}
        >
          <p
            className="italic leading-snug"
            style={{ fontSize: 12, color: "#ccc", marginBottom: 6 }}
          >
            &ldquo;{t.quote}&rdquo;
          </p>
          <p style={{ fontSize: 10, color: "#D4A843" }}>— {t.attribution}</p>
        </div>
      ))}
    </section>
  );
}
