import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReleaseTimingRecommendation {
  bestDay:           string;                                    // "Tuesday"
  bestTime:          string;                                    // "7:00 PM"
  confidence:        "high" | "medium" | "low";
  reasoning:         string;
  activityByDay:     { day: string; score: number }[];          // Mon-Sun, score 0-1
  activityByHour:    { hour: number; score: number }[];         // 0-23, score 0-1
  /** 7 × 6 matrix: [dayIndex (0=Mon)][timeBlock (0=Night…5=LateNight)] = normalized count 0-1 */
  heatmap:           number[][];
  totalInteractions: number;
}

// Time blocks: 4 hours each, starting midnight
// 0 = Night 12am-4am (hours 0-3)
// 1 = Dawn  4am-8am  (hours 4-7)
// 2 = Morning 8am-12pm (hours 8-11)
// 3 = Afternoon 12pm-4pm (hours 12-15)
// 4 = Evening 4pm-8pm  (hours 16-19)
// 5 = Late Night 8pm-12am (hours 20-23)
export const TIME_BLOCK_LABELS = ["Night", "Dawn", "Morning", "Afternoon", "Evening", "Late Night"];
export const DAY_LABELS_SHORT  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_FULL          = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function jsDay(d: Date): number {
  // JS getDay(): 0=Sun…6=Sat → convert to Mon-first: Mon=0…Sun=6
  return (d.getDay() + 6) % 7;
}

function timeBlock(d: Date): number {
  return Math.floor(d.getHours() / 4);
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export async function analyzeReleaseTiming(
  artistId: string
): Promise<ReleaseTimingRecommendation | null> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Fetch all fan interaction timestamps in parallel
  const [pageViews, trackPlays, merchOrders, tips, linkClicks] = await Promise.all([
    db.pageView.findMany({
      where:  { artistId, viewedAt: { gte: since } },
      select: { viewedAt: true },
    }),
    db.trackPlay.findMany({
      where:  { artistId, playedAt: { gte: since } },
      select: { playedAt: true },
    }),
    db.merchOrder.findMany({
      where:  { artistId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.artistSupport.findMany({
      where:  { artistId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.linkClick.findMany({
      where:  { artistId, clickedAt: { gte: since } },
      select: { clickedAt: true },
    }),
  ]);

  const timestamps: Date[] = [
    ...pageViews.map(p => p.viewedAt),
    ...trackPlays.map(p => p.playedAt),
    ...merchOrders.map(p => p.createdAt),
    ...tips.map(p => p.createdAt),
    ...linkClicks.map(p => p.clickedAt),
  ];

  if (timestamps.length < 10) return null;

  // ── Counts ────────────────────────────────────────────────────────────────
  const dayCount:   number[] = Array(7).fill(0);    // Mon-Sun
  const hourCount:  number[] = Array(24).fill(0);   // 0-23
  // heatmap[day][block]
  const heatRaw:    number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

  for (const ts of timestamps) {
    const d  = jsDay(ts);
    const h  = ts.getHours();
    const tb = timeBlock(ts);
    dayCount[d]++;
    hourCount[h]++;
    heatRaw[d][tb]++;
  }

  // ── Best day + time ───────────────────────────────────────────────────────
  const bestDayIdx  = dayCount.indexOf(Math.max(...dayCount));
  const bestHourIdx = hourCount.indexOf(Math.max(...hourCount));

  const h      = bestHourIdx;
  const period = h >= 12 ? "PM" : "AM";
  const disp   = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const bestTime = `${disp}:00 ${period}`;
  const bestDay  = DAY_LABELS_FULL[bestDayIdx];

  // ── Confidence ────────────────────────────────────────────────────────────
  const total = timestamps.length;
  const confidence: "high" | "medium" | "low" =
    total >= 100 ? "high" : total >= 30 ? "medium" : "low";

  // ── Normalize ─────────────────────────────────────────────────────────────
  const maxDay  = Math.max(...dayCount,  1);
  const maxHour = Math.max(...hourCount, 1);
  const maxHeat = Math.max(...heatRaw.flat(), 1);

  const activityByDay  = DAY_LABELS_SHORT.map((day, i) => ({ day,  score: dayCount[i] / maxDay }));
  const activityByHour = hourCount.map((c, i)          => ({ hour: i, score: c / maxHour }));
  const heatmap        = heatRaw.map(row => row.map(c => c / maxHeat));

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const peakCount = dayCount[bestDayIdx];
  const avgCount  = total / 7;
  const mult      = avgCount > 0 ? (peakCount / avgCount).toFixed(1) : "2";
  const timeLabel = h >= 20 ? "late nights" : h >= 16 ? "evenings"
    : h >= 12 ? "afternoons" : h >= 6 ? "mornings" : "late nights";

  const reasoning =
    `Your fans are ${mult}× more active on ${bestDay}s during ${timeLabel} — drop here to maximize reach.`;

  return {
    bestDay,
    bestTime,
    confidence,
    reasoning,
    activityByDay,
    activityByHour,
    heatmap,
    totalInteractions: total,
  };
}
