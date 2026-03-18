/**
 * email-sequence.ts
 *
 * Scheduling service for post-delivery follow-up email sequences.
 *
 * The studio composes the full subject + body for each step at delivery time.
 * This module stores those finalized messages as ScheduledEmail rows —
 * no template references, no variable substitution at send time.
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleStep = {
  /** "day1" | "day3" | "day7" | "day14" */
  dayKey:   string;
  subject:  string;
  body:     string;
};

export type ScheduleInput = {
  studioId:     string;
  contactId?:   string | null;
  contactEmail: string;
  quickSendId:  string;
  deliveredAt:  Date;
  /** Finalized steps — only the steps the studio chose to send. */
  steps: ScheduleStep[];
};

// ─── Step → Prisma enum mapping ───────────────────────────────────────────────

const DAY_KEY_TO_ENUM: Record<string, "DAY_1" | "DAY_3" | "DAY_7" | "DAY_14"> = {
  day1:  "DAY_1",
  day3:  "DAY_3",
  day7:  "DAY_7",
  day14: "DAY_14",
};

const DAY_KEY_TO_OFFSET: Record<string, number> = {
  day1:  0,
  day3:  3,
  day7:  7,
  day14: 14,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Creates one ScheduledEmail row per step in `input.steps`.
 * Each row stores the full finalized subject + body — no template reference.
 * Returns the number of rows created.
 */
export async function scheduleFollowUpSequence(input: ScheduleInput): Promise<number> {
  const { studioId, contactId, contactEmail, quickSendId, deliveredAt, steps } = input;

  const data = steps
    .filter(({ dayKey, subject, body }) => {
      const enumVal = DAY_KEY_TO_ENUM[dayKey];
      return enumVal && subject.trim() && body.trim();
    })
    .map(({ dayKey, subject, body }) => ({
      studioId,
      contactId:    contactId ?? null,
      contactEmail: contactEmail.toLowerCase().trim(),
      quickSendId,
      sequenceStep: DAY_KEY_TO_ENUM[dayKey]!,
      subject:      subject.trim(),
      body:         body.trim(),
      scheduledFor: addDays(deliveredAt, DAY_KEY_TO_OFFSET[dayKey] ?? 0),
      // status defaults to PENDING via schema
    }));

  if (data.length === 0) return 0;

  const result = await db.scheduledEmail.createMany({ data });
  return result.count;
}

/**
 * Cancel all pending follow-up emails for a given quickSendId.
 */
export async function cancelFollowUpSequence(quickSendId: string): Promise<number> {
  const result = await db.scheduledEmail.updateMany({
    where: { quickSendId, status: "PENDING" },
    data:  { status: "CANCELLED" },
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
    data: { status: "CANCELLED" },
  });
  return result.count;
}

/**
 * Cancel all pending follow-up emails for a contact by their CRM contact ID.
 * Used by the studio CRM "Cancel sequence" button.
 */
export async function cancelFollowUpByContactId(studioId: string, contactId: string): Promise<number> {
  const result = await db.scheduledEmail.updateMany({
    where: { studioId, contactId, status: "PENDING" },
    data:  { status: "CANCELLED" },
  });
  return result.count;
}

/**
 * Cancel all pending follow-up emails for a given email address across ALL studios.
 * Used by Stripe webhook when a user subscribes.
 */
export async function cancelFollowUpByEmail(contactEmail: string): Promise<number> {
  const result = await db.scheduledEmail.updateMany({
    where: {
      contactEmail: contactEmail.toLowerCase().trim(),
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });
  return result.count;
}
