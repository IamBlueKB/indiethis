import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { linkGuestVideosByEmail }            from "@/lib/video-studio/link-guest";
import { linkGuestLyricVideosByEmail }       from "@/lib/lyric-video/link-guest";
import { linkGuestMasteringJobsByEmail }     from "@/lib/agents/mastering-conversion";
import Link from "next/link";
import ReleaseTimingCard from "@/components/dashboard/ReleaseTimingCard";
import {
  ArrowRight,
  AlertCircle,
  CreditCard,
  Calendar,
  Eye,
  Upload,
  Palette,
  MessageSquare,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Music2,
  Trophy,
  Zap,
} from "lucide-react";

// ─── Tiny SVG sparkline (server-renderable, no Recharts needed) ────────────────

function SparkLine({ data, color = "#D4A843" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 96;
  const H = 32;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - 2 - (v / max) * (H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible", display: "block", width: "100%" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on latest value */}
      {(() => {
        const last = data[data.length - 1];
        const x = W;
        const y = H - 2 - (last / max) * (H - 4);
        return (
          <circle cx={x} cy={y} r="3" fill={color} />
        );
      })()}
    </svg>
  );
}

// ─── Welcome action card (used in first-login banner) ──────────────────────────

function WelcomeAction({ href, label, sub, color }: { href: string; label: string; sub: string; color: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl border no-underline transition-colors hover:border-accent/40"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
      <ArrowRight size={12} className="shrink-0 text-muted-foreground ml-auto" />
    </Link>
  );
}

// ─── Percentage-change delta badge ─────────────────────────────────────────────

function Delta({ value, prev }: { value: number; prev: number }) {
  if (prev === 0 && value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (prev === 0) return <span className="text-xs font-semibold" style={{ color: "#34C759" }}>New</span>;
  const pct = ((value - prev) / prev) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className="text-xs font-semibold flex items-center gap-0.5"
      style={{ color: up ? "#34C759" : "#E85D4A" }}
    >
      <Icon size={10} strokeWidth={2.5} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage(
  { searchParams }: { searchParams: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const sp         = await searchParams;
  const showWelcome = sp.welcome === "1";

  // Session linking: link any guest-purchased videos/lyric-videos/mix jobs to this userId on first visit
  let linkedVideoCount = 0;
  let linkedMixCount   = 0;
  try {
    const userRecord = await db.user.findUnique({
      where:  { id: userId },
      select: { email: true, convertedFromGuestAt: true },
    });
    if (userRecord?.email) {
      const [{ linked: mv }, { linked: lv }, mjLinked, mxLinked] = await Promise.all([
        linkGuestVideosByEmail(userId, userRecord.email),
        linkGuestLyricVideosByEmail(userId, userRecord.email),
        linkGuestMasteringJobsByEmail(userRecord.email, userId),
        // Link any guest mix jobs and clear expiry so files are kept permanently
        db.mixJob.updateMany({
          where: { guestEmail: userRecord.email, userId: null },
          data:  { userId, expiresAt: null },
        }).then((r) => r.count),
      ]);
      linkedMixCount   = mxLinked;
      linkedVideoCount = mv + lv + mjLinked + mxLinked;
      // Record guest→account conversion timestamp on first link
      if (linkedVideoCount > 0 && !userRecord.convertedFromGuestAt) {
        await db.user.update({
          where: { id: userId },
          data:  { convertedFromGuestAt: new Date() },
        }).catch(() => {});
      }
    }
  } catch { /* non-fatal */ }

  const firstName = (session.user.name ?? "Artist").split(" ")[0];

  const now             = new Date();
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fiveMinAgo      = new Date(now.getTime() - 5 * 60 * 1000);
  const sevenDaysAgo    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    subscription,
    userProfile,
    upcomingSessions,
    activeViewers,
    latestTrack,
    topFans,
    merchThis,
    tipsThis,
    merchLast,
    tipsLast,
  ] = await Promise.all([
    db.subscription.findUnique({
      where:  { userId },
      select: { tier: true, status: true },
    }),
    db.user.findUnique({
      where:  { id: userId },
      select: { artistName: true, artistSlug: true, signupPath: true, setupCompletedAt: true },
    }),
    db.bookingSession.findMany({
      where:   { artistId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { dateTime: "asc" },
      take:    3,
      include: { studio: { select: { name: true } } },
    }),
    db.pageView.count({
      where: { artistId: userId, viewedAt: { gte: fiveMinAgo } },
    }),
    db.track.findFirst({
      where:   { artistId: userId },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, coverArtUrl: true, plays: true },
    }),
    db.fanScore.findMany({
      where:   { artistId: userId, totalSpend: { gt: 0 } },
      orderBy: { totalSpend: "desc" },
      take:    5,
    }),
    db.merchOrder.aggregate({
      where: { artistId: userId, createdAt: { gte: startOfMonth } },
      _sum:  { artistEarnings: true },
    }),
    db.artistSupport.aggregate({
      where: { artistId: userId, createdAt: { gte: startOfMonth } },
      _sum:  { amount: true },
    }),
    db.merchOrder.aggregate({
      where: { artistId: userId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum:  { artistEarnings: true },
    }),
    db.artistSupport.aggregate({
      where: { artistId: userId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum:  { amount: true },
    }),
  ]);

  // 7-day sparkline: bucket TrackPlay records by day
  let sparkData: number[] = Array(7).fill(0);
  if (latestTrack) {
    const plays = await db.trackPlay.findMany({
      where:  { trackId: latestTrack.id, playedAt: { gte: sevenDaysAgo } },
      select: { playedAt: true },
    });
    for (const p of plays) {
      const daysAgo = Math.floor((now.getTime() - p.playedAt.getTime()) / 86_400_000);
      if (daysAgo >= 0 && daysAgo < 7) sparkData[6 - daysAgo]++;
    }
  }

  // Revenue totals
  const revenueThis = (merchThis._sum.artistEarnings ?? 0) + (tipsThis._sum.amount ?? 0);
  const revenueLast = (merchLast._sum.artistEarnings ?? 0) + (tipsLast._sum.amount ?? 0);

  // Time-of-day greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const quickActions = [
    { label: "Upload Track",    sub: "Add to your catalog",   href: "/dashboard/music",       color: "#E85D4A", Icon: Upload       },
    { label: "Create Cover Art",sub: "AI-powered design",     href: "/dashboard/ai/video",    color: "#D4A843", Icon: Palette      },
    { label: "Send Blast",      sub: "SMS your fans",         href: "/dashboard/broadcasts",  color: "#5AC8FA", Icon: MessageSquare },
    { label: "View Analytics",  sub: "See what's trending",   href: "/dashboard/analytics",   color: "#34C759", Icon: BarChart2    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Header ── */}
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your command center.</p>
      </div>

      {/* ── Welcome banner (shown after setup completes) ── */}
      {showWelcome && (
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.25)" }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
            >
              <Zap size={16} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                Welcome to IndieThis, {firstName}! 🎉
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Here&apos;s what to do first:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {userProfile?.signupPath === "producer" ? (
              <>
                <WelcomeAction href="/dashboard/producer/beats?upload=1" label="Upload your first beat" sub="Start selling on the marketplace" color="#E85D4A" />
                <WelcomeAction href="/dashboard/settings" label="Set your license pricing" sub="Control how buyers use your beats" color="#D4A843" />
                <WelcomeAction href="/dashboard/marketplace" label="Explore the marketplace" sub="See what other producers are selling" color="#5AC8FA" />
              </>
            ) : (
              <>
                <WelcomeAction href="/dashboard/music?upload=1" label="Upload your first track" sub="Build your catalog from day one" color="#E85D4A" />
                <WelcomeAction href="/dashboard/ai/video" label="Create AI cover art" sub="Make your music stand out" color="#D4A843" />
                <WelcomeAction href="/dashboard/settings" label="Set up your artist page" sub="Get a shareable link for fans" color="#5AC8FA" />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Music Video link banner — shown when a guest video was just linked ── */}
      {linkedVideoCount > 0 && (
        <Link
          href="/dashboard/ai/video"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">🎬</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
                Your music {linkedVideoCount === 1 ? "video is" : "videos are"} already here
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                {linkedVideoCount === 1
                  ? "The video you created before signing up has been added to your account."
                  : `${linkedVideoCount} videos you created before signing up have been added to your account.`}
              </p>
            </div>
          </div>
          <ArrowRight size={14} style={{ color: "#D4A843" }} className="shrink-0" />
        </Link>
      )}

      {/* ── Mix Console link banner — shown when a guest mix was just linked ── */}
      {linkedMixCount > 0 && (
        <Link
          href="/mix-console"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">🎚️</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
                Your {linkedMixCount === 1 ? "mix is" : "mixes are"} already here
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                {linkedMixCount === 1
                  ? "The mix you created before signing up has been saved to your account."
                  : `${linkedMixCount} mixes you created before signing up have been saved to your account.`}
              </p>
            </div>
          </div>
          <ArrowRight size={14} style={{ color: "#D4A843" }} className="shrink-0" />
        </Link>
      )}

      {/* ── Banners ── */}
      {!userProfile?.artistSlug && (
        <Link
          href="/dashboard/settings"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(232,93,74,0.06)", borderColor: "rgba(232,93,74,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={15} style={{ color: "#E85D4A" }} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Complete your artist profile</p>
              <p className="text-xs text-muted-foreground">Set your artist name and public URL so fans can find you.</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-muted-foreground shrink-0 ml-3" />
        </Link>
      )}

      {!subscription && (
        <Link
          href="/dashboard/upgrade"
          className="flex items-center justify-between rounded-xl border px-4 py-3 no-underline transition-colors hover:border-accent/40"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <CreditCard size={15} style={{ color: "#D4A843" }} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">No active plan</p>
              <p className="text-xs text-muted-foreground">Choose a plan to unlock AI tools, merch, and your artist site.</p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full shrink-0 ml-3"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            View Plans
          </span>
        </Link>
      )}

      {/* ── Live viewers + Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-stretch">

        {/* Live viewers card */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-center gap-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(232,93,74,0.12)" }}
              >
                <Eye size={18} style={{ color: "#E85D4A" }} />
              </div>
              {activeViewers > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: "#34C759" }}
                />
              )}
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground font-display leading-none">{activeViewers}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {activeViewers === 1 ? "person" : "people"} on your page right now
          </p>
          {userProfile?.artistSlug && (
            <Link
              href={`/${userProfile.artistSlug}`}
              className="text-[11px] text-accent no-underline hover:opacity-80 flex items-center gap-1 mt-auto"
              target="_blank"
            >
              View your page <ArrowRight size={10} />
            </Link>
          )}
        </div>

        {/* Quick actions 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ label, sub, href, color, Icon }) => (
            <Link
              key={label}
              href={href}
              className="rounded-2xl border p-4 no-underline flex flex-col gap-2.5 hover:border-accent/40 transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                <Icon size={15} style={{ color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 3-col command cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Latest release */}
        <div
          className="rounded-2xl border p-5 space-y-4 flex flex-col"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Latest Release
            </p>
            <Link
              href="/dashboard/music"
              className="text-[11px] text-accent hover:opacity-80 no-underline flex items-center gap-0.5"
            >
              All <ArrowRight size={10} />
            </Link>
          </div>

          {latestTrack ? (
            <>
              <div className="flex items-center gap-3">
                {latestTrack.coverArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={latestTrack.coverArtUrl}
                    alt={latestTrack.title}
                    className="rounded-xl object-cover shrink-0"
                    style={{ width: 52, height: 52 }}
                  />
                ) : (
                  <div
                    className="rounded-xl shrink-0 flex items-center justify-center"
                    style={{ width: 52, height: 52, backgroundColor: "rgba(212,168,67,0.10)" }}
                  >
                    <Music2 size={18} style={{ color: "#D4A843" }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{latestTrack.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {latestTrack.plays.toLocaleString()} total play{latestTrack.plays !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">7-day plays</p>
                  <p className="text-[11px] font-semibold text-foreground">
                    {sparkData.reduce((a, b) => a + b, 0)}
                  </p>
                </div>
                <SparkLine data={sparkData} color="#D4A843" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
              <Music2 size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-xs text-muted-foreground">No tracks yet</p>
              <Link href="/dashboard/music" className="text-xs text-accent no-underline hover:opacity-80">
                Upload your first →
              </Link>
            </div>
          )}
        </div>

        {/* Top fans */}
        <div
          className="rounded-2xl border p-5 flex flex-col"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Top Fans
            </p>
            <Link
              href="/dashboard/fans"
              className="text-[11px] text-accent hover:opacity-80 no-underline flex items-center gap-0.5"
            >
              All <ArrowRight size={10} />
            </Link>
          </div>

          {topFans.length > 0 ? (
            <div className="space-y-3">
              {topFans.map((fan, i) => {
                const medals  = ["🥇", "🥈", "🥉", null, null];
                const handle  = fan.email.split("@")[0];
                const maxSpend = topFans[0].totalSpend;
                const pct = Math.round((fan.totalSpend / maxSpend) * 100);
                return (
                  <div key={fan.id} className="flex items-center gap-2.5">
                    <span className="text-sm shrink-0 w-5 text-center leading-none">
                      {medals[i] ?? (
                        <span className="text-[11px] text-muted-foreground">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground truncate">{handle}</span>
                        <span
                          className="text-xs font-bold ml-2 shrink-0"
                          style={{ color: "#D4A843" }}
                        >
                          ${fan.totalSpend.toFixed(0)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: "rgba(212,168,67,0.55)" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
              <Trophy size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-xs text-muted-foreground">No fan spend yet</p>
              <p className="text-[11px] text-muted-foreground/60">Merch + tip purchases appear here</p>
            </div>
          )}
        </div>

        {/* Revenue */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue
            </p>
            <Link
              href="/dashboard/earnings"
              className="text-[11px] text-accent hover:opacity-80 no-underline flex items-center gap-0.5"
            >
              Details <ArrowRight size={10} />
            </Link>
          </div>

          {/* This month big number */}
          <div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-foreground font-display leading-none">
                ${revenueThis.toFixed(2)}
              </p>
              <Delta value={revenueThis} prev={revenueLast} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            {[
              {
                label: "Merch",
                thisAmt: merchThis._sum.artistEarnings ?? 0,
                lastAmt: merchLast._sum.artistEarnings ?? 0,
                color: "#E85D4A",
              },
              {
                label: "Fan Tips",
                thisAmt: tipsThis._sum.amount ?? 0,
                lastAmt: tipsLast._sum.amount ?? 0,
                color: "#5AC8FA",
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">${row.thisAmt.toFixed(2)}</span>
                  <Delta value={row.thisAmt} prev={row.lastAmt} />
                </div>
              </div>
            ))}
          </div>

          {/* Last month comparison row */}
          <div
            className="rounded-xl px-3 py-2.5 flex items-center justify-between mt-auto"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span className="text-[11px] text-muted-foreground">Last month</span>
            <span className="text-[11px] font-semibold text-foreground">${revenueLast.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Best Time to Drop ── */}
      <ReleaseTimingCard />

      {/* ── Upcoming sessions ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-accent" />
            <p className="text-sm font-semibold text-foreground">Upcoming Sessions</p>
          </div>
          <Link
            href="/dashboard/sessions"
            className="flex items-center gap-1 text-xs text-accent no-underline hover:opacity-80"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {upcomingSessions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No upcoming sessions. Book studio time to get started.
          </p>
        ) : (
          upcomingSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{s.studio.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.dateTime).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: s.status === "CONFIRMED" ? "#5AC8FA" : "#D4A843" }}
              >
                {s.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
