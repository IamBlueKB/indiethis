import { NextRequest, NextResponse } from "next/server";
import { getLastRun, logAgentAction } from "@/lib/agents";

/**
 * POST /api/cron/agents
 * Master cron route — protected by CRON_SECRET.
 * Runs all platform agents on their individual schedules.
 * Each agent has a shouldRun() check based on when it last ran.
 *
 * Recommended Vercel cron schedule: every hour ("0 * * * *")
 * Agents decide internally whether to actually execute based on their own cadence.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now     = Date.now();
  const results: Record<string, string> = {};
  const day     = new Date().getDay(); // 0=Sun, 1=Mon, ..., 3=Wed

  // ── Churn Prevention — runs daily ────────────────────────────────────────
  const shouldRunChurn = await shouldRun("CHURN_PREVENTION", 22); // 22h guard
  if (shouldRunChurn) {
    try {
      const { runChurnPreventionAgent } = await import("@/lib/agents/churn-prevention");
      await logAgentAction("CHURN_PREVENTION", "AGENT_RUN_START");
      const result = await runChurnPreventionAgent();
      results.churnPrevention = `acted on ${result.acted} users`;
    } catch (err) {
      results.churnPrevention = `error: ${String(err)}`;
    }
  } else {
    results.churnPrevention = "skipped (not due)";
  }

  // ── Revenue Optimization — runs weekly (Mon) ──────────────────────────────
  const isMonday = day === 1;
  const shouldRunRevenue = isMonday && await shouldRun("REVENUE_OPTIMIZATION", 6 * 24); // 6d guard
  if (shouldRunRevenue) {
    try {
      const { runRevenueOptimizationAgent } = await import("@/lib/agents/revenue-optimization");
      await logAgentAction("REVENUE_OPTIMIZATION", "AGENT_RUN_START");
      const result = await runRevenueOptimizationAgent();
      results.revenueOptimization = `acted on ${result.acted} users`;
    } catch (err) {
      results.revenueOptimization = `error: ${String(err)}`;
    }
  } else {
    results.revenueOptimization = isMonday ? "skipped (not due)" : "skipped (not Monday)";
  }

  // ── Release Strategy — runs daily ────────────────────────────────────────
  const shouldRunRelease = await shouldRun("RELEASE_STRATEGY", 22); // 22h guard
  if (shouldRunRelease) {
    try {
      const { runReleaseStrategyAgent } = await import("@/lib/agents/release-strategy");
      await logAgentAction("RELEASE_STRATEGY", "AGENT_RUN_START");
      const result = await runReleaseStrategyAgent();
      results.releaseStrategy = `acted on ${result.acted} plans`;
    } catch (err) {
      results.releaseStrategy = `error: ${String(err)}`;
    }
  } else {
    results.releaseStrategy = "skipped (not due)";
  }

  // ── Fan Engagement — runs weekly (Wed) ───────────────────────────────────
  const isWednesday = day === 3;
  const shouldRunFan = isWednesday && await shouldRun("FAN_ENGAGEMENT", 6 * 24); // 6d guard
  if (shouldRunFan) {
    try {
      const { runFanEngagementAgent } = await import("@/lib/agents/fan-engagement");
      await logAgentAction("FAN_ENGAGEMENT", "AGENT_RUN_START");
      const result = await runFanEngagementAgent();
      results.fanEngagement = `acted on ${result.acted} users`;
    } catch (err) {
      results.fanEngagement = `error: ${String(err)}`;
    }
  } else {
    results.fanEngagement = isWednesday ? "skipped (not due)" : "skipped (not Wednesday)";
  }

  // ── Session Follow-Up — runs daily ───────────────────────────────────────
  const shouldRunFollowUp = await shouldRun("SESSION_FOLLOWUP", 22); // 22h guard
  if (shouldRunFollowUp) {
    try {
      const { runSessionFollowUpAgent } = await import("@/lib/agents/session-followup");
      await logAgentAction("SESSION_FOLLOWUP", "AGENT_RUN_START");
      const result = await runSessionFollowUpAgent();
      results.sessionFollowUp = `acted on ${result.acted} sessions`;
    } catch (err) {
      results.sessionFollowUp = `error: ${String(err)}`;
    }
  } else {
    results.sessionFollowUp = "skipped (not due)";
  }

  // ── A&R Intelligence — runs weekly (Friday) ───────────────────────────────
  const isFriday    = day === 5;
  const shouldRunAR = isFriday && await shouldRun("AR_INTELLIGENCE", 6 * 24); // 6d guard
  if (shouldRunAR) {
    try {
      const { runArIntelligenceAgent } = await import("@/lib/agents/ar-intelligence");
      await logAgentAction("AR_INTELLIGENCE", "AGENT_RUN_START");
      const result = await runArIntelligenceAgent();
      results.arIntelligence = `acted on ${result.acted} artists`;
    } catch (err) {
      results.arIntelligence = `error: ${String(err)}`;
    }
  } else {
    results.arIntelligence = isFriday ? "skipped (not due)" : "skipped (not Friday)";
  }

  // ── Content Moderation — runs daily sweep ─────────────────────────────────
  const shouldRunModeration = await shouldRun("CONTENT_MODERATION", 22); // 22h guard
  if (shouldRunModeration) {
    try {
      const { runContentModerationAgent } = await import("@/lib/agents/content-moderation");
      await logAgentAction("CONTENT_MODERATION", "AGENT_RUN_START");
      const result = await runContentModerationAgent();
      results.contentModeration = `flagged ${result.acted} items`;
    } catch (err) {
      results.contentModeration = `error: ${String(err)}`;
    }
  } else {
    results.contentModeration = "skipped (not due)";
  }

  // ── Lead Scoring — daily rescore of stale PENDING inquiries ───────────────
  const shouldRunLeadScore = await shouldRun("LEAD_SCORING", 22); // 22h guard
  if (shouldRunLeadScore) {
    try {
      const { runLeadScoringAgent } = await import("@/lib/agents/lead-scoring");
      await logAgentAction("LEAD_SCORING", "AGENT_RUN_START");
      const result = await runLeadScoringAgent();
      results.leadScoring = `rescored ${result.acted} inquiries`;
    } catch (err) {
      results.leadScoring = `error: ${String(err)}`;
    }
  } else {
    results.leadScoring = "skipped (not due)";
  }

  // ── Creative Prompt — proactive: notify artists 48 h after upload if no cover art
  const shouldRunCreativePrompt = await shouldRun("CREATIVE_PROMPT", 22); // 22h guard
  if (shouldRunCreativePrompt) {
    try {
      const { runCreativePromptAgent } = await import("@/lib/agents/creative-prompt");
      const result = await runCreativePromptAgent();
      results.creativePrompt = `checked ${result.checked}, notified ${result.notified}`;
    } catch (err) {
      results.creativePrompt = `error: ${String(err)}`;
    }
  } else {
    results.creativePrompt = "skipped (not due)";
  }

  // ── Inactive Content — weekly: nudge artists with stale tracks/merch/products
  const isTuesday = day === 2;
  const shouldRunInactiveContent = isTuesday && await shouldRun("INACTIVE_CONTENT", 6 * 24); // 6d guard
  if (shouldRunInactiveContent) {
    try {
      const { runInactiveContentAgent } = await import("@/lib/agents/inactive-content");
      const result = await runInactiveContentAgent();
      results.inactiveContent = `checked ${result.checked}, acted on ${result.acted}`;
    } catch (err) {
      results.inactiveContent = `error: ${String(err)}`;
    }
  } else {
    results.inactiveContent = "skipped (not due or not Tuesday)";
  }

  // ── Release Bundle — weekly (Tuesday) — notify artists missing 2+ release assets ──
  const shouldRunReleaseBundle = isTuesday && await shouldRun("RELEASE_BUNDLE", 6 * 24); // 6d guard
  if (shouldRunReleaseBundle) {
    try {
      const { runReleaseBundleAgent } = await import("@/lib/agents/release-bundle");
      const result = await runReleaseBundleAgent();
      results.releaseBundle = `checked ${result.checked}, acted on ${result.acted}`;
    } catch (err) {
      results.releaseBundle = `error: ${String(err)}`;
    }
  } else {
    results.releaseBundle = "skipped (not due or not Tuesday)";
  }

  // ── Trend Forecaster — weekly teaser (Friday) ────────────────────────────────
  const shouldRunTrend = isFriday && await shouldRun("TREND_FORECASTER", 6 * 24); // 6d guard
  if (shouldRunTrend) {
    try {
      const { runTrendForecasterAgent } = await import("@/lib/agents/trend-forecaster");
      const result = await runTrendForecasterAgent();
      results.trendForecaster = `checked ${result.checked}, teasers=${result.teasersSent}`;
    } catch (err) {
      results.trendForecaster = `error: ${String(err)}`;
    }
  } else {
    results.trendForecaster = isFriday ? "skipped (not due)" : "skipped (not Friday)";
  }

  // ── Producer-Artist Match — weekly teaser (Thursday) ─────────────────────────
  const isThursday = day === 4;
  const shouldRunProducerMatch = isThursday && await shouldRun("PRODUCER_ARTIST_MATCH", 6 * 24); // 6d guard
  if (shouldRunProducerMatch) {
    try {
      const { runProducerArtistMatchAgent } = await import("@/lib/agents/producer-artist-match");
      const result = await runProducerArtistMatchAgent();
      results.producerArtistMatch = `checked ${result.checked}, teasers=${result.teasersSent}`;
    } catch (err) {
      results.producerArtistMatch = `error: ${String(err)}`;
    }
  } else {
    results.producerArtistMatch = isThursday ? "skipped (not due)" : "skipped (not Thursday)";
  }

  // ── Payment Recovery — daily sweep (Day 2/5/10 escalation emails) ──────────
  const shouldRunPaymentRecovery = await shouldRun("PAYMENT_RECOVERY", 22); // 22h guard
  if (shouldRunPaymentRecovery) {
    try {
      const { runPaymentRecoveryAgent } = await import("@/lib/agents/payment-recovery");
      const result = await runPaymentRecoveryAgent();
      results.paymentRecovery = `day2=${result.day2Sent} day5=${result.day5Sent} winBack=${result.winBackSent} reEngage=${result.reEngageSent}`;
    } catch (err) {
      results.paymentRecovery = `error: ${String(err)}`;
    }
  } else {
    results.paymentRecovery = "skipped (not due)";
  }

  // ── Quality Score Update — runs daily ────────────────────────────────────────
  const shouldRunQualityScores = await shouldRun("QUALITY_SCORE_UPDATE", 22); // 22h guard
  if (shouldRunQualityScores) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/quality-scores`,
        { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }
      );
      const data = await res.json() as { updated?: number };
      results.qualityScoreUpdate = `updated ${data.updated ?? 0} tracks`;
      await logAgentAction("QUALITY_SCORE_UPDATE", "AGENT_RUN_START");
    } catch (err) {
      results.qualityScoreUpdate = `error: ${String(err)}`;
    }
  } else {
    results.qualityScoreUpdate = "skipped (not due)";
  }

  // ── Revenue Report — configurable schedule (checks every hour) ───────────────
  try {
    const { db } = await import("@/lib/db");
    const { checkAlerts, runRevenueReportAgent } = await import("@/lib/agents/revenue-report");
    const rrConfig = await db.revenueReportConfig.findFirst();
    if (rrConfig) {
      const recipients = JSON.parse(rrConfig.recipients as string) as string[];
      // Always check alerts on every cron tick
      await checkAlerts(recipients);

      // Check if it's time to send the scheduled report
      const nowDate        = new Date();
      const currentHourUtc = `${String(nowDate.getUTCHours()).padStart(2, "0")}:00`;
      const shouldSendReport = (
        (rrConfig.frequency === "DAILY" && currentHourUtc === rrConfig.timeUtc) ||
        (rrConfig.frequency === "WEEKLY" && nowDate.getUTCDay() === rrConfig.dayOfWeek && currentHourUtc === rrConfig.timeUtc) ||
        (rrConfig.frequency === "MONTHLY" && nowDate.getUTCDate() === rrConfig.dayOfMonth && currentHourUtc === rrConfig.timeUtc)
      );
      if (shouldSendReport) {
        const rrResult = await runRevenueReportAgent();
        results.revenueReport = rrResult.sent ? `sent to ${rrResult.recipients} recipients` : "skipped (no config)";
      } else {
        results.revenueReport = "alerts checked; report not due this hour";
      }
    } else {
      results.revenueReport = "skipped (no config)";
    }
  } catch (err) {
    results.revenueReport = `error: ${String(err)}`;
  }

  // ── Collaboration Matchmaker — monthly (1st of month) ─────────────────────
  const dayOfMonth     = new Date().getDate();
  const isFirstOfMonth = dayOfMonth === 1;
  const shouldRunCollab = isFirstOfMonth && await shouldRun("COLLABORATION_MATCHMAKER", 25 * 24); // 25d guard
  if (shouldRunCollab) {
    try {
      const { runCollaborationMatchmakerAgent } = await import("@/lib/agents/collaboration-matchmaker");
      const result = await runCollaborationMatchmakerAgent();
      results.collaborationMatchmaker = `checked ${result.checked}, matchesSent=${result.matchesSent}`;
    } catch (err) {
      results.collaborationMatchmaker = `error: ${String(err)}`;
    }
  } else {
    results.collaborationMatchmaker = isFirstOfMonth ? "skipped (not due)" : "skipped (not 1st of month)";
  }

  // ── Cover Art Conversion Agent — daily ──────────────────────────────────
  const shouldRunCoverArtConversion = await shouldRun("COVER_ART_CONVERSION", 22); // 22h guard
  if (shouldRunCoverArtConversion) {
    try {
      const { runCoverArtConversionAgent, runCoverArtAbandonedCartAgent } = await import("@/lib/agents/cover-art-conversion");
      await logAgentAction("COVER_ART_CONVERSION", "AGENT_RUN_START");
      const result = await runCoverArtConversionAgent();
      results.coverArtConversion = `acted=${result.acted} (e1=${result.email1} e2=${result.email2} e3=${result.email3} e4=${result.email4} stopped=${result.stopped})`;

      const cartResult = await runCoverArtAbandonedCartAgent();
      results.coverArtAbandonedCart = `acted=${cartResult.acted} sent=${cartResult.emails}`;
    } catch (err) {
      results.coverArtConversion = `error: ${String(err)}`;
    }
  } else {
    results.coverArtConversion    = "skipped (not due)";
    results.coverArtAbandonedCart = "skipped (not due)";
  }

  // ── Video Conversion Agent — daily ───────────────────────────────────────
  const shouldRunVideoConversion = await shouldRun("VIDEO_CONVERSION", 22); // 22h guard
  if (shouldRunVideoConversion) {
    try {
      const { runVideoConversionAgent, runAbandonedCartAgent } = await import("@/lib/agents/video-conversion");
      await logAgentAction("VIDEO_CONVERSION", "AGENT_RUN_START");
      const result = await runVideoConversionAgent();
      results.videoConversion = `acted=${result.acted} (e1=${result.email1} e2=${result.email2} e3=${result.email3} e4=${result.email4} stopped=${result.stopped})`;

      // Abandoned cart runs on the same cadence
      const cartResult = await runAbandonedCartAgent();
      results.abandonedCart = `checked=${cartResult.checked} sent=${cartResult.sent} skipped=${cartResult.skipped}`;
    } catch (err) {
      results.videoConversion = `error: ${String(err)}`;
    }
  } else {
    results.videoConversion = "skipped (not due)";
    results.abandonedCart   = "skipped (not due)";
  }

  return NextResponse.json({
    ok:       true,
    duration: `${Date.now() - now}ms`,
    results,
  });
}

// ─── Helper: shouldRun ────────────────────────────────────────────────────────

async function shouldRun(agentType: string, minHoursBetween: number): Promise<boolean> {
  const lastRun = await getLastRun(agentType);
  if (!lastRun) return true;
  return Date.now() - lastRun.getTime() > minHoursBetween * 60 * 60 * 1000;
}
