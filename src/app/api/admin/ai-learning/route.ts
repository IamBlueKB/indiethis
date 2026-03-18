import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/admin/ai-learning — aggregated AI feedback data
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    // Top edited fields across all GenerationFeedback
    topEdits,
    // Moderation accuracy: logs with actionTaken set
    moderationDecided,
    // Churn accuracy: logs with accuracy set
    churnRated,
    churnTotal,
    // Recent support queries
    recentSupportQueries,
    // Totals
    totalFeedback,
    totalModerationScans,
    totalChurnPredictions,
    totalSupportQueries,
  ] = await Promise.all([
    db.generationFeedback.groupBy({
      by: ["fieldChanged", "sectionType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    db.aIInsightsLog.findMany({
      where: { insightType: "MODERATION_SCAN", actionTaken: { not: null } },
      select: { actionTaken: true, createdAt: true, referenceId: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),

    db.aIInsightsLog.count({
      where: { insightType: "CHURN_PREDICTION", accuracy: true },
    }),

    db.aIInsightsLog.count({
      where: { insightType: "CHURN_PREDICTION", accuracy: { not: null } },
    }),

    db.aIInsightsLog.findMany({
      where: { insightType: "SUPPORT_QUERY" },
      select: { id: true, input: true, output: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),

    db.generationFeedback.count(),
    db.aIInsightsLog.count({ where: { insightType: "MODERATION_SCAN" } }),
    db.aIInsightsLog.count({ where: { insightType: "CHURN_PREDICTION" } }),
    db.aIInsightsLog.count({ where: { insightType: "SUPPORT_QUERY" } }),
  ]);

  // Compute moderation accuracy
  const modApproved = moderationDecided.filter((l) => l.actionTaken === "approved").length;
  const modUnpublished = moderationDecided.filter((l) => l.actionTaken === "unpublished").length;
  const modDecidedTotal = moderationDecided.length;
  const falsePositiveRate = modDecidedTotal > 0
    ? Math.round((modApproved / modDecidedTotal) * 100)
    : null;

  // Churn accuracy
  const churnAccuracyRate = churnTotal > 0
    ? Math.round((churnRated / churnTotal) * 100)
    : null;

  // Format top edits
  const topEditsFormatted = topEdits.map((e) => ({
    fieldChanged: e.fieldChanged,
    sectionType: e.sectionType,
    count: e._count.id,
  }));

  // Format support queries (parse input to extract question text)
  const supportQuestions = recentSupportQueries.map((q) => {
    let question = q.input;
    try {
      const parsed = JSON.parse(q.input);
      question = parsed.question ?? parsed.messages?.[0]?.content ?? q.input;
    } catch { /* keep raw */ }
    return {
      id: q.id,
      question: question.slice(0, 200),
      answer: q.output.slice(0, 300),
      createdAt: q.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    topEdits: topEditsFormatted,
    moderation: {
      totalScans: totalModerationScans,
      decided: modDecidedTotal,
      approved: modApproved,
      unpublished: modUnpublished,
      falsePositiveRate,
    },
    churn: {
      totalPredictions: totalChurnPredictions,
      rated: churnTotal,
      accurate: churnRated,
      accuracyRate: churnAccuracyRate,
    },
    support: {
      totalQueries: totalSupportQueries,
      recentQuestions: supportQuestions,
    },
    generationFeedback: {
      total: totalFeedback,
    },
  });
}
