/**
 * /dashboard/ai/video — Music Video Studio launcher.
 *
 * Server component — renders within the dashboard layout (sidebar visible).
 * Shows the subscriber's included credit status, their recent music videos,
 * and a direct entry point to the studio that bypasses the marketing landing
 * and email gate (subscribers are always authenticated).
 */

import { redirect }   from "next/navigation";
import { auth }       from "@/lib/auth";
import { db }         from "@/lib/db";
import Link           from "next/link";
import { Film, Zap, Clapperboard, Check, ChevronRight, Clock, Play } from "lucide-react";

// ─── Credit tier config ───────────────────────────────────────────────────────

const TIER_CREDITS: Record<string, number> = {
  LAUNCH: 1,
  PUSH:   2,
  REIGN:  4,
};

function creditLabel(tier: string | null, used: number): string {
  if (!tier) return "0";
  const total = TIER_CREDITS[tier] ?? 0;
  const remaining = Math.max(0, total - used);
  return `${remaining} / ${total}`;
}

// ─── Video status display ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING:    "Queued",
  ANALYZING:  "Analyzing",
  PLANNING:   "Planning",
  GENERATING: "Generating",
  STITCHING:  "Stitching",
  COMPLETE:   "Complete",
  FAILED:     "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETE:   "#34C759",
  FAILED:     "#E85D4A",
  GENERATING: "#D4A843",
  STITCHING:  "#D4A843",
  PLANNING:   "#888",
  ANALYZING:  "#888",
  PENDING:    "#555",
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return "just now";
  if (hours < 1) return `${mins}m ago`;
  if (days < 1)  return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardAIVideoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Active subscription
  const sub = await db.subscription.findFirst({
    where:  { userId, status: "ACTIVE" },
    select: { tier: true },
  });
  const tier = sub?.tier ?? null;

  // Count music videos used this calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [usedThisMonth, recentVideos] = await Promise.all([
    db.musicVideo.count({
      where: { userId, amount: 0, createdAt: { gte: startOfMonth } },
    }),
    db.musicVideo.findMany({
      where:   { userId },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  {
        id:           true,
        trackTitle:   true,
        status:       true,
        mode:         true,
        thumbnailUrl: true,
        finalVideoUrl: true,
        style:        true,
        amount:       true,
        createdAt:    true,
      },
    }),
  ]);

  const credits = tier ? TIER_CREDITS[tier] ?? 0 : 0;
  const remaining = Math.max(0, credits - usedThisMonth);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
            >
              <Film size={16} style={{ color: "#D4A843" }} />
            </div>
            <h1 className="text-2xl font-black" style={{ color: "#F0F0F0" }}>Music Video Studio</h1>
          </div>
          <p className="text-sm" style={{ color: "#888" }}>
            Turn your tracks into cinematic AI-generated music videos.
          </p>
        </div>
      </div>

      {/* ── Credit status ── */}
      {tier && (
        <div
          className="rounded-2xl border px-6 py-5 flex items-center justify-between gap-4"
          style={{ borderColor: remaining > 0 ? "rgba(212,168,67,0.3)" : "#2A2A2A", backgroundColor: remaining > 0 ? "rgba(212,168,67,0.06)" : "#0F0F0F" }}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: remaining > 0 ? "#D4A843" : "#555" }}>
              Included this month
            </p>
            <p className="text-2xl font-black" style={{ color: remaining > 0 ? "#D4A843" : "#666" }}>
              {creditLabel(tier, usedThisMonth)} {remaining === 1 ? "video" : "videos"}
            </p>
            <p className="text-xs" style={{ color: "#666" }}>
              {remaining > 0
                ? `${remaining} included credit${remaining !== 1 ? "s" : ""} remaining on your ${tier.charAt(0) + tier.slice(1).toLowerCase()} plan.`
                : `All included credits used. You can still create videos for a one-time fee.`}
            </p>
          </div>
          {remaining > 0 && (
            <div className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
              <Check size={11} /> Active
            </div>
          )}
        </div>
      )}

      {/* ── Create CTAs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/video-studio?start=1&mode=QUICK"
          className="rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.01] no-underline"
          style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
              <Zap size={16} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#F0F0F0" }}>Quick Mode</p>
              <p className="text-xs" style={{ color: "#666" }}>
                {remaining > 0 ? "Included" : "from $14.99"}
              </p>
            </div>
          </div>
          <p className="text-xs" style={{ color: "#888" }}>
            Upload a track — AI handles the rest. Beat-synced scenes in ~15 minutes.
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: "#D4A843" }}>
            Start Quick Mode <ChevronRight size={12} />
          </div>
        </Link>

        <Link
          href="/video-studio?start=1&mode=DIRECTOR"
          className="rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.01] no-underline"
          style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(232,93,74,0.12)" }}>
              <Clapperboard size={16} style={{ color: "#E85D4A" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#F0F0F0" }}>Director Mode</p>
              <p className="text-xs" style={{ color: "#666" }}>
                {remaining > 0 ? "Included" : "from $24.99"}
              </p>
            </div>
          </div>
          <p className="text-xs" style={{ color: "#888" }}>
            Collaborate with AI to craft a creative brief, shot list, and bespoke video.
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: "#E85D4A" }}>
            Start Director Mode <ChevronRight size={12} />
          </div>
        </Link>
      </div>

      {/* ── Recent videos ── */}
      {recentVideos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#555" }}>Your Videos</h2>
          <div className="rounded-2xl border divide-y divide-[#2A2A2A]" style={{ borderColor: "#2A2A2A" }}>
            {recentVideos.map(v => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-4">
                {/* Thumbnail / icon */}
                <div
                  className="w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: "#1A1A1A" }}
                >
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt={v.trackTitle} className="w-full h-full object-cover" />
                  ) : (
                    <Film size={18} style={{ color: "#444" }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#F0F0F0" }}>{v.trackTitle}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                    {v.mode === "DIRECTOR" ? "Director" : "Quick"} &middot; {v.style ?? "—"} &middot; {relativeTime(v.createdAt)}
                  </p>
                </div>

                {/* Status + action */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[v.status] ?? "#888" }}>
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                  {v.status === "COMPLETE" && v.finalVideoUrl && (
                    <Link
                      href={`/video-studio/${v.id}/preview`}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
                    >
                      <Play size={11} /> View
                    </Link>
                  )}
                  {(v.status === "GENERATING" || v.status === "STITCHING" || v.status === "ANALYZING" || v.status === "PLANNING") && (
                    <Link
                      href={`/video-studio/${v.id}/generating`}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      style={{ backgroundColor: "#1A1A1A", color: "#D4A843" }}
                    >
                      <Clock size={11} /> Watch
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentVideos.length === 0 && (
        <div
          className="rounded-2xl border px-6 py-10 text-center"
          style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}
        >
          <Film size={28} style={{ color: "#333" }} className="mx-auto mb-3" />
          <p className="text-sm font-semibold" style={{ color: "#555" }}>No videos yet</p>
          <p className="text-xs mt-1" style={{ color: "#444" }}>
            Create your first music video above — results in about 15 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
