// Server component — no "use client" needed
import Link from "next/link";

type AboutSectionProps = {
  bio:         string;
  photo:       string | null;
  displayName: string;
  credentials: string[];
  studioSlug:  string | null;
};

export default function AboutSection({
  bio,
  photo,
  displayName,
  credentials,
  studioSlug,
}: AboutSectionProps) {
  const sentences = bio.match(/[^.!?]+[.!?]+/g) ?? [bio];
  const shortBio  = sentences.slice(0, 5).join(" ").trim();

  return (
    <section>
      {/* Section label */}
      <p
        className="text-[10px] font-bold uppercase mb-[5px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        ABOUT
      </p>

      {/* Photo + bio */}
      <div className="flex gap-4 items-start">
        {photo && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={displayName}
              className="object-cover"
              style={{
                width:        90,
                height:       90,
                borderRadius: 10,
                border:       "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p
            className="leading-[1.6]"
            style={{ fontSize: 11, color: "#999", marginBottom: 8 }}
          >
            {shortBio}
          </p>

          {studioSlug && (
            <Link
              href={`/${studioSlug}`}
              className="text-[10px] no-underline hover:brightness-125 transition-colors"
              style={{ color: "rgba(212,168,67,0.6)" }}
            >
              View Studio →
            </Link>
          )}
        </div>
      </div>

      {/* Credential badges */}
      {credentials.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {credentials.map((badge, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-[8px] text-[9px] font-semibold"
              style={{
                backgroundColor: "rgba(212,168,67,0.10)",
                border:          "1px solid rgba(212,168,67,0.20)",
                color:           "#D4A843",
                padding:         "2px 8px",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
