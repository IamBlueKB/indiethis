import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";

/**
 * GET /api/admin/attribution?range=30d
 *
 * Returns channel analytics derived from UserAttribution.
 * range: 7d | 30d | 90d | 12m (default: 30d)
 *
 * Response:
 *   totalAttributed     - signups with any attribution data
 *   bySource            - [{ source, count }] sorted desc
 *   fileDeliveryCount   - signups where source = "file_delivery"
 *   referralLinkCount   - signups where ref is set (platform referral)
 *   affiliateLinkCount  - signups where affiliateId is set
 *   directCount         - signups where source = "direct" or source is null
 *   byAffiliate         - [{ affiliateId, affiliateName, signups, commissionPaid }]
 *   topReferrers        - [{ userId, name, email, activeReferrals, totalReferrals }]
 *   topAffiliates       - [{ id, name, email, totalReferrals, activeReferrals, totalEarned }]
 *   utmSources          - [{ utmSource, count }]
 *   utmCampaigns        - [{ utmCampaign, count }]
 */
export async function GET(req: NextRequest) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "30d";

  const now = new Date();
  let since: Date;
  switch (range) {
    case "7d":  since = new Date(now.getTime() - 7  * 86_400_000); break;
    case "90d": since = new Date(now.getTime() - 90 * 86_400_000); break;
    case "12m": since = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
    default:    since = new Date(now.getTime() - 30 * 86_400_000); break;
  }

  // ── Fetch all attribution records in range ──────────────────────────────────
  const records = await db.userAttribution.findMany({
    where: { createdAt: { gte: since } },
    select: {
      source:      true,
      affiliateId: true,
      ref:         true,
      utmSource:   true,
      utmMedium:   true,
      utmCampaign: true,
      landingPage: true,
    },
  });

  // ── Signups by source ───────────────────────────────────────────────────────
  const sourceMap: Record<string, number> = {};
  let fileDeliveryCount = 0;
  let referralLinkCount = 0;
  let affiliateLinkCount = 0;
  let directCount = 0;

  for (const r of records) {
    const src = r.source ?? "direct";
    sourceMap[src] = (sourceMap[src] ?? 0) + 1;

    if (r.source === "file_delivery") fileDeliveryCount++;
    if (r.ref && !r.affiliateId)      referralLinkCount++;
    if (r.affiliateId)                affiliateLinkCount++;
    if (!r.source || r.source === "direct") directCount++;
  }

  const bySource = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // ── UTM breakdown ───────────────────────────────────────────────────────────
  const utmSourceMap: Record<string, number> = {};
  const utmCampaignMap: Record<string, number> = {};

  for (const r of records) {
    if (r.utmSource) {
      utmSourceMap[r.utmSource] = (utmSourceMap[r.utmSource] ?? 0) + 1;
    }
    if (r.utmCampaign) {
      utmCampaignMap[r.utmCampaign] = (utmCampaignMap[r.utmCampaign] ?? 0) + 1;
    }
  }

  const utmSources = Object.entries(utmSourceMap)
    .map(([utmSource, count]) => ({ utmSource, count }))
    .sort((a, b) => b.count - a.count);

  const utmCampaigns = Object.entries(utmCampaignMap)
    .map(([utmCampaign, count]) => ({ utmCampaign, count }))
    .sort((a, b) => b.count - a.count);

  // ── Signups grouped by affiliateId ─────────────────────────────────────────
  const affiliateSignupMap: Record<string, number> = {};
  for (const r of records) {
    if (r.affiliateId) {
      affiliateSignupMap[r.affiliateId] = (affiliateSignupMap[r.affiliateId] ?? 0) + 1;
    }
  }

  // Hydrate affiliate names
  const affiliateIds = Object.keys(affiliateSignupMap);
  const affiliateRows = affiliateIds.length
    ? await db.affiliate.findMany({
        where: { id: { in: affiliateIds } },
        select: { id: true, applicantName: true, applicantEmail: true, totalEarned: true },
      })
    : [];

  const byAffiliate = affiliateRows
    .map((a) => ({
      affiliateId:   a.id,
      affiliateName: a.applicantName,
      affiliateEmail: a.applicantEmail,
      signups:       affiliateSignupMap[a.id] ?? 0,
      totalEarned:   a.totalEarned,
    }))
    .sort((a, b) => b.signups - a.signups);

  // ── Top referrers (platform ref program) ───────────────────────────────────
  const topReferrers = await db.user.findMany({
    where: {
      referralsGiven: {
        some: {},
      },
    },
    select: {
      id:    true,
      name:  true,
      email: true,
      referralsGiven: {
        select: { isActive: true },
      },
    },
    orderBy: {
      referralsGiven: { _count: "desc" },
    },
    take: 10,
  });

  const topReferrerData = topReferrers.map((u) => ({
    userId:         u.id,
    name:           u.name,
    email:          u.email,
    activeReferrals: u.referralsGiven.filter((r) => r.isActive).length,
    totalReferrals:  u.referralsGiven.length,
  }));

  // ── Top affiliates ──────────────────────────────────────────────────────────
  const topAffiliates = await db.affiliate.findMany({
    where: { status: "APPROVED" },
    select: {
      id:            true,
      applicantName: true,
      applicantEmail: true,
      totalEarned:   true,
      pendingPayout: true,
      referrals: {
        select: { isActive: true },
      },
    },
    orderBy: { totalEarned: "desc" },
    take: 10,
  });

  const topAffiliateData = topAffiliates.map((a) => ({
    id:              a.id,
    name:            a.applicantName,
    email:           a.applicantEmail,
    totalReferrals:  a.referrals.length,
    activeReferrals: a.referrals.filter((r) => r.isActive).length,
    totalEarned:     a.totalEarned,
    pendingPayout:   a.pendingPayout,
  }));

  // ── Signups by day (for chart) ──────────────────────────────────────────────
  const allAttributedInRange = await db.userAttribution.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, source: true, affiliateId: true, ref: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucket into daily counts by source
  const dailyMap: Record<string, { date: string; direct: number; referral: number; affiliate: number; file_delivery: number; other: number }> = {};

  for (const r of allAttributedInRange) {
    const key = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!dailyMap[key]) {
      dailyMap[key] = { date: key, direct: 0, referral: 0, affiliate: 0, file_delivery: 0, other: 0 };
    }
    if (r.source === "file_delivery") {
      dailyMap[key].file_delivery++;
    } else if (r.affiliateId) {
      dailyMap[key].affiliate++;
    } else if (r.ref) {
      dailyMap[key].referral++;
    } else if (!r.source || r.source === "direct") {
      dailyMap[key].direct++;
    } else {
      dailyMap[key].other++;
    }
  }

  const signupsByDay = Object.values(dailyMap);

  return NextResponse.json({
    totalAttributed: records.length,
    bySource,
    fileDeliveryCount,
    referralLinkCount,
    affiliateLinkCount,
    directCount,
    byAffiliate,
    topReferrers:   topReferrerData,
    topAffiliates:  topAffiliateData,
    utmSources,
    utmCampaigns,
    signupsByDay,
  });
}
