import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { cacheGet, cacheSet, TTL_7D } from "@/lib/admin-cache";
import { logInsight, getChurnAccuracyContext } from "@/lib/ai-log";
import type { ChurnRisk } from "@/app/api/admin/churn/route";
import ChurnTableClient from "./ChurnTableClient";

const CACHE_KEY = "admin:churn:table";

async function getChurnPredictions(): Promise<ChurnRisk[]> {
  const session = await getAdminSession();
  if (!session) return [];

  const cached = cacheGet<ChurnRisk[]>(CACHE_KEY, TTL_7D);
  if (cached) return cached;

  const subscribers = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      tier: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { sessions: true, aiGenerations: true } },
        },
      },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  if (subscribers.length === 0) return [];

  const now = new Date();
  const userSummaries = subscribers.map((sub) => {
    const daysSinceLogin = sub.user.lastLoginAt
      ? Math.floor((now.getTime() - new Date(sub.user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const subAgeDays = Math.floor((now.getTime() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: sub.user.id,
      name: sub.user.name,
      email: sub.user.email,
      tier: sub.tier,
      subAgeDays,
      daysSinceLogin: daysSinceLogin ?? "never logged in",
      sessionCount: sub.user._count.sessions,
      aiUses: sub.user._count.aiGenerations,
    };
  });

  const accuracyContext = await getChurnAccuracyContext();

  const prompt = `You are a churn prediction assistant for IndieThis, a music studio management SaaS.

Analyze these active subscribers and identify users at risk of canceling. Consider inactivity, low usage, and subscription age vs. engagement. Only flag users with genuine risk.${accuracyContext}

Users:
${userSummaries.map((u, i) => `${i + 1}. ${u.name} (${u.email}) — Tier: ${u.tier}, Sub age: ${u.subAgeDays}d, Last login: ${u.daysSinceLogin} days ago, Sessions: ${u.sessionCount}, AI uses: ${u.aiUses}`).join("\n")}

Return JSON array of at-risk users only:
[{"id":"user_id","riskLevel":"High"|"Medium"|"Low","reasoning":"One sentence"}]
Return only JSON, no markdown.`;

  try {
    const message = await claude.messages.create({
      model: SONNET,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const aiRisks = JSON.parse(text) as Array<{ id: string; riskLevel: "High" | "Medium" | "Low"; reasoning: string }>;
    const riskMap = new Map(aiRisks.map((r) => [r.id, r]));

    const risks: ChurnRisk[] = [];
    for (const sub of subscribers) {
      const aiResult = riskMap.get(sub.user.id);
      if (!aiResult) continue;

      const userInput = userSummaries.find((u) => u.id === sub.user.id);
      const userInputStr = userInput
        ? `${userInput.name} — Tier: ${userInput.tier}, Sub age: ${userInput.subAgeDays}d, Last login: ${userInput.daysSinceLogin}d ago, Sessions: ${userInput.sessionCount}`
        : sub.user.id;

      // Per-user log entry for accuracy tracking
      const logId = await logInsight({
        insightType: "CHURN_PREDICTION",
        referenceId: sub.user.id,
        input: userInputStr,
        output: JSON.stringify({ riskLevel: aiResult.riskLevel, reasoning: aiResult.reasoning }),
      });

      risks.push({
        id: sub.user.id,
        logId,
        name: sub.user.name,
        email: sub.user.email,
        tier: sub.tier,
        createdAt: sub.createdAt.toISOString(),
        lastLoginAt: sub.user.lastLoginAt?.toISOString() ?? null,
        sessionCount: sub.user._count.sessions,
        riskLevel: aiResult.riskLevel,
        reasoning: aiResult.reasoning,
      });
    }

    const ORDER = { High: 0, Medium: 1, Low: 2 };
    risks.sort((a, b) => ORDER[a.riskLevel] - ORDER[b.riskLevel]);
    cacheSet(CACHE_KEY, risks);
    return risks;
  } catch {
    return [];
  }
}

export default async function ChurnPredictionTable() {
  const risks = await getChurnPredictions();
  if (risks.length === 0) return null;
  return <ChurnTableClient risks={risks} />;
}
