import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { cacheGet, cacheSet, TTL_7D } from "@/lib/admin-cache";
import Link from "next/link";

type ChurnRisk = {
  id: string;
  name: string;
  email: string;
  tier: string;
  lastLoginAt: string | null;
  sessionCount: number;
  riskLevel: "High" | "Medium" | "Low";
  reasoning: string;
};

const CACHE_KEY = "admin:churn:table";
const RISK_COLOR = { High: "#E85D4A", Medium: "#FF9F0A", Low: "#D4A843" };

function daysSince(d: string | null): string {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

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

  const prompt = `You are a churn prediction assistant for IndieThis, a music studio management SaaS.

Analyze these active subscribers and identify users at risk of canceling. Consider inactivity, low usage, and subscription age vs. engagement. Only flag users with genuine risk.

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
      risks.push({
        id: sub.user.id,
        name: sub.user.name,
        email: sub.user.email,
        tier: sub.tier,
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

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-semibold text-foreground">At-Risk Users</p>
          <p className="text-[11px] text-muted-foreground">AI churn prediction · refreshes weekly</p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
        >
          {risks.filter((r) => r.riskLevel === "High").length} high risk
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["User", "Plan", "Last Active", "Sessions", "Risk", "Reason"].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) => (
              <tr key={risk.id} className="border-b last:border-b-0 hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${risk.id}`} className="no-underline hover:underline">
                    <p className="font-medium text-foreground">{risk.name}</p>
                    <p className="text-xs text-muted-foreground">{risk.email}</p>
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                  >
                    {risk.tier}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted-foreground text-xs">
                  {daysSince(risk.lastLoginAt)}
                </td>
                <td className="px-5 py-3 text-center text-muted-foreground text-sm">
                  {risk.sessionCount}
                </td>
                <td className="px-5 py-3">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${RISK_COLOR[risk.riskLevel]}18`,
                      color: RISK_COLOR[risk.riskLevel],
                    }}
                  >
                    {risk.riskLevel}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs">
                  {risk.reasoning}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
