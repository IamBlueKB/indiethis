// Server component — no "use client" needed

type AboutSectionProps = {
  bio:          string;
  photo:        string | null;
  displayName:  string;
  credentials:  string[];
};

export default function AboutSection({
  bio,
  photo,
  displayName,
  credentials,
}: AboutSectionProps) {
  // Truncate to ~5 sentences for the public page
  const sentences  = bio.match(/[^.!?]+[.!?]+/g) ?? [bio];
  const shortBio   = sentences.slice(0, 5).join(" ").trim();

  return (
    <section className="space-y-4">
      {/* Section label */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">About</h2>

      {/* Photo + bio layout */}
      <div className="flex gap-5 items-start">

        {/* Artist photo — only if available */}
        {photo && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={displayName}
              className="w-20 h-20 rounded-2xl object-cover"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
        )}

        {/* Bio text */}
        <p className="text-sm text-white/60 leading-relaxed flex-1 min-w-0">
          {shortBio}
        </p>
      </div>

      {/* Credential badges */}
      {credentials.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {credentials.map((badge, i) => (
            <span
              key={i}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: "rgba(212,168,67,0.10)",
                border:          "1px solid rgba(212,168,67,0.20)",
                color:           "#D4A843",
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
