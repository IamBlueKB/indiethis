/**
 * /admin/video-studio — Music Video Studio admin panel.
 *
 * Metrics dashboard, video list, and VideoStyle CRUD.
 * Delegates all interactivity to VideoAdminClient.
 */

import { db }                   from "@/lib/db";
import { requireAdminAccess }   from "@/lib/require-admin-access";
import VideoAdminClient         from "./VideoAdminClient";
import { Film }                 from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Cost estimates per model (USD, per scene clip)
const MODEL_COST: Record<string, number> = {
  "fal-ai/minimax-video":           0.08,
  "fal-ai/kling-video/v1.6/pro":   0.09,
  "fal-ai/seedance-1.5-pro":        0.10,
  "fal-ai/seedance-2.0":            0.12,
  "fal-ai/wan-pro":                 0.07,
  "fal-ai/flux-kontext/pro":        0.05,
  DEFAULT:                          0.08,
};

const SCENE_CLIP_COUNT = 6; // average scenes per video

function estimateCost(modelCounts: Record<string, number>): number {
  let total = 0;
  for (const [model, count] of Object.entries(modelCounts)) {
    const rate = MODEL_COST[model] ?? MODEL_COST["DEFAULT"];
    total += rate * count;
  }
  return total;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VideoStudioAdminPage() {
  await requireAdminAccess("video-studio");

  const monthStart = startOfMonth();

  // ── Parallel queries ────────────────────────────────────────────────────────
  const [
    totalVideos,
    videosThisMonth,
    revenueAll,
    revenueMonth,
    completeVideos,
    recentVideos,
    videoTotal,
    styles,
    conversionData,
  ] = await Promise.all([
    // 1. Total videos ever
    db.musicVideo.count(),

    // 2. Videos this month
    db.musicVideo.count({ where: { createdAt: { gte: monthStart } } }),

    // 3. Total revenue (all time)
    db.musicVideo.aggregate({ _sum: { amount: true } }),

    // 4. Revenue this month
    db.musicVideo.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: monthStart } },
    }),

    // 5. COMPLETE videos with scenes JSON for timing + model stats
    db.musicVideo.findMany({
      where:  { status: "COMPLETE" },
      select: {
        scenes:    true,
        createdAt: true,
        updatedAt: true,
        style:     true,
      },
    }),

    // 6. Video list (100 most recent)
    db.musicVideo.findMany({
      take:    100,
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        trackTitle:   true,
        mode:         true,
        status:       true,
        amount:       true,
        guestEmail:   true,
        createdAt:    true,
        user: {
          select: {
            email:        true,
            subscription: { select: { status: true } },
          },
        },
      },
    }),

    // 7. Total count for pagination header
    db.musicVideo.count(),

    // 8. All video styles
    db.videoStyle.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),

    // 9. Conversion rate data — guests who later subscribed
    db.musicVideo.findMany({
      where: {
        guestEmail:     { not: null },
        conversionDone: true,
      },
      select: { userId: true },
    }),
  ]);

  // ── Derived metrics ─────────────────────────────────────────────────────────

  // Popular styles — count by style name from complete videos
  const styleCountMap: Record<string, number> = {};
  for (const v of completeVideos) {
    const s = v.style;
    if (s) styleCountMap[s] = (styleCountMap[s] ?? 0) + 1;
  }
  const popularStyles = Object.entries(styleCountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Model usage — iterate scenes JSON arrays
  const modelCountMap: Record<string, number> = {};
  for (const v of completeVideos) {
    const scenes = v.scenes as Array<{ model?: string }> | null;
    if (!Array.isArray(scenes)) continue;
    for (const scene of scenes) {
      if (scene?.model) {
        modelCountMap[scene.model] = (modelCountMap[scene.model] ?? 0) + 1;
      }
    }
  }
  const popularModels = Object.entries(modelCountMap)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Average generation time (seconds): updatedAt - createdAt for COMPLETE videos
  let avgGenerationSecs = 0;
  if (completeVideos.length > 0) {
    const totalMs = completeVideos.reduce(
      (sum, v) => sum + (v.updatedAt.getTime() - v.createdAt.getTime()),
      0
    );
    avgGenerationSecs = Math.round(totalMs / completeVideos.length / 1000);
  }

  // Estimated cost per video from model usage
  const avgCostPerVideo = completeVideos.length > 0
    ? estimateCost(modelCountMap) / completeVideos.length
    : 0;

  // Revenue totals in dollars
  const totalRevenueCents  = revenueAll._sum.amount  ?? 0;
  const monthRevenueCents  = revenueMonth._sum.amount ?? 0;
  const totalRevenueDollars = totalRevenueCents / 100;
  const monthRevenueDollars = monthRevenueCents / 100;

  // Margin: (revenue - cost) / revenue
  const totalCost  = avgCostPerVideo * completeVideos.length;
  const marginPct  = totalRevenueDollars > 0
    ? Math.round(((totalRevenueDollars - totalCost) / totalRevenueDollars) * 100)
    : 0;

  // Conversion rate: guests who are now subscribed users
  const convertedCount = conversionData.filter((v) => v.userId !== null).length;
  const totalGuests    = await db.musicVideo.count({ where: { userId: null, guestEmail: { not: null } } });
  const conversionRate = totalGuests > 0 ? Math.round((convertedCount / totalGuests) * 100) : 0;

  // ── Shape video rows for client ─────────────────────────────────────────────
  const videoRows = recentVideos.map((v) => ({
    id:           v.id,
    trackTitle:   v.trackTitle,
    email:        v.user?.email ?? v.guestEmail ?? null,
    mode:         v.mode,
    status:       v.status,
    amount:       v.amount,
    createdAt:    fmtDate(v.createdAt),
    isSubscriber: v.user?.subscription?.status === "ACTIVE",
  }));

  const metrics = {
    totalVideos,
    videosThisMonth,
    totalRevenue:       totalRevenueDollars,
    revenueThisMonth:   monthRevenueDollars,
    avgCostPerVideo,
    marginPct,
    conversionRate,
    avgGenerationSecs,
    popularStyles,
    popularModels,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Film size={20} style={{ color: "#D4A843" }} />
        <h1 className="text-xl font-bold text-foreground">Music Video Studio</h1>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }}
        >
          {totalVideos.toLocaleString()} video{totalVideos !== 1 ? "s" : ""}
        </span>
      </div>

      <VideoAdminClient
        metrics={metrics}
        videos={videoRows}
        styles={styles}
        videoTotal={videoTotal}
      />
    </div>
  );
}
