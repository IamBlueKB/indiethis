import { MapPin, Phone, Mail, Clock, Instagram, Youtube, Facebook, Twitter, Globe, Music } from "lucide-react";
import type { SectionSharedProps } from "../ConfigRenderer";

function fmt12h(time: string) {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ? parseInt(mStr, 10) : 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${mStr} ${ampm}`;
}

function HoursDisplay({ studio }: { studio: any }) {
  const A = "var(--studio-accent)";

  if (studio.studioHours && typeof studio.studioHours === "object") {
    const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const labels: Record<string, string> = {
      monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
      friday: "Fri", saturday: "Sat", sunday: "Sun",
    };
    const hours = studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }>;
    return (
      <div className="space-y-1.5">
        {days.map((d) => {
          const day = hours[d];
          if (!day) return null;
          return (
            <div key={d} className="flex justify-between text-sm gap-6">
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{labels[d]}</span>
              <span style={{ color: day.open ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
                {day.open ? `${fmt12h(day.openTime)} – ${fmt12h(day.closeTime)}` : "Closed"}
              </span>
            </div>
          );
        })}
        {studio.hoursNote && (
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>{studio.hoursNote}</p>
        )}
      </div>
    );
  }

  if (studio.hours) {
    return <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{studio.hours}</p>;
  }

  return null;
}

export function ContactLocationTwoColumnMap({ content, studio, fullAddress, mapQuery, socials }: SectionSharedProps) {
  const { headline = "Contact & Location", eyebrow = "Find Us" } = content;
  const A = "var(--studio-accent)";

  return (
    <section id="contact" className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div className="space-y-7">
            {fullAddress && (
              <div className="flex items-start gap-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <MapPin size={17} style={{ color: A }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Address</p>
                  <p className="font-medium">{fullAddress}</p>
                </div>
              </div>
            )}
            {studio.phone && (
              <div className="flex items-start gap-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <Phone size={17} style={{ color: A }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Phone</p>
                  <a href={`tel:${studio.phone}`} className="font-medium no-underline hover:opacity-80 transition-opacity">{studio.phone}</a>
                </div>
              </div>
            )}
            {studio.email && (
              <div className="flex items-start gap-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <Mail size={17} style={{ color: A }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Email</p>
                  <a href={`mailto:${studio.email}`} className="font-medium no-underline hover:opacity-80 transition-opacity">{studio.email}</a>
                </div>
              </div>
            )}
            {(studio.studioHours || studio.hours) && (
              <div className="flex items-start gap-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${A}18` }}>
                  <Clock size={17} style={{ color: A }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Hours</p>
                  <HoursDisplay studio={studio} />
                </div>
              </div>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {socials.map(({ label, href }) => {
                  const lower = label.toLowerCase();
                  const Icon =
                    lower.includes("instagram") ? Instagram :
                    lower.includes("youtube") ? Youtube :
                    lower.includes("facebook") ? Facebook :
                    lower.includes("twitter") || lower.includes("x.com") ? Twitter :
                    lower.includes("tiktok") ? Music :
                    Globe;
                  return (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl flex items-center justify-center border no-underline transition-all hover:opacity-80 hover:scale-105"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                      title={label}
                    >
                      <Icon size={17} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {fullAddress ? (
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <iframe
                title="Studio location"
                src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                width="100%"
                height="380"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div
              className="rounded-2xl border flex items-center justify-center"
              style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "#111", height: 380 }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Location not set</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
