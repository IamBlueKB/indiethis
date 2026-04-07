/**
 * src/lib/agents/revenue-report.ts
 *
 * Revenue Report Agent — scheduled business summary email for Blue.
 * Gathers all platform metrics for the configured period, builds a
 * scannable HTML report, and sends it to all configured recipients.
 *
 * Also called on every cron run to check threshold alerts.
 * Called on-demand from the admin panel "Send Now" and "Preview" buttons.
 */

import { db }              from "@/lib/db";
import { sendEmail }       from "@/lib/brevo/email";
import { buildEmailTemplate } from "@/lib/brevo/email-template";
import { logAgentAction, AT } from "@/lib/agents";

const AGENT = "REVENUE_REPORT";

// ─── Tier prices (cents) ─────────────────────────────────────────────────────

const TIER_PRICES: Record<string, number> = {
  LAUNCH: 1900,
  PUSH:   4900,
  REIGN:  9900,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RevenueReport {
  period:    string;
  frequency: string;

  revenue: {
    total:               number;
    subscriptions:       number;
    ppu:                 number;
    merchCut:            number;
    beatLicensing:       number;
    digitalSales:        number;
    fanFunding:          number;
    samplePacks:         number;
    previousPeriodTotal: number;
    changePercent:       number;
    mrr:                 number;
  };

  users: {
    newSignups:          number;
    newSubscribers:      number;
    churned:             number;
    netGrowth:           number;
    totalActive:         number;
    signupsByProvider:   { email: number; google: number; facebook: number };
  };

  products: {
    mostUsedAiTool:    { name: string; count: number } | null;
    leastUsedAiTool:   { name: string; count: number } | null;
    topMerchProduct:   { name: string; sales: number } | null;
    topDigitalProduct: { name: string; sales: number } | null;
    topBeat:           { name: string; licenses: number } | null;
  };

  engagement: {
    totalPlays:       number;
    exploreVisits:    number;
    mostPlayedTrack:  { title: string; artist: string; plays: number } | null;
    newCrateAdds:     number;
    fanFundingTotal:  number;
  };

  agents: {
    totalActions:           number;
    paymentRecoverySaves:   number;
    paymentRecoveryRevenue: number;
    churnRiskCount:         number;
  };

  goals: Array<{
    id:           string;
    metric:       string;
    targetValue:  number;
    currentValue: number;
    period:       string;
  }>;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodBounds(frequency: string, config: { dayOfWeek?: number; dayOfMonth?: number }): {
  start:      Date;
  end:        Date;
  prevStart:  Date;
  prevEnd:    Date;
  label:      string;
  periodKey:  string;
} {
  const now = new Date();

  if (frequency === "DAILY") {
    const start    = new Date(now); start.setUTCHours(0, 0, 0, 0);
    const end      = new Date(now); end.setUTCHours(23, 59, 59, 999);
    const prevStart = new Date(start); prevStart.setUTCDate(prevStart.getUTCDate() - 1);
    const prevEnd   = new Date(end);   prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const label    = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const periodKey = now.toISOString().slice(0, 10);
    return { start, end, prevStart, prevEnd, label, periodKey };
  }

  if (frequency === "WEEKLY") {
    const end      = new Date(now); end.setUTCHours(23, 59, 59, 999);
    const start    = new Date(end); start.setUTCDate(start.getUTCDate() - 6); start.setUTCHours(0, 0, 0, 0);
    const prevEnd   = new Date(start); prevEnd.setUTCDate(prevEnd.getUTCDate() - 1); prevEnd.setUTCHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd); prevStart.setUTCDate(prevStart.getUTCDate() - 6); prevStart.setUTCHours(0, 0, 0, 0);
    const fmt       = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const label     = `${fmt(start)}–${fmt(end)}, ${end.getUTCFullYear()}`;
    const week      = Math.ceil(now.getUTCDate() / 7);
    const periodKey = `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    return { start, end, prevStart, prevEnd, label, periodKey };
  }

  // MONTHLY
  const start     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end       = new Date(now); end.setUTCHours(23, 59, 59, 999);
  const prevEnd   = new Date(start); prevEnd.setUTCDate(0); prevEnd.setUTCHours(23, 59, 59, 999);
  const prevStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1));
  const label     = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, prevStart, prevEnd, label, periodKey };
}

function currentMonthPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── Data gathering ───────────────────────────────────────────────────────────

async function gatherRevenue(start: Date, end: Date, prevStart: Date, prevEnd: Date) {
  const [
    activeSubs,
    ppuJobs,
    merchOrders,
    beatLicenses,
    digitalPurchases,
    fanFunding,
    prevPpuJobs,
    prevMerchOrders,
    prevBeatLicenses,
    prevDigitalPurchases,
    prevFanFunding,
  ] = await Promise.all([
    // Active subscriptions (for MRR and period sub revenue)
    db.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { tier: true },
    }),
    // PPU AI jobs with charges in period
    db.aIJob.findMany({
      where: { createdAt: { gte: start, lte: end }, priceCharged: { gt: 0 } },
      select: { priceCharged: true },
    }),
    // Merch platform cuts in period
    db.merchOrder.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { platformCut: true },
    }),
    // Beat licenses in period
    db.beatLicense.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { price: true },
    }),
    // Digital purchase fees in period
    db.digitalPurchase.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { platformFee: true },
    }),
    // Fan funding in period
    db.fanFunding.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { amount: true },
    }),
    // Previous period: PPU
    db.aIJob.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd }, priceCharged: { gt: 0 } },
      select: { priceCharged: true },
    }),
    // Previous period: Merch
    db.merchOrder.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { platformCut: true },
    }),
    // Previous period: Beat licenses
    db.beatLicense.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { price: true },
    }),
    // Previous period: Digital purchases
    db.digitalPurchase.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { platformFee: true },
    }),
    // Previous period: Fan funding
    db.fanFunding.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { amount: true },
    }),
  ]);

  // Current period new subs revenue (sub created in period × tier price)
  const newSubsInPeriod = await db.subscription.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { tier: true },
  });
  const subscriptions = newSubsInPeriod.reduce((sum, s) => sum + (TIER_PRICES[s.tier] ?? 0), 0);

  const ppu          = Math.round(ppuJobs.reduce((sum, j) => sum + (j.priceCharged ?? 0), 0) * 100);
  const merchCut     = Math.round(merchOrders.reduce((sum, o) => sum + (o.platformCut ?? 0), 0) * 100);
  const beatLicensing = Math.round(beatLicenses.reduce((sum, b) => sum + (b.price ?? 0) * 0.15, 0) * 100);
  const digitalSales = digitalPurchases.reduce((sum, d) => sum + (d.platformFee ?? 0), 0);
  const fanFundingTotal = fanFunding.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const samplePacks  = 0; // no model yet

  const total = subscriptions + ppu + merchCut + beatLicensing + digitalSales;

  // Previous period totals
  const prevNewSubs  = await db.subscription.findMany({
    where: { createdAt: { gte: prevStart, lte: prevEnd } },
    select: { tier: true },
  });
  const prevSubs   = prevNewSubs.reduce((sum, s) => sum + (TIER_PRICES[s.tier] ?? 0), 0);
  const prevPpu    = Math.round(prevPpuJobs.reduce((sum, j) => sum + (j.priceCharged ?? 0), 0) * 100);
  const prevMerch  = Math.round(prevMerchOrders.reduce((sum, o) => sum + (o.platformCut ?? 0), 0) * 100);
  const prevBeat   = Math.round(prevBeatLicenses.reduce((sum, b) => sum + (b.price ?? 0) * 0.15, 0) * 100);
  const prevDigital = prevDigitalPurchases.reduce((sum, d) => sum + (d.platformFee ?? 0), 0);
  const previousPeriodTotal = prevSubs + prevPpu + prevMerch + prevBeat + prevDigital;

  const changePercent = previousPeriodTotal > 0
    ? Math.round(((total - previousPeriodTotal) / previousPeriodTotal) * 100)
    : 0;

  // MRR from all active subs
  const mrr = activeSubs.reduce((sum, s) => sum + (TIER_PRICES[s.tier] ?? 0), 0);

  return {
    total,
    subscriptions,
    ppu,
    merchCut,
    beatLicensing,
    digitalSales,
    fanFunding: fanFundingTotal,
    samplePacks,
    previousPeriodTotal,
    changePercent,
    mrr,
  };
}

async function gatherUsers(start: Date, end: Date) {
  const [newSignupsList, newSubscribersList, churnedList, totalActiveCount] = await Promise.all([
    db.user.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { authProvider: true },
    }),
    db.subscription.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true },
    }),
    db.subscription.findMany({
      where: { canceledAt: { gte: start, lte: end } },
      select: { id: true },
    }),
    db.user.count({
      where: { subscription: { status: "ACTIVE" } },
    }),
  ]);

  const signupsByProvider = { email: 0, google: 0, facebook: 0 };
  for (const u of newSignupsList) {
    const p = (u.authProvider ?? "email").toLowerCase();
    if (p === "google")   signupsByProvider.google++;
    else if (p === "facebook") signupsByProvider.facebook++;
    else                  signupsByProvider.email++;
  }

  const newSignups     = newSignupsList.length;
  const newSubscribers = newSubscribersList.length;
  const churned        = churnedList.length;
  const netGrowth      = newSubscribers - churned;

  return {
    newSignups,
    newSubscribers,
    churned,
    netGrowth,
    totalActive: totalActiveCount,
    signupsByProvider,
  };
}

async function gatherProducts(start: Date, end: Date) {
  const [aiJobs, merchItems, digitalPurchases, beatLicenses] = await Promise.all([
    db.aIJob.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { type: true },
    }),
    db.merchOrderItem.findMany({
      where: { order: { createdAt: { gte: start, lte: end } } },
      select: { productId: true, product: { select: { title: true } } },
    }),
    db.digitalPurchase.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { digitalProductId: true, digitalProduct: { select: { title: true } } },
    }),
    db.beatLicense.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { trackId: true, track: { select: { title: true } } },
    }),
  ]);

  // AI tool usage counts
  const toolCounts: Record<string, number> = {};
  for (const job of aiJobs) {
    toolCounts[job.type] = (toolCounts[job.type] ?? 0) + 1;
  }
  const toolEntries = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
  const AI_TOOL_LABELS: Record<string, string> = {
    VIDEO:            "AI Video",
    COVER_ART:        "Cover Art",
    MASTERING:        "Mastering",
    LYRIC_VIDEO:      "Lyric Video",
    AR_REPORT:        "AAR Report",
    PRESS_KIT:        "Press Kit",
    BIO_GENERATOR:    "Bio Generator",
    CONTRACT_SCANNER: "Contract Scanner",
  };
  const mostUsedAiTool  = toolEntries[0]
    ? { name: AI_TOOL_LABELS[toolEntries[0][0]] ?? toolEntries[0][0], count: toolEntries[0][1] }
    : null;
  const leastUsedAiTool = toolEntries.length > 1
    ? { name: AI_TOOL_LABELS[toolEntries[toolEntries.length - 1][0]] ?? toolEntries[toolEntries.length - 1][0], count: toolEntries[toolEntries.length - 1][1] }
    : null;

  // Top merch product
  const merchCounts: Record<string, { name: string; count: number }> = {};
  for (const item of merchItems) {
    if (!merchCounts[item.productId]) {
      merchCounts[item.productId] = { name: item.product?.title ?? "Unknown", count: 0 };
    }
    merchCounts[item.productId].count++;
  }
  const topMerchEntry = Object.values(merchCounts).sort((a, b) => b.count - a.count)[0];
  const topMerchProduct = topMerchEntry ? { name: topMerchEntry.name, sales: topMerchEntry.count } : null;

  // Top digital product
  const digitalCounts: Record<string, { name: string; count: number }> = {};
  for (const dp of digitalPurchases) {
    if (!digitalCounts[dp.digitalProductId]) {
      digitalCounts[dp.digitalProductId] = { name: (dp.digitalProduct as { title?: string })?.title ?? "Unknown", count: 0 };
    }
    digitalCounts[dp.digitalProductId].count++;
  }
  const topDigitalEntry = Object.values(digitalCounts).sort((a, b) => b.count - a.count)[0];
  const topDigitalProduct = topDigitalEntry ? { name: topDigitalEntry.name, sales: topDigitalEntry.count } : null;

  // Top beat
  const beatCounts: Record<string, { name: string; count: number }> = {};
  for (const bl of beatLicenses) {
    if (!beatCounts[bl.trackId]) {
      beatCounts[bl.trackId] = { name: bl.track?.title ?? "Unknown", count: 0 };
    }
    beatCounts[bl.trackId].count++;
  }
  const topBeatEntry = Object.values(beatCounts).sort((a, b) => b.count - a.count)[0];
  const topBeat = topBeatEntry ? { name: topBeatEntry.name, licenses: topBeatEntry.count } : null;

  return { mostUsedAiTool, leastUsedAiTool, topMerchProduct, topDigitalProduct, topBeat };
}

async function gatherEngagement(start: Date, end: Date) {
  const [allPlays, crateAdds, fanFundingRecords] = await Promise.all([
    db.trackPlay.findMany({
      where: { playedAt: { gte: start, lte: end } },
      select: { trackId: true, track: { select: { title: true, artist: { select: { name: true } } } } },
    }),
    db.crateItem.count({ where: { addedAt: { gte: start, lte: end } } }),
    db.fanFunding.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { amount: true },
    }),
  ]);

  const totalPlays = allPlays.length;

  // Most played track
  const playCounts: Record<string, { title: string; artist: string; plays: number }> = {};
  for (const play of allPlays) {
    if (!playCounts[play.trackId]) {
      playCounts[play.trackId] = {
        title:  play.track?.title ?? "Unknown",
        artist: play.track?.artist?.name ?? "Unknown",
        plays:  0,
      };
    }
    playCounts[play.trackId].plays++;
  }
  const mostPlayedEntry = Object.values(playCounts).sort((a, b) => b.plays - a.plays)[0];
  const mostPlayedTrack = mostPlayedEntry ?? null;

  const fanFundingTotal = fanFundingRecords.reduce((sum, f) => sum + (f.amount ?? 0), 0);

  return {
    totalPlays,
    exploreVisits: 0, // PostHog — not available via DB
    mostPlayedTrack,
    newCrateAdds: crateAdds,
    fanFundingTotal,
  };
}

async function gatherAgents(start: Date, end: Date) {
  const [totalActions, recoveryLogs, churnRiskCount] = await Promise.all([
    db.agentLog.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.agentLog.findMany({
      where: {
        agentType: AT("PAYMENT_RECOVERY"),
        action:    { contains: "RECOVERED" },
        createdAt: { gte: start, lte: end },
      },
      select: { details: true },
    }),
    db.user.count({ where: { churnRiskScore: { gt: 60 } } }),
  ]);

  const paymentRecoveryRevenue = recoveryLogs.reduce((sum, log) => {
    const d = log.details as Record<string, unknown> | null;
    return sum + (typeof d?.amountCents === "number" ? d.amountCents : 0);
  }, 0);

  return {
    totalActions,
    paymentRecoverySaves:   recoveryLogs.length,
    paymentRecoveryRevenue,
    churnRiskCount,
  };
}

async function gatherGoals(periodKey: string): Promise<RevenueReport["goals"]> {
  return db.revenueReportGoal.findMany({
    where: { period: periodKey },
    select: { id: true, metric: true, targetValue: true, currentValue: true, period: true },
    orderBy: { createdAt: "asc" },
  });
}

async function updateGoalCurrentValues(
  goals:      RevenueReport["goals"],
  users:      RevenueReport["users"],
  revenue:    RevenueReport["revenue"],
) {
  for (const goal of goals) {
    let current = 0;
    switch (goal.metric) {
      case "SUBSCRIBERS": current = users.totalActive;       break;
      case "MRR":         current = revenue.mrr;             break;
      case "REVENUE":     current = revenue.total;           break;
      case "SIGNUPS":     current = users.newSignups;        break;
    }
    await db.revenueReportGoal.update({
      where: { id: goal.id },
      data:  { currentValue: current },
    });
    goal.currentValue = current;
  }
}

// ─── Full data compilation ────────────────────────────────────────────────────

export async function compileReport(frequency?: string, config?: { dayOfWeek?: number; dayOfMonth?: number }): Promise<RevenueReport> {
  const cfg      = config ?? {};
  const freq     = frequency ?? "WEEKLY";
  const { start, end, prevStart, prevEnd, label, periodKey } = getPeriodBounds(freq, cfg);
  const monthKey = currentMonthPeriod();

  const [revenueData, usersData, productsData, engagementData, agentsData, goals] = await Promise.all([
    gatherRevenue(start, end, prevStart, prevEnd),
    gatherUsers(start, end),
    gatherProducts(start, end),
    gatherEngagement(start, end),
    gatherAgents(start, end),
    gatherGoals(monthKey),
  ]);

  await updateGoalCurrentValues(goals, usersData, revenueData);

  return {
    period:     label,
    frequency:  freq,
    revenue:    revenueData,
    users:      usersData,
    products:   productsData,
    engagement: engagementData,
    agents:     agentsData,
    goals,
  };
}

// ─── Email template ───────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function changeTag(pct: number): string {
  if (pct === 0) return `<span style="color:#888;">— 0%</span>`;
  const color = pct > 0 ? "#4CAF50" : "#E85D4A";
  const arrow = pct > 0 ? "↑" : "↓";
  return `<span style="color:${color};">${arrow} ${Math.abs(pct)}%</span>`;
}

function progressBar(current: number, target: number, daysElapsed: number, daysTotal: number): {
  bar: string;
  pct: string;
  pace: string;
  paceColor: string;
} {
  const pct      = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const expected = daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 100) : 0;
  const onTrack  = pct >= expected - 5;
  const filled   = Math.round(pct / 8.33); // 12 chars wide
  const empty    = 12 - filled;
  const bar      = "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
  return {
    bar,
    pct:       `${pct}%`,
    pace:      onTrack ? "On track" : "Behind pace",
    paceColor: onTrack ? "#D4A843" : "#E85D4A",
  };
}

function metricLabel(metric: string): string {
  switch (metric) {
    case "SUBSCRIBERS": return "Subscribers";
    case "MRR":         return "MRR";
    case "REVENUE":     return "Total Revenue";
    case "SIGNUPS":     return "New Signups";
    default:            return metric;
  }
}

function metricDisplay(metric: string, value: number): string {
  return ["MRR", "REVENUE"].includes(metric) ? fmt(value) : fmtNum(value);
}

export function buildReportEmail(
  report:   RevenueReport,
  sections: string[],
): string {
  const has = (s: string) => sections.includes(s);

  const now       = new Date();
  const daysTotal = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysLeft    = daysTotal - daysElapsed;

  const sectionHeader = (title: string) =>
    `<p style="margin:24px 0 8px;font-size:11px;font-weight:700;color:#D4A843;letter-spacing:1.5px;text-transform:uppercase;">${title}</p>`;

  const row = (label: string, value: string, indent = false) =>
    `<p style="margin:2px 0;font-size:13px;color:#C8C8C8;${indent ? "padding-left:16px;" : ""}">
      <span style="color:#888;">${label}</span>&ensp;${value}
    </p>`;

  let body = `<p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>`;
  body    += `<p style="margin:0 0 20px;font-size:13px;color:#666;">Revenue Report &mdash; ${report.period}</p>`;

  // ── Revenue ──
  if (has("revenue")) {
    body += sectionHeader("Revenue");
    body += row("Total:", `<strong style="color:#fff;">${fmt(report.revenue.total)}</strong> &nbsp;${changeTag(report.revenue.changePercent)} vs last period`);
    body += row("├── Subscriptions:", fmt(report.revenue.subscriptions), true);
    body += row("├── PPU Tools:", fmt(report.revenue.ppu), true);
    body += row("├── Merch:", fmt(report.revenue.merchCut), true);
    body += row("├── Beat Licensing:", fmt(report.revenue.beatLicensing), true);
    body += row("├── Digital Sales:", fmt(report.revenue.digitalSales), true);
    body += row("├── Fan Funding:", fmt(report.revenue.fanFunding), true);
    body += row("└── Sample Packs:", fmt(report.revenue.samplePacks), true);
    body += `<p style="margin:6px 0 0;font-size:13px;color:#C8C8C8;"><span style="color:#888;">MRR:</span>&ensp;<strong style="color:#D4A843;">${fmt(report.revenue.mrr)}</strong></p>`;
  }

  // ── Users ──
  if (has("users")) {
    body += sectionHeader("Users");
    body += row(
      "New Signups:",
      `${fmtNum(report.users.newSignups)} <span style="color:#555;font-size:12px;">(Email: ${report.users.signupsByProvider.email}, Google: ${report.users.signupsByProvider.google}, Facebook: ${report.users.signupsByProvider.facebook})</span>`
    );
    body += row("New Subscribers:", fmtNum(report.users.newSubscribers));
    body += row("Churned:", fmtNum(report.users.churned));
    const growthColor = report.users.netGrowth >= 0 ? "#4CAF50" : "#E85D4A";
    body += row("Net Growth:", `<span style="color:${growthColor};">${report.users.netGrowth >= 0 ? "+" : ""}${report.users.netGrowth}</span>`);
    body += row("Total Active:", `<strong style="color:#fff;">${fmtNum(report.users.totalActive)}</strong>`);
  }

  // ── Products ──
  if (has("products")) {
    body += sectionHeader("Products");
    body += row("Most Used AI Tool:", report.products.mostUsedAiTool ? `${report.products.mostUsedAiTool.name} (${fmtNum(report.products.mostUsedAiTool.count)} uses)` : "—");
    body += row("Least Used AI Tool:", report.products.leastUsedAiTool ? `${report.products.leastUsedAiTool.name} (${fmtNum(report.products.leastUsedAiTool.count)} uses)` : "—");
    body += row("Top Merch:", report.products.topMerchProduct ? `${report.products.topMerchProduct.name} (${fmtNum(report.products.topMerchProduct.sales)} sold)` : "—");
    body += row("Top Digital:", report.products.topDigitalProduct ? `${report.products.topDigitalProduct.name} (${fmtNum(report.products.topDigitalProduct.sales)} sold)` : "—");
    body += row("Top Beat:", report.products.topBeat ? `${report.products.topBeat.name} (${fmtNum(report.products.topBeat.licenses)} licensed)` : "—");
  }

  // ── Engagement ──
  if (has("engagement")) {
    body += sectionHeader("Engagement");
    body += row("Track Plays:", fmtNum(report.engagement.totalPlays));
    body += row(
      "Most Played:",
      report.engagement.mostPlayedTrack
        ? `&ldquo;${report.engagement.mostPlayedTrack.title}&rdquo; by ${report.engagement.mostPlayedTrack.artist} (${fmtNum(report.engagement.mostPlayedTrack.plays)} plays)`
        : "—"
    );
    body += row("New DJ Crate Adds:", fmtNum(report.engagement.newCrateAdds));
    body += row("Fan Funding Received:", fmt(report.engagement.fanFundingTotal));
  }

  // ── Agents ──
  if (has("agents")) {
    body += sectionHeader("Agents");
    body += row("Actions This Period:", fmtNum(report.agents.totalActions));
    body += row(
      "Payment Recovery:",
      `${fmtNum(report.agents.paymentRecoverySaves)} saves (${fmt(report.agents.paymentRecoveryRevenue)} recovered)`
    );
    body += row("Churn Risk:", `${fmtNum(report.agents.churnRiskCount)} users at risk`);
  }

  // ── Goals ──
  if (has("goals") && report.goals.length > 0) {
    body += sectionHeader("Goals");
    for (const goal of report.goals) {
      const { bar, pct, pace, paceColor } = progressBar(
        goal.currentValue, goal.targetValue, daysElapsed, daysTotal
      );
      const current = metricDisplay(goal.metric, goal.currentValue);
      const target  = metricDisplay(goal.metric, goal.targetValue);
      body += `
        <p style="margin:6px 0 2px;font-size:13px;color:#C8C8C8;">
          <strong>${metricLabel(goal.metric)}</strong>:
          ${current}/${target} (<span style="color:${paceColor};">${pct}</span>)
          &nbsp;<span style="font-family:monospace;color:#555;">${bar}</span>
          &nbsp;<span style="color:${paceColor};font-size:12px;">${pace}</span>
          &nbsp;<span style="color:#555;font-size:12px;">— ${daysLeft} days left</span>
        </p>`;
    }
  }

  return buildEmailTemplate({
    primaryContent: body,
    noPromotion:    true,
  });
}

// ─── Alert checking ───────────────────────────────────────────────────────────

export async function checkAlerts(recipients: string[]): Promise<void> {
  const alerts = await db.revenueReportAlert.findMany({ where: { active: true } });
  if (alerts.length === 0) return;

  const now      = new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd   = new Date(now); dayEnd.setUTCHours(23, 59, 59, 999);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const alert of alerts) {
    // Skip if triggered in last 24h
    if (alert.lastTriggeredAt && alert.lastTriggeredAt > twentyFourHoursAgo) continue;

    let currentValue = 0;

    if (alert.metric === "DAILY_REVENUE") {
      const [ppuJobs, merch, beats, digital] = await Promise.all([
        db.aIJob.findMany({ where: { createdAt: { gte: dayStart, lte: dayEnd }, priceCharged: { gt: 0 } }, select: { priceCharged: true } }),
        db.merchOrder.findMany({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, select: { platformCut: true } }),
        db.beatLicense.findMany({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, select: { price: true } }),
        db.digitalPurchase.findMany({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, select: { platformFee: true } }),
      ]);
      currentValue = Math.round(ppuJobs.reduce((s, j) => s + (j.priceCharged ?? 0), 0) * 100)
        + Math.round(merch.reduce((s, o) => s + (o.platformCut ?? 0), 0) * 100)
        + Math.round(beats.reduce((s, b) => s + (b.price ?? 0) * 0.15, 0) * 100)
        + digital.reduce((s, d) => s + (d.platformFee ?? 0), 0);
    } else if (alert.metric === "DAILY_SIGNUPS") {
      currentValue = await db.user.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } });
    } else if (alert.metric === "DAILY_CHURN") {
      currentValue = await db.subscription.count({ where: { canceledAt: { gte: dayStart, lte: dayEnd } } });
    }

    const triggered =
      (alert.condition === "BELOW" && currentValue < alert.threshold) ||
      (alert.condition === "ABOVE" && currentValue > alert.threshold);

    if (!triggered) continue;

    const metricDisplayName = alert.metric === "DAILY_REVENUE" ? "Daily Revenue"
      : alert.metric === "DAILY_SIGNUPS" ? "Daily Signups"
      : "Daily Churn";
    const conditionWord = alert.condition === "BELOW" ? "dropped below" : "exceeded";
    const thresholdDisplay = alert.metric === "DAILY_REVENUE" ? fmt(alert.threshold) : fmtNum(alert.threshold);
    const currentDisplay   = alert.metric === "DAILY_REVENUE" ? fmt(currentValue) : fmtNum(currentValue);

    const subject = `⚠️ IndieThis Alert: ${metricDisplayName} ${conditionWord} ${thresholdDisplay}`;
    const html    = buildEmailTemplate({
      primaryContent: `
        <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#E85D4A;">⚠️ Alert Triggered</p>
        <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;">
          <strong>${metricDisplayName}</strong> has ${conditionWord} <strong>${thresholdDisplay}</strong>.
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;">Current value: <strong style="color:#fff;">${currentDisplay}</strong></p>
        <p style="margin:0;font-size:13px;color:#888;">Check your admin dashboard for details.</p>
      `,
      noPromotion: true,
    });

    await Promise.all([
      ...recipients.map(email =>
        sendEmail({ to: { email, name: "Blue" }, subject, htmlContent: html, tags: ["alert"] })
      ),
      db.revenueReportAlert.update({
        where: { id: alert.id },
        data:  { lastTriggeredAt: now },
      }),
      logAgentAction(AT(AGENT), "ALERT_TRIGGERED", "ALERT", alert.id, {
        metric: alert.metric, condition: alert.condition, threshold: alert.threshold, currentValue,
      }),
    ]);
  }
}

// ─── Main agent entry point ───────────────────────────────────────────────────

export async function runRevenueReportAgent(): Promise<{ sent: boolean; recipients: number }> {
  const config = await db.revenueReportConfig.findFirst();
  if (!config) return { sent: false, recipients: 0 };

  const recipients       = JSON.parse(config.recipients as string) as string[];
  const enabledSections  = JSON.parse(config.enabledSections as string) as string[];

  // Always check alerts
  await checkAlerts(recipients);

  const report    = await compileReport(config.frequency, { dayOfWeek: config.dayOfWeek, dayOfMonth: config.dayOfMonth });
  const html      = buildReportEmail(report, enabledSections);
  const subject   = `IndieThis Revenue Report — ${report.period}`;
  const periodKey = report.period;

  await Promise.all(
    recipients.map(email =>
      sendEmail({ to: { email, name: "Blue" }, subject, htmlContent: html, tags: ["revenue-report"] })
    )
  );

  await db.revenueReportLog.create({
    data: {
      period:    periodKey,
      frequency: config.frequency,
      data:      report as unknown as import("@prisma/client").Prisma.InputJsonValue,
      sentTo:    recipients as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  await logAgentAction(AT(AGENT), "REPORT_SENT", "CONFIG", config.id, {
    frequency: config.frequency,
    period:    periodKey,
    recipients: recipients.length,
  });

  return { sent: true, recipients: recipients.length };
}
