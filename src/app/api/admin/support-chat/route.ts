import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { logInsight } from "@/lib/ai-log";
import { NextRequest, NextResponse } from "next/server";

const TIER_PRICE: Record<string, number> = { LAUNCH: 0, PUSH: 49, REIGN: 99 };

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages } = (await req.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Gather live platform stats to provide as context
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalArtists,
    totalStudios,
    activeSubscriptions,
    newUsersThisMonth,
    newUsersThisWeek,
    aiUsageThisMonth,
    flaggedStudios,
    inactiveUsers,
    canceledThisMonth,
  ] = await Promise.all([
    db.user.count({ where: { role: "ARTIST" } }),
    db.studio.count(),
    db.subscription.findMany({ where: { status: "ACTIVE" }, select: { tier: true } }),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.user.count({ where: { createdAt: { gte: lastWeek } } }),
    db.aIGeneration.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    db.studio.count({ where: { moderationStatus: { in: ["FLAGGED", "REVIEWING"] } } }),
    db.user.count({
      where: {
        subscription: { status: "ACTIVE" },
        OR: [
          { lastLoginAt: { lt: lastMonth } },
          { lastLoginAt: null },
        ],
      },
    }),
    db.subscription.count({ where: { status: "CANCELLED", updatedAt: { gte: startOfMonth } } }),
  ]);

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (TIER_PRICE[s.tier] ?? 0), 0);

  const platformContext = `You are an AI assistant embedded in the IndieThis admin panel. IndieThis is a SaaS platform for recording studio management and independent music artists.

Current platform stats (as of ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}):
- Total artists: ${totalArtists}
- Total studios: ${totalStudios}
- Active subscriptions: ${activeSubscriptions.length} (MRR: $${mrr.toLocaleString()})
  * Breakdown: ${activeSubscriptions.filter(s => s.tier === "LAUNCH").length} LAUNCH, ${activeSubscriptions.filter(s => s.tier === "PUSH").length} PUSH, ${activeSubscriptions.filter(s => s.tier === "REIGN").length} REIGN
- New signups this month: ${newUsersThisMonth}
- New signups this week: ${newUsersThisWeek}
- Cancellations this month: ${canceledThisMonth}
- AI tool usage this month: ${aiUsageThisMonth.map(a => `${a.type}: ${a._count.id}`).join(", ") || "none"}
- Studios flagged for content moderation: ${flaggedStudios}
- Inactive subscribers (no login in 30+ days): ${inactiveUsers}

Answer admin questions about the platform concisely and accurately using these stats. If you don't have the specific data to answer a question precisely, say so and provide the closest available information.`;

  try {
    const response = await claude.messages.create({
      model: SONNET,
      max_tokens: 600,
      system: platformContext,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const reply =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "Sorry, I couldn't generate a response.";

    // Log the question + answer
    const lastUserMsg = messages[messages.length - 1];
    void logInsight({
      insightType: "SUPPORT_QUERY",
      input: JSON.stringify({ question: lastUserMsg?.content ?? "" }),
      output: reply,
    }).catch(() => {});

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[support-chat] Claude error", err);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
