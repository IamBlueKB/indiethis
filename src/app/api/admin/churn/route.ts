import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { cacheGet, cacheSet, TTL_7D } from "@/lib/admin-cache";
import { NextResponse } from "next/server";

export type ChurnRisk = {
  id: string;
  name: string;
  email: string;
  tier: string;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  riskLevel: "High" | "Medium" | "Low";
  reasoning: string;
};

const CACHE_KEY = "admin:churn";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check cache
  const cached = cacheGet<{ risks: ChurnRisk[]; generatedAt: string }>(CACHE_KEY, TTL_7D);
  if (cached) return NextResponse.json(cached);

  // Fetch active subscribers with activity data
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
    orderBy: { createdAt: "asc" }, // oldest subs first (more history)
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ risks: [], generatedAt: new Date().toISOString() });
  }

  const now = new Date();
  const userSummaries = subscribers.map((sub) => {
    const daysSinceLogin = sub.user.lastLoginAt
      ? Math.floor((now.getTime() - new Date(sub.user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const subAgeDays = Math.floor(
      (now.getTime() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
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

  const prompt = `You are a churn prediction assistant for IndieThis, a music studio management SaaS.

Analyze the following active subscribers and identify users at risk of canceling their subscription. Consider: inactivity (days since login), low usage (sessions/AI uses), subscription age vs engagement.

Users:
${userSummaries.map((u, i) => `${i + 1}. ${u.name} (${u.email}) — Tier: ${u.tier}, Sub age: ${u.subAgeDays} days, Last login: ${u.daysSinceLogin} days ago, Sessions: ${u.sessionCount}, AI uses: ${u.aiUses}`).join("\n")}

Return a JSON array of at-risk users only (skip users with healthy engagement). Include only users with genuine churn risk.
Format:
[
  {
    "id": "user_id",
    "riskLevel": "High" | "Medium" | "Low",
    "reasoning": "One sentence explaining why this user is at risk"
  }
]

Return only the JSON array, no markdown.`;

  try {
    const message = await claude.messages.create({
      model: SONNET,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const aiRisks = JSON.parse(text) as Array<{ id: string; riskLevel: "High" | "Medium" | "Low"; reasoning: string }>;

    // Merge AI results with full user data
    const riskMap = new Map(aiRisks.map((r) => [r.id, r]));
    const risks: ChurnRisk[] = [];

    for (const sub of subscribers) {
      const aiResult = riskMap.get(sub.user.id);
      if (!aiResult) continue;
      risks.push({
        id: sub.user.id,
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

    // Sort: High → Medium → Low
    const ORDER = { High: 0, Medium: 1, Low: 2 };
    risks.sort((a, b) => ORDER[a.riskLevel] - ORDER[b.riskLevel]);

    const result = { risks, generatedAt: new Date().toISOString() };
    cacheSet(CACHE_KEY, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[churn] Claude error", err);
    return NextResponse.json({ risks: [], generatedAt: new Date().toISOString() });
  }
}
