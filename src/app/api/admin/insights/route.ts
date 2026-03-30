import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { cacheGet, cacheSet, TTL_24H } from "@/lib/admin-cache";
import { logInsight } from "@/lib/ai-log";
import { NextResponse } from "next/server";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 49, REIGN: 99 };
const CACHE_KEY = "admin:insights";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check cache first
  const cached = cacheGet<{ summary: string; generatedAt: string }>(CACHE_KEY, TTL_24H);
  if (cached) return NextResponse.json(cached);

  // Gather metrics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    activeSubscriptions,
    newUsersThisMonth,
    newUsersLastMonth,
    churnedCount,
    aiUsageThisMonth,
    dormantStudios,
  ] = await Promise.all([
    db.subscription.findMany({ where: { status: "ACTIVE" }, select: { tier: true } }),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.user.count({ where: { createdAt: { gte: lastMonthStart, lt: startOfMonth } } }),
    db.subscription.count({
      where: { status: "CANCELLED", updatedAt: { gte: startOfMonth } },
    }),
    db.aIGeneration.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    db.studio.count({
      where: {
        isPublished: true,
        owner: { lastLoginAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      },
    }),
  ]);

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);
  const activeSubCount = activeSubscriptions.length;
  const topAITool = aiUsageThisMonth[0]
    ? `${aiUsageThisMonth[0].type.replace(/_/g, " ").toLowerCase()} (${aiUsageThisMonth[0]._count.id} uses)`
    : "none";

  const prompt = `You are a concise business analyst for IndieThis, a music studio management platform.

Write a 3-4 sentence plain-language summary of this month's key metrics. Be direct and specific with numbers. Highlight any notable trends (positive or negative). End with one actionable suggestion if relevant.

Current month metrics:
- MRR: $${mrr.toLocaleString()} across ${activeSubCount} active subscriptions
- New signups this month: ${newUsersThisMonth} (vs ${newUsersLastMonth} last month)
- Churn this month: ${churnedCount} cancellations
- Top AI tool: ${topAITool}
- Total AI uses this month: ${aiUsageThisMonth.reduce((s, a) => s + a._count.id, 0)}
- Dormant published studios (owner inactive 14+ days): ${dormantStudios}

Write only the summary paragraph, no headers or labels.`;

  try {
    const message = await claude.messages.create({
      model: SONNET,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const summary =
      message.content[0].type === "text"
        ? message.content[0].text.trim()
        : "Unable to generate insights.";

    // Log to AIInsightsLog
    void logInsight({
      insightType: "REVENUE_SUMMARY",
      input: prompt,
      output: summary,
    }).catch(() => {});

    const result = { summary, generatedAt: new Date().toISOString() };
    cacheSet(CACHE_KEY, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[insights] Claude error", err);
    return NextResponse.json({
      summary: `MRR is $${mrr.toLocaleString()} with ${activeSubCount} active subscriptions. ${newUsersThisMonth} new signups this month. ${churnedCount} cancellations. ${dormantStudios} dormant studios.`,
      generatedAt: new Date().toISOString(),
    });
  }
}
