import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all DJs who have crates with tracks
  const djProfiles = await db.dJProfile.findMany({
    select: {
      id: true,
      userId: true,
      crates: {
        select: {
          items: { select: { trackId: true } },
        },
      },
    },
  });

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let notified = 0;

  for (const dj of djProfiles) {
    const trackIds = [...new Set(dj.crates.flatMap(c => c.items.map(i => i.trackId)))];
    if (trackIds.length === 0) continue;

    const weeklyPlays = await db.trackPlay.count({
      where: { trackId: { in: trackIds }, playedAt: { gte: oneWeekAgo } },
    });

    if (weeklyPlays > 0) {
      void createNotification({
        userId: dj.userId,
        type: "DJ_WEEKLY_SUMMARY",
        title: "Your crates drove plays this week",
        message: `Tracks in your crates received ${weeklyPlays} play${weeklyPlays === 1 ? "" : "s"} this week.`,
        link: "/dashboard/dj/analytics",
      }).catch(() => {});
      notified++;
    }
  }

  return NextResponse.json({ notified });
}
