import type { SectionSharedProps } from "../ConfigRenderer";

export function FooterMinimal({ content, studio, fullAddress, socials }: SectionSharedProps) {
  const { showPoweredBy = true } = content;
  const A = "var(--studio-accent)";

  return (
    <footer
      className="py-12 px-6 border-t"
      style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0A0A0A" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="font-bold text-lg">{studio.name}</p>
          {fullAddress && (
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{fullAddress}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm justify-center" style={{ color: "rgba(255,255,255,0.35)" }}>
          {studio.phone && (
            <a href={`tel:${studio.phone}`} className="no-underline hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.35)" }}>
              {studio.phone}
            </a>
          )}
          {studio.email && (
            <a href={`mailto:${studio.email}`} className="no-underline hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.35)" }}>
              {studio.email}
            </a>
          )}
          {socials.slice(0, 3).map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="no-underline hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.35)" }}>
              {label}
            </a>
          ))}
          {showPoweredBy && (
            <span>Powered by <span style={{ color: A, fontWeight: 600 }}>IndieThis</span></span>
          )}
        </div>
      </div>
    </footer>
  );
}
