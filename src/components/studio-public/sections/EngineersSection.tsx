"use client";

export type StudioEngineerItem = {
  id: string;
  name: string;
  role: string;
  photoUrl?: string | null;
  specialties: string[];
  bio?: string | null;
  artistSlug?: string | null;
};

interface Props {
  engineers: StudioEngineerItem[];
  accent?: string;
  dark?: boolean;
}

export function EngineersSection({ engineers, accent = "#D4A843", dark = true }: Props) {
  if (!engineers.length) return null;

  const visible   = engineers.slice(0, 6);
  const textColor = dark ? "#ffffff" : "#0A0A0A";
  const subColor  = dark ? "rgba(255,255,255,0.5)" : "#666666";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#F5F5F5";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#E5E5E5";

  return (
    <section id="engineers">
      <p style={{
        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em",
        textTransform: "uppercase", color: accent, marginBottom: "1.25rem",
      }}>
        THE TEAM
      </p>
      <h2 style={{
        fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
        letterSpacing: "-0.02em", color: textColor, marginBottom: "2.5rem", lineHeight: 1.1,
      }}>
        Our Engineers
      </h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "1.25rem",
      }}>
        {visible.map((eng) => {
          const nameBlock = (
            <>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: textColor, marginBottom: "0.2rem" }}>
                {eng.name}
              </p>
              <p style={{ fontSize: "0.78rem", color: accent, fontWeight: 600, marginBottom: "0.75rem" }}>
                {eng.role}
              </p>
            </>
          );

          return (
            <div key={eng.id} style={{
              backgroundColor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 12,
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0",
            }}>
              {/* Photo + name row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
                {eng.photoUrl ? (
                  <img src={eng.photoUrl} alt={eng.name}
                    style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: `${accent}1A`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: accent }}>
                      {eng.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {eng.artistSlug ? (
                    <a href={`/${eng.artistSlug}`} style={{ textDecoration: "none" }}>
                      {nameBlock}
                    </a>
                  ) : nameBlock}
                </div>
              </div>

              {/* Specialties */}
              {eng.specialties.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
                  {eng.specialties.map((s, i) => (
                    <span key={i} style={{
                      fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.6rem",
                      borderRadius: 4, backgroundColor: `${accent}18`, color: accent,
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Bio */}
              {eng.bio && (
                <p style={{ fontSize: "0.8rem", color: subColor, lineHeight: 1.6, margin: 0 }}>
                  {eng.bio}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
