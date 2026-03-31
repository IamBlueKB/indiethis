/**
 * src/lib/agents/index.ts
 * Shared utilities for all IndieThis platform agents.
 */
import type { AgentType } from "@prisma/client";
import { Prisma }         from "@prisma/client";
import { db }                 from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendEmail }          from "@/lib/brevo/email";
import type { NotificationType } from "@prisma/client";

const FROM_NAME = "The IndieThis Team";
const APP_URL   = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Agent Logging ────────────────────────────────────────────────────────────

export async function logAgentAction(
  agentType:  AgentType,
  action:     string,
  targetType?: string,
  targetId?:   string,
  details?:    Record<string, unknown>,
): Promise<void> {
  await db.agentLog.create({
    data: {
      agentType,
      action,
      targetType,
      targetId,
      details: details !== undefined ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

// ─── Data Helpers ─────────────────────────────────────────────────────────────

export async function getActiveSubscribers() {
  return db.user.findMany({
    where: {
      isSuspended: false,
      subscription: {
        status: "ACTIVE",
      },
    },
    select: {
      id:            true,
      email:         true,
      name:          true,
      artistSlug:    true,
      lastLoginAt:   true,
      createdAt:     true,
      churnRiskScore: true,
      subscription: {
        select: {
          tier:      true,
          status:    true,
          createdAt: true,
          currentPeriodEnd: true,
        },
      },
    },
  });
}

export async function getStudioOwners() {
  return db.user.findMany({
    where: {
      isSuspended: false,
      ownedStudios: { some: {} },
    },
    select: {
      id:         true,
      email:      true,
      name:       true,
      lastLoginAt: true,
      ownedStudios: {
        select: { id: true, name: true, studioTier: true },
        take: 1,
      },
    },
  });
}

// ─── Email ────────────────────────────────────────────────────────────────────

/**
 * Send a dark-themed agent email. Appears to come from "The IndieThis Team".
 * No mention of AI or agents.
 */
export async function sendAgentEmail(
  to:          { email: string; name: string },
  subject:     string,
  htmlContent: string,
  tags?:       string[],
): Promise<void> {
  await sendEmail({
    to,
    subject,
    htmlContent,
    tags: tags ?? ["agent"],
  });
}

// ─── Notification ─────────────────────────────────────────────────────────────

export async function sendAgentNotification(
  userId:  string,
  title:   string,
  message: string,
  link?:   string,
): Promise<void> {
  await createNotification({
    userId,
    type:    "AI_JOB_COMPLETE" as NotificationType, // repurpose for agent nudges
    title,
    message,
    link,
  });
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Standard dark-theme agent email body wrapper.
 * Used by all agents — consistent IndieThis branding.
 */
export function agentEmailBase(
  bodyHtml:  string,
  ctaLabel:  string,
  ctaUrl:    string,
): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#C8C8C8;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <div style="padding:28px 32px;">
        <p style="margin:0 0 24px;font-size:18px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>
        ${bodyHtml}
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
          <tr>
            <td style="background-color:#D4A843;border-radius:10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">${ctaLabel}</a>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:#333;">IndieThis · <a href="${APP_URL()}/dashboard/settings" style="color:#444;text-decoration:underline;">Manage email preferences</a></p>
      </div>
    </div>
  `;
}

// ─── Last-run helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the agent has taken action on this target within the given
 * number of hours. Prevents re-triggering the same user too soon.
 */
export async function agentActedRecently(
  agentType:  AgentType,
  targetId:   string,
  withinHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const entry = await db.agentLog.findFirst({
    where: {
      agentType,
      targetId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return !!entry;
}

/**
 * Returns the most recent log entry for this agent, or null if none.
 * Used by the master cron to decide if the agent should run this cycle.
 */
export async function getLastRun(agentType: AgentType): Promise<Date | null> {
  const entry = await db.agentLog.findFirst({
    where:   { agentType, action: "AGENT_RUN_START" },
    orderBy: { createdAt: "desc" },
    select:  { createdAt: true },
  });
  return entry?.createdAt ?? null;
}
