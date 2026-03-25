import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BookingRequestForm } from "./BookingRequestForm";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const studio = await db.studio.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      accentColor: true,
      isPublished: true,
      services: true,
      servicesJson: true,
    },
  });

  if (!studio || !studio.isPublished) notFound();

  const accent = studio.accentColor ?? "#D4A843";
  const services: { name: string }[] = studio.servicesJson
    ? (JSON.parse(studio.servicesJson) as { name: string }[])
    : (studio.services ?? []).length > 0
      ? (studio.services ?? []).map((s: string) => ({ name: s }))
      : [
          { name: "Recording" },
          { name: "Mixing" },
          { name: "Mastering" },
          { name: "Vocal Production" },
          { name: "Beat Making" },
          { name: "Podcast" },
        ];

  return (
    <div style={{ backgroundColor: "#080808", color: "#FAFAFA", minHeight: "100vh", fontFamily: "var(--font-dm-sans, sans-serif)" }}>
      {/* NAV */}
      <nav style={{ backgroundColor: "rgba(8,8,8,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href={`/${slug}`} className="no-underline flex items-center gap-3">
            {studio.logoUrl
              ? <img src={studio.logoUrl} alt={studio.name} style={{ height: "52px", width: "auto", filter: "invert(1)" }} className="object-contain" />
              : <span className="font-bold text-lg" style={{ fontFamily: "var(--font-playfair, serif)", color: "#FAFAFA" }}>{studio.name}</span>
            }
          </a>
          <a href={`/${slug}`} className="text-sm no-underline hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.4)" }}>
            ← Back
          </a>
        </div>
      </nav>

      {/* FORM */}
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>Request a Session</p>
          <h1 className="font-bold mb-4" style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(2rem, 6vw, 3rem)" }}>
            Book at {studio.name}
          </h1>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            Submit your request and we&apos;ll check availability, then reach out to confirm your session and send you the full booking form.
          </p>
        </div>

        <BookingRequestForm studioId={studio.id} studioName={studio.name} studioSlug={slug} accent={accent} services={services} />
      </div>
    </div>
  );
}
