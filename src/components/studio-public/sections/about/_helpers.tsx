import { Clock } from "lucide-react";

export function fmt12h(time: string) {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ? parseInt(mStr, 10) : 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${mStr} ${ampm}`;
}

export function HoursBlock({ studio, accent }: { studio: any; accent: string }) {
  const A = "var(--studio-accent)";
  const hasStructured = studio.studioHours && typeof studio.studioHours === "object";
  if (!hasStructured && !studio.hours) return null;

  return (
    <div className="rounded-2xl p-5 border mt-6" style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} style={{ color: A }} />
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: A }}>Studio Hours</p>
      </div>
      {hasStructured ? (
        <div className="space-y-1.5">
          {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((d) => {
            const labels: Record<string, string> = {
              monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
              friday: "Fri", saturday: "Sat", sunday: "Sun",
            };
            const hours = studio.studioHours as Record<string, { open: boolean; openTime: string; closeTime: string }>;
            const day = hours[d];
            if (!day) return null;
            return (
              <div key={d} className="flex justify-between text-sm gap-4">
                <span className="font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{labels[d]}</span>
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
      ) : (
        <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
          {studio.hours}
        </p>
      )}
    </div>
  );
}

export function PhotoStack({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {images.slice(0, 4).map((url, i) => (
        <img
          key={i}
          src={url}
          alt="Studio"
          className={`rounded-2xl object-cover w-full ${i === 0 ? "col-span-2 h-56" : "h-36"}`}
        />
      ))}
    </div>
  );
}
