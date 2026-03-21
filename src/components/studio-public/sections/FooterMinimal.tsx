import type { SectionSharedProps } from "../ConfigRenderer";

export function FooterMinimal({ content, studio, slug, fullAddress, socials }: SectionSharedProps) {
  const { showPoweredBy = true } = content;
  const A = "var(--studio-accent)";
  const muted = "rgba(255,255,255,0.35)";
  const linkStyle = { color: muted, textDecoration: "none" as const };

  return (
    <footer
      className="px-6 border-t"
      style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0A0A0A", paddingTop: "3.5rem", paddingBottom: "2.5rem" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Top row: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

          {/* Col 1 — Studio identity */}
          <div>
            <p className="font-bold text-base mb-2">{studio.name}</p>
            {fullAddress && (
              <p className="text-sm leading-relaxed" style={{ color: muted }}>{fullAddress}</p>
            )}
            {studio.phone && (
              <a href={`tel:${studio.phone}`} className="block text-sm mt-1 no-underline hover:opacity-70 transition-opacity" style={{ color: muted }}>
                {studio.phone}
              </a>
            )}
            {studio.email && (
              <a href={`mailto:${studio.email}`} className="block text-sm mt-0.5 no-underline hover:opacity-70 transition-opacity" style={{ color: muted }}>
                {studio.email}
              </a>
            )}
          </div>

          {/* Col 2 — Quick links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: muted }}>Quick Links</p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="#services" className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>Services</a>
              <a href="#portfolio" className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>Our Work</a>
              <a href="#engineers" className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>Our Team</a>
              <a href="#artists" className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>Artists</a>
              <a href="#contact" className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>Contact</a>
              <a href={`/${slug}/intake`} className="no-underline hover:opacity-70 transition-opacity" style={{ color: A }}>Book a Session →</a>
            </div>
          </div>

          {/* Col 3 — Social links */}
          {socials.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: muted }}>Follow Us</p>
              <div className="flex flex-col gap-2 text-sm">
                {socials.map(({ label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="no-underline hover:opacity-70 transition-opacity" style={linkStyle}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom row — copyright + powered by */}
        <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: muted }}>
          <span>© {new Date().getFullYear()} {studio.name}. All rights reserved.</span>
          {showPoweredBy && (
            <a
              href="https://indiethis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              style={{ color: muted }}
            >
              <span className="text-xs">Powered by</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/brand/indiethis-logo-dark-bg.svg"
                alt="IndieThis"
                style={{ height: 16, width: "auto", display: "inline-block" }}
              />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
