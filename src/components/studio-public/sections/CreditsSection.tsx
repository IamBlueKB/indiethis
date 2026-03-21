"use client";

export type StudioCreditItem = {
  id: string;
  artistName: string;
  artistPhotoUrl?: string | null;
  projectName?: string | null;
  artistSlug?: string | null;
};

interface Props {
  credits: StudioCreditItem[];
  accent?: string;
  dark?: boolean;
}

export function CreditsSection({ credits, accent = "#D4A843", dark = true }: Props) {
  if (!credits.length) return null;

  const visible   = credits.slice(0, 12);
  const textColor = dark ? "#ffffff" : "#0A0A0A";
  const subColor  = dark ? "rgba(255,255,255,0.45)" : "#888888";

  return (
    <section id="artists">
      <p style={{
        fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em",
        textTransform: "uppercase", color: accent, marginBottom: "1.25rem",
      }}>
        ARTISTS
      </p>
      <h2 style={{
        fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
        letterSpacing: "-0.02em", color: textColor, marginBottom: "2.5rem", lineHeight: 1.1,
      }}>
        Who Records Here
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem 1rem" }}>
        {visible.map((c) => {
          const inner = (
            <>
              {c.artistPhotoUrl ? (
                <img
                  src={c.artistPhotoUrl}
                  alt={c.artistName}
                  style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  backgroundColor: `${accent}1A`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>
                    {c.artistName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <p style={{ fontSize: "0.72rem", color: subColor, marginTop: "0.4rem", textAlign: "center", maxWidth: 72, lineHeight: 1.3 }}>
                {c.artistName}
              </p>
              {c.projectName && (
                <p style={{ fontSize: "0.65rem", color: accent, textAlign: "center", maxWidth: 72, marginTop: "0.15rem" }}>
                  {c.projectName}
                </p>
              )}
            </>
          );

          return c.artistSlug ? (
            <a key={c.id} href={`/${c.artistSlug}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", transition: "opacity 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              {inner}
            </a>
          ) : (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
