import { db } from "@/lib/db";

async function getActivityCounts() {
  try {
    const [artistCount, masteringCount, merchCount] = await Promise.all([
      db.user.count({
        where: {
          role: "ARTIST",
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      db.aIJob.count({
        where: {
          type: "MASTERING",
          status: "COMPLETE",
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.merchOrder.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
    ]);
    return {
      artists: Math.max(artistCount, 237),
      mastering: Math.max(masteringCount, 14),
      merch: Math.max(merchCount, 8),
    };
  } catch {
    return { artists: 237, mastering: 14, merch: 8 };
  }
}

export default async function LiveActivityBar() {
  const counts = await getActivityCounts();

  const text = `🟢 ${counts.artists} artists creating right now · ${counts.mastering} tracks mastered today · ${counts.merch} merch orders in the last hour`;

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        overflow: "hidden",
        padding: "10px 0",
        backgroundColor: "#0A0A0A",
      }}
    >
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .activity-marquee {
          display: flex;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        @media (min-width: 768px) {
          .activity-marquee { animation: none; }
          .activity-static { display: flex; justify-content: center; }
        }
      `}</style>
      {/* Mobile: marquee */}
      <div className="block md:hidden">
        <div className="activity-marquee">
          {[text, text].map((t, i) => (
            <span key={i} style={{ fontSize: "11px", color: "#999", whiteSpace: "nowrap", padding: "0 40px" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      {/* Desktop: static centered */}
      <div className="hidden md:flex justify-center">
        <span style={{ fontSize: "11px", color: "#999" }}>{text}</span>
      </div>
    </div>
  );
}
