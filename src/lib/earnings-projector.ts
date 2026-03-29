import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EarningsProjection {
  currentMonthlyAvg:  number;
  growthRate:         number;   // decimal, e.g. 0.08 = +8%/mo
  topRevenueSource:   string;
  topRevenuePercentage: number;
  projections: {
    months:           number;
    atCurrentRate:    number;
    withGrowth:       number;
    withDoubleOutput: number;
  }[];
  /** Past 6 months actual data for the chart */
  monthlyData: { label: string; amount: number }[];
  /** Chart-ready series: past actual + 12-month projection */
  chartData: {
    label:             string;
    actual:            number | null;
    projectedFlat:     number | null;
    projectedGrowth:   number | null;
  }[];
  revenueBreakdown: { source: string; amount: number; percentage: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export async function projectEarnings(
  artistId: string
): Promise<EarningsProjection | null> {
  const since = new Date();
  since.setMonth(since.getMonth() - 6);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [merchOrders, tips, beatLicenses, streamPayments] = await Promise.all([
    db.merchOrder.findMany({
      where:  { artistId, createdAt: { gte: since } },
      select: { artistEarnings: true, createdAt: true },
    }),
    db.artistSupport.findMany({
      where:  { artistId, createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
    }),
    db.beatLicense.findMany({
      where:  { producerId: artistId, createdAt: { gte: since } },
      select: { price: true, createdAt: true },
    }),
    db.streamLeasePayment.findMany({
      where:  { producerId: artistId, paidAt: { gte: since } },
      select: { producerAmount: true, paidAt: true },
    }),
  ]);

  // ── Build per-month totals ────────────────────────────────────────────────
  const now = new Date();

  // Generate the last 6 calendar months (oldest first)
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(monthKey(addMonths(now, -i)));
  }

  const monthMap: Record<string, { merch: number; tips: number; beats: number; leases: number }> = {};
  for (const k of monthKeys) monthMap[k] = { merch: 0, tips: 0, beats: 0, leases: 0 };

  for (const o of merchOrders)     { const k = monthKey(o.createdAt); if (monthMap[k]) monthMap[k].merch  += o.artistEarnings; }
  for (const t of tips)            { const k = monthKey(t.createdAt); if (monthMap[k]) monthMap[k].tips   += t.amount; }
  for (const b of beatLicenses)    { const k = monthKey(b.createdAt); if (monthMap[k]) monthMap[k].beats  += b.price; }
  for (const s of streamPayments)  { const k = monthKey(s.paidAt);    if (monthMap[k]) monthMap[k].leases += s.producerAmount; }

  const monthlyTotals = monthKeys.map(k => {
    const m = monthMap[k];
    return m.merch + m.tips + m.beats + m.leases;
  });

  // Need at least 2 months with any revenue
  if (monthlyTotals.filter(t => t > 0).length < 2) return null;

  // ── Averages & growth rate ────────────────────────────────────────────────
  const recent3     = monthlyTotals.slice(-3);
  const avgMonthly  = recent3.reduce((a, b) => a + b, 0) / recent3.length;

  let growthSum = 0, growthN = 0;
  for (let i = 1; i < monthlyTotals.length; i++) {
    if (monthlyTotals[i - 1] > 0) {
      growthSum += (monthlyTotals[i] - monthlyTotals[i - 1]) / monthlyTotals[i - 1];
      growthN++;
    }
  }
  const growthRate = growthN > 0
    ? Math.max(-0.5, Math.min(1.0, growthSum / growthN))
    : 0;

  // ── Forward projections ───────────────────────────────────────────────────
  const projections = [3, 6, 12].map(m => ({
    months:           m,
    atCurrentRate:    avgMonthly * m,
    withGrowth:       growthRate === 0
      ? avgMonthly * m
      : avgMonthly * ((Math.pow(1 + growthRate, m) - 1) / growthRate),
    withDoubleOutput: avgMonthly * 2 * m,
  }));

  // ── Revenue breakdown (all-time in window) ────────────────────────────────
  const totalMerch  = merchOrders.reduce((s, o)  => s + o.artistEarnings,  0);
  const totalTips   = tips.reduce((s, t)          => s + t.amount,          0);
  const totalBeats  = beatLicenses.reduce((s, b)  => s + b.price,           0);
  const totalLeases = streamPayments.reduce((s, p) => s + p.producerAmount,  0);
  const grandTotal  = totalMerch + totalTips + totalBeats + totalLeases;

  const revenueBreakdown = [
    { source: "Merch Sales",   amount: totalMerch  },
    { source: "Fan Tips",      amount: totalTips   },
    { source: "Beat Licenses", amount: totalBeats  },
    { source: "Stream Leases", amount: totalLeases },
  ]
    .filter(b => b.amount > 0)
    .map(b => ({ ...b, percentage: grandTotal > 0 ? Math.round((b.amount / grandTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const topSource = revenueBreakdown[0] ?? { source: "—", percentage: 0 };

  // ── Monthly data for the chart (past 6 months) ────────────────────────────
  const monthlyData = monthKeys.map((k, i) => ({
    label:  monthLabel(new Date(k + "-15")),
    amount: monthlyTotals[i],
  }));

  // ── Build chart data: past 6 + future 12 ─────────────────────────────────
  const chartData: EarningsProjection["chartData"] = [];

  // Past months (actual, no projection)
  for (let i = 0; i < monthKeys.length - 1; i++) {
    chartData.push({
      label:           monthlyData[i].label,
      actual:          monthlyTotals[i],
      projectedFlat:   null,
      projectedGrowth: null,
    });
  }

  // Last actual month = transition point (both actual + projection start)
  const lastActual = monthlyTotals[monthlyTotals.length - 1];
  chartData.push({
    label:           monthlyData[monthlyData.length - 1].label,
    actual:          lastActual,
    projectedFlat:   avgMonthly,
    projectedGrowth: avgMonthly,
  });

  // Future 12 months
  for (let i = 1; i <= 12; i++) {
    const futureDate = addMonths(now, i);
    chartData.push({
      label:           monthLabel(futureDate),
      actual:          null,
      projectedFlat:   avgMonthly,
      projectedGrowth: avgMonthly * Math.pow(1 + growthRate, i),
    });
  }

  return {
    currentMonthlyAvg: avgMonthly,
    growthRate,
    topRevenueSource:    topSource.source,
    topRevenuePercentage: topSource.percentage,
    projections,
    monthlyData,
    chartData,
    revenueBreakdown,
  };
}
