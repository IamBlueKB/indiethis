/**
 * Lightweight helper for creating AIInsightsLog entries.
 * Fire-and-forget versions available for non-blocking use.
 */

import { db } from "@/lib/db";
import type { InsightType } from "@prisma/client";

export async function logInsight(params: {
  insightType: InsightType;
  input: string;
  output: string;
  referenceId?: string;
}): Promise<string> {
  const entry = await db.aIInsightsLog.create({
    data: {
      insightType: params.insightType,
      referenceId: params.referenceId ?? null,
      input: params.input,
      output: params.output,
    },
  });
  return entry.id;
}

export async function updateInsightLog(
  id: string,
  patch: { actionTaken?: string; accuracy?: boolean }
): Promise<void> {
  await db.aIInsightsLog.update({ where: { id }, data: patch });
}

/** Update actionTaken on the most recent MODERATION_SCAN log for a studio */
export async function logModerationAction(
  studioId: string,
  actionTaken: string
): Promise<void> {
  const log = await db.aIInsightsLog.findFirst({
    where: { insightType: "MODERATION_SCAN", referenceId: studioId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (log) {
    await db.aIInsightsLog.update({ where: { id: log.id }, data: { actionTaken } });
  }
}

/** Get moderation false positive rate for prompt injection */
export async function getModerationAccuracyContext(): Promise<string> {
  const decided = await db.aIInsightsLog.findMany({
    where: { insightType: "MODERATION_SCAN", actionTaken: { not: null } },
    select: { actionTaken: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  if (decided.length === 0) return "";

  const approved = decided.filter((d) => d.actionTaken === "approved").length;
  const total = decided.length;
  const falsePositiveRate = Math.round((approved / total) * 100);

  return `\n\nCALIBRATION NOTE (based on ${total} past admin decisions): Your false positive rate is ${falsePositiveRate}% — ${approved} of ${total} flagged studios were approved as clean by the admin. ${
    falsePositiveRate > 40
      ? "You are flagging too aggressively. Raise your threshold — only flag clear violations."
      : falsePositiveRate < 10
      ? "Your flagging rate seems well-calibrated. Continue current sensitivity."
      : "Your sensitivity is moderate. Continue current approach."
  }`;
}

/** Get churn prediction accuracy context for prompt injection */
export async function getChurnAccuracyContext(): Promise<string> {
  const rated = await db.aIInsightsLog.findMany({
    where: { insightType: "CHURN_PREDICTION", accuracy: { not: null } },
    select: { accuracy: true, input: true },
    take: 30,
    orderBy: { createdAt: "desc" },
  });

  if (rated.length === 0) return "";

  const accurate = rated.filter((r) => r.accuracy === true).length;
  const total = rated.length;
  const rate = Math.round((accurate / total) * 100);

  return `\n\nCALIBRATION NOTE (based on ${total} admin-rated predictions): Your churn predictions have been ${rate}% accurate. ${
    rate < 50
      ? "Your predictions have been less reliable. Be more conservative — only flag users with multiple strong signals."
      : rate > 80
      ? "Your predictions have been highly accurate. Maintain current criteria."
      : "Your accuracy is moderate. Focus on users with inactivity AND low usage combined."
  }`;
}
