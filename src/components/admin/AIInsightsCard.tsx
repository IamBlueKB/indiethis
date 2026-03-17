import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { cacheGet, cacheSet, TTL_24H } from "@/lib/admin-cache";
import { Sparkles, Clock } from "lucide-react";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 29, REIGN: 79 };
const CACHE_KEY = "admin:insights:card";

async function getInsights() {
  const session = await getAdminSession();
  if (!session) return null;

  const cached = cacheGet<{ summary: string; generatedAt: string }>(CACHE_KEY, TTL_24H);
  if (cached) return cached;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [activeSubscriptions, newUsersThisMonth, newUsersLastMonth, churnedCount, aiUsageThisMonth, dormantStudios] =
    await Promise.all([
      db.subscription.findMany({ where: { status: "ACTIVE" }, select: { tier: true } }),
      db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      db.user.count({ where: { createdAt: { gte: lastMonthStart, lt: startOfMonth } } }),
      db.subscription.count({ where: { status: "CANCELLED", updatedAt: { gte: startOfMonth } } }),
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

Write a 3-4 sentence plain-language summary of this month's key metrics. Be direct and specific with numbers. Highlight any notable trends. End with one actionable suggestion if relevant.

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
        : `MRR is $${mrr.toLocaleString()} with ${activeSubCount} active subscriptions.`;

    const result = { summary, generatedAt: new Date().toISOString() };
    cacheSet(CACHE_KEY, result);
    return result;
  } catch {
    return {
      summary: `MRR is $${mrr.toLocaleString()} with ${activeSubCount} active subscriptions. ${newUsersThisMonth} new signups this month with ${churnedCount} cancellations. ${dormantStudios} dormant studios may need outreach.`,
      generatedAt: new Date().toISOString(),
    };
  }
}

function fmtTime(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function AIInsightsCard() {
  const data = await getInsights();
  if (!data) return null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        background: "linear-gradient(135deg, rgba(232,93,74,0.06) 0%, rgba(212,168,67,0.06) 100%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
        >
          <Sparkles size={15} className="text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AI Insights
            </p>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
            >
              This Month
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-3">
            <Clock size={10} />
            Generated {fmtTime(data.generatedAt)} · cached 24h
          </p>
        </div>
      </div>
    </div>
  );
}
