import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Radio, Disc3, DollarSign, Users } from "lucide-react";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label:      string;
  value:      string | number;
  icon:       React.ReactNode;
  iconBg:     string;
  iconColor:  string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DJActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Get all track IDs belonging to this artist
  const userTracks = await db.track.findMany({
    where: { artistId: userId },
    select: { id: true },
  });
  const trackIds = userTracks.map((t) => t.id);

  // Fetch all crate items for those tracks
  const crateItems = trackIds.length > 0
    ? await db.crateItem.findMany({
        where: { trackId: { in: trackIds } },
        select: {
          id:      true,
          addedAt: true,
          track:   { select: { title: true } },
          crate:   {
            select: {
              id:   true,
              name: true,
              djProfile: {
                select: {
                  id:   true,
                  slug: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      })
    : [];

  // Crate adds this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const addsThisMonth = crateItems.filter(
    (item) => new Date(item.addedAt) >= startOfMonth
  ).length;

  // Unique DJ count
  const uniqueDJIds = new Set(
    crateItems.map((item) => item.crate.djProfile.id)
  );
  const uniqueDJCount = uniqueDJIds.size;

  // DJ-attributed revenue (sum of active attributions for this artist)
  const attributions = await db.dJAttribution.findMany({
    where: {
      artistId:  userId,
      expiresAt: { gt: now },
    },
    select: { amount: true },
  });
  const djRevenueCents = attributions.reduce((sum, a) => sum + a.amount, 0);
  const djRevenueDollars = (djRevenueCents / 100).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
        >
          <Radio size={18} style={{ color: "#D4A843" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">DJ Activity</h1>
          <p className="text-xs text-muted-foreground">DJs who have your tracks in their crates</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Crate Adds This Month"
          value={addsThisMonth}
          icon={<Disc3 size={17} />}
          iconBg="rgba(212,168,67,0.12)"
          iconColor="#D4A843"
        />
        <StatCard
          label={`Spun by ${uniqueDJCount} DJ${uniqueDJCount !== 1 ? "s" : ""}`}
          value={uniqueDJCount}
          icon={<Users size={17} />}
          iconBg="rgba(90,200,250,0.12)"
          iconColor="#5AC8FA"
        />
        <StatCard
          label="DJ-Attributed Revenue"
          value={`$${djRevenueDollars}`}
          icon={<DollarSign size={17} />}
          iconBg="rgba(52,199,89,0.12)"
          iconColor="#34C759"
        />
      </div>

      {/* Crate items table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Your Tracks in DJ Crates</p>
        </div>

        {crateItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Disc3 size={36} style={{ color: "rgba(255,255,255,0.10)" }} />
            <p className="text-sm text-muted-foreground">No DJs have your tracks in their crates yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs text-muted-foreground uppercase tracking-wider"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <th className="px-5 py-3 font-medium">Track</th>
                  <th className="px-5 py-3 font-medium">DJ Name</th>
                  <th className="px-5 py-3 font-medium">Crate</th>
                  <th className="px-5 py-3 font-medium">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
                {crateItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-foreground">{item.track.title}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {item.crate.djProfile.user.name ?? "Unknown DJ"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                        style={{ backgroundColor: "rgba(212,168,67,0.10)", color: "#D4A843" }}
                      >
                        <Disc3 size={11} strokeWidth={2} />
                        {item.crate.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      {new Date(item.addedAt).toLocaleDateString("en-US", {
                        year:  "numeric",
                        month: "short",
                        day:   "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
