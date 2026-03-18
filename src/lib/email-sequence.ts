/**
 * email-sequence.ts
 *
 * Scheduling service for post-delivery follow-up email sequences.
 *
 * Call `scheduleFollowUpSequence()` immediately after a file delivery is
 * created with sendFollowUpSequence: true. It reads the studio's saved
 * emailTemplates, filters to only enabled steps, and inserts one
 * ScheduledEmail row per enabled step with the correct scheduledFor date.
 *
 * A separate cron/worker (Step 7+) will query PENDING rows where
 * scheduledFor <= now() and actually send them.
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailTemplateStep = {
  enabled: boolean;
  subject: string;
  body: string;
};

type EmailTemplates = {
  day1?:  EmailTemplateStep;
  day3?:  EmailTemplateStep;
  day7?:  EmailTemplateStep;
  day14?: EmailTemplateStep;
};

export type ScheduleInput = {
  studioId:     string;
  contactId?:   string | null;
  contactEmail: string;
  quickSendId:  string;
  deliveredAt:  Date;
  /** Studio's emailTemplates JSON field — pass studio.emailTemplates directly */
  emailTemplates: unknown;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { key: "day1"  as const, prismaStep: "DAY_1"  as const, offsetDays: 0  },
  { key: "day3"  as const, prismaStep: "DAY_3"  as const, offsetDays: 3  },
  { key: "day7"  as const, prismaStep: "DAY_7"  as const, offsetDays: 7  },
  { key: "day14" as const, prismaStep: "DAY_14" as const, offsetDays: 14 },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseTemplates(raw: unknown): EmailTemplates {
  if (!raw || typeof raw !== "object") return {};
  return raw as EmailTemplates;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Creates ScheduledEmail rows for every enabled template step.
 * Day 1 scheduledFor = deliveredAt (send immediately / within minutes).
 * Day 3/7/14 scheduledFor = deliveredAt + N days.
 *
 * Returns the number of jobs created.
 */
export async function scheduleFollowUpSequence(input: ScheduleInput): Promise<number> {
  const {
    studioId,
    contactId,
    contactEmail,
    quickSendId,
    deliveredAt,
    emailTemplates,
  } = input;

  const templates = parseTemplates(emailTemplates);

  // Build create-many payload — only for enabled steps with non-empty templates
  const data = STEPS
    .filter(({ key }) => {
      const step = templates[key];
      return step?.enabled === true && step.subject?.trim() && step.body?.trim();
    })
    .map(({ prismaStep, offsetDays }) => ({
      studioId,
      contactId:    contactId ?? null,
      contactEmail: contactEmail.toLowerCase().trim(),
      quickSendId,
      sequenceStep: prismaStep,
      scheduledFor: addDays(deliveredAt, offsetDays),
      // status defaults to PENDING via schema
    }));

  if (data.length === 0) return 0;

  const result = await db.scheduledEmail.createMany({ data });
  return result.count;
}

/**
 * Cancel all pending follow-up emails for a given quickSendId.
 * Call this if a delivery is revoked or the studio opts the client out.
 */
export async function cancelFollowUpSequence(quickSendId: string): Promise<number> {
  const result = await db.scheduledEmail.updateMany({
    where: {
      quickSendId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });
  return result.count;
}

/**
 * Cancel all pending follow-up emails for a specific contact across all sends.
 */
export async function cancelFollowUpForContact(studioId: string, contactEmail: string): Promise<number> {
  const result = await db.scheduledEmail.updateMany({
    where: {
      studioId,
      contactEmail: contactEmail.toLowerCase().trim(),
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });
  return result.count;
}
