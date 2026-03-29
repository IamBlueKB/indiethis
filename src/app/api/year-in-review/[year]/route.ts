/**
 * GET /api/year-in-review/[year]
 * Compiles all stats for the given calendar year for the authenticated artist.
 * No Claude API — pure DB aggregation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface YearInReview {
  year:               number;
  totalPlays:         number;
  totalEarnings:      number;
  earningsBySource:   { source: string; amount: number }[];
  topTracks:          { id: string; title: string; plays: number; coverArtUrl: string | null }[];
  totalFansGained:    number;
  totalMerchSold:     number;
  totalTips:          number;
  totalTipAmount:     number;
  monthlyPlayChart:   { month: string; value: number }[];
  monthlyEarnChart:   { month: string; value: number }[];
  soundDNA:           Record<string, number> | null;
  highlightMoment:    string;
  hasData:            boolean;
  monthsWithData:     number;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const userId   = session.user.id;
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd   = new Date(`${year}-12-31T23:59:59.999Z`);

  // ── Parallel data fetch ──────────────────────────────────────────────────
  const [
    trackPlays,
    merchOrders,
    tips,
    beatLicenses,
    streamPayments,
    tracks,
    audioFeatures,
  ] = await Promise.all([
    // Track plays this year
    db.trackPlay.findMany({
      where:   { track: { artistId: userId }, playedAt: { gte: yearStart, lte: yearEnd } },
      select:  { trackId: true, playedAt: true },
    }),
    // Merch orders this year
    db.merchOrder.findMany({
      where:  { artistId: userId, createdAt: { gte: yearStart, lte: yearEnd } },
      select: { artistEarnings: true, quantity: true, createdAt: true, buyerEmail: true },
    }),
    // Tips this year
    db.artistSupport.findMany({
      where:  { artistId: userId, createdAt: { gte: yearStart, lte: yearEnd } },
      select: { amount: true, createdAt: true, supporterEmail: true },
    }),
    // Beat licenses this year
    db.beatLicense.findMany({
      where:  { track: { artistId: userId }, createdAt: { gte: yearStart, lte: yearEnd } },
      select: { price: true, createdAt: true },
    }),
    // Stream lease payments this year
    db.streamLeasePayment.findMany({
      where:  { streamLease: { beat: { artistId: userId } }, paidAt: { gte: yearStart, lte: yearEnd } },
      select: { producerAmount: true, paidAt: true },
    }),
    // Artist's tracks
    db.track.findMany({
      where:  { artistId: userId },
      select: { id: true, title: true, coverArtUrl: true, totalPlays: true },
    }),
    // Audio features (average across all tracks)
    db.audioFeatures.findFirst({
      where:  { track: { artistId: userId } },
      select: { energy: true, danceability: true, valence: true, acousticness: true, instrumentalness: true },
    }),
  ]);

  // ── Plays ─────────────────────────────────────────────────────────────────
  const totalPlays = trackPlays.length;

  // Plays per track (from trackPlays log for this year)
  const playsByTrack: Record<string, number> = {};
  for (const p of trackPlays) {
    playsByTrack[p.trackId] = (playsByTrack[p.trackId] ?? 0) + 1;
  }

  const topTracks = tracks
    .map(t => ({ ...t, plays: playsByTrack[t.id] ?? 0 }))
    .filter(t => t.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  // Monthly play chart
  const monthlyPlayChart = MONTH_LABELS.map((month, mi) => {
    const value = trackPlays.filter(p => p.playedAt.getUTCMonth() === mi).length;
    return { month, value };
  });

  // ── Earnings ──────────────────────────────────────────────────────────────
  const merchEarnings  = merchOrders.reduce((s, o) => s + o.artistEarnings, 0);
  const tipEarnings    = tips.reduce((s, t) => s + t.amount, 0);
  const licenseEarnings = beatLicenses.reduce((s, l) => s + l.price, 0);
  const streamEarnings  = streamPayments.reduce((s, p) => s + p.producerAmount, 0);
  const totalEarnings   = merchEarnings + tipEarnings + licenseEarnings + streamEarnings;

  const earningsBySource = [
    { source: "Merch Sales",   amount: Math.round(merchEarnings   * 100) / 100 },
    { source: "Fan Tips",      amount: Math.round(tipEarnings     * 100) / 100 },
    { source: "Beat Licenses", amount: Math.round(licenseEarnings * 100) / 100 },
    { source: "Stream Leases", amount: Math.round(streamEarnings  * 100) / 100 },
  ].filter(e => e.amount > 0);

  // Monthly earnings chart
  const allEarningEvents = [
    ...merchOrders.map(o  => ({ date: o.createdAt,  amount: o.artistEarnings  })),
    ...tips.map(t         => ({ date: t.createdAt,  amount: t.amount          })),
    ...beatLicenses.map(l => ({ date: l.createdAt,  amount: l.price           })),
    ...streamPayments.map(p => ({ date: p.paidAt,    amount: p.producerAmount })),
  ];

  const monthlyEarnChart = MONTH_LABELS.map((month, mi) => {
    const value = allEarningEvents
      .filter(e => e.date.getUTCMonth() === mi)
      .reduce((s, e) => s + e.amount, 0);
    return { month, value: Math.round(value * 100) / 100 };
  });

  // ── Fans ──────────────────────────────────────────────────────────────────
  const uniqueFanEmails = new Set([
    ...merchOrders.map(o => o.buyerEmail.toLowerCase()),
    ...tips.map(t => t.supporterEmail.toLowerCase()),
  ]);
  const totalFansGained = uniqueFanEmails.size;

  // ── Merch ─────────────────────────────────────────────────────────────────
  const totalMerchSold = merchOrders.reduce((s, o) => s + o.quantity, 0);

  // ── Tips ─────────────────────────────────────────────────────────────────
  const totalTips      = tips.length;
  const totalTipAmount = Math.round(tipEarnings * 100) / 100;

  // ── Sound DNA ─────────────────────────────────────────────────────────────
  let soundDNA: Record<string, number> | null = null;
  if (audioFeatures) {
    soundDNA = {
      Energy:           Math.round((audioFeatures.energy          ?? 0.5) * 100),
      Danceability:     Math.round((audioFeatures.danceability    ?? 0.5) * 100),
      Positivity:       Math.round((audioFeatures.valence         ?? 0.5) * 100),
      Acousticness:     Math.round((audioFeatures.acousticness    ?? 0.5) * 100),
      Instrumentalness: Math.round((audioFeatures.instrumentalness ?? 0.5) * 100),
    };
  }

  // ── Highlight moment ──────────────────────────────────────────────────────
  let highlightMoment = "You made music this year — and that's everything.";

  if (topTracks[0] && topTracks[0].plays > 0) {
    highlightMoment = `"${topTracks[0].title}" was your most-played track with ${topTracks[0].plays.toLocaleString()} plays.`;
  }
  if (totalEarnings > 0) {
    const biggestSale = Math.max(...beatLicenses.map(l => l.price), 0);
    if (biggestSale >= 50) {
      highlightMoment = `Your biggest single license sale was $${biggestSale.toFixed(0)} — your best deal of the year.`;
    } else if (totalEarnings >= 500) {
      highlightMoment = `You earned $${totalEarnings.toFixed(0)} total this year. Real money for real music.`;
    }
  }
  const maxTip = Math.max(...tips.map(t => t.amount), 0);
  if (maxTip >= 20) {
    highlightMoment = `A fan sent you a $${maxTip.toFixed(0)} tip — that's love in action.`;
  }

  // ── Has data check ────────────────────────────────────────────────────────
  const monthsWithData = monthlyPlayChart.filter(m => m.value > 0).length +
                         monthlyEarnChart.filter(m => m.value > 0).length;
  const hasData = totalPlays > 0 || totalEarnings > 0 || totalFansGained > 0;

  const data: YearInReview = {
    year,
    totalPlays,
    totalEarnings:   Math.round(totalEarnings * 100) / 100,
    earningsBySource,
    topTracks,
    totalFansGained,
    totalMerchSold,
    totalTips,
    totalTipAmount,
    monthlyPlayChart,
    monthlyEarnChart,
    soundDNA,
    highlightMoment,
    hasData,
    monthsWithData:  Math.ceil(monthsWithData / 2),
  };

  return NextResponse.json({ data });
}
