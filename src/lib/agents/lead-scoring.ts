/**
 * src/lib/agents/lead-scoring.ts
 * Lead Scoring Agent — Step 9
 *
 * Two entry points:
 *   scoreLead()            — event trigger, called immediately after an inquiry is created
 *   runLeadScoringAgent()  — daily rescore of PENDING inquiries older than 24h
 *
 * Score breakdown (0-100):
 *   Has IndieThis account          +20
 *   Has active paid subscription   +15
 *   Subscription tier bonus        +5 / +10 / +15 (Launch/Push/Reign)
 *   Has uploaded tracks            +10
 *   Has fans in CRM                +5
 *   Has previous platform purchase +10
 *   Message quality (Claude)        0–20
 *   Repeat client (prior bookings)  +15
 *   All optional fields filled     +10
 */

import Anthropic        from "@anthropic-ai/sdk";
import { db }           from "@/lib/db";
import { logAgentAction } from "@/lib/agents";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type InquiryType = "ARTIST_BOOKING" | "DJ_BOOKING" | "INTAKE";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a newly created inquiry and persist the score.
 * Call this from the API route that creates the inquiry.
 */
export async function scoreLead(
  type:        InquiryType,
  inquiryId:   string,
  email:       string,
  message:     string,
  optionalFields: Record<string, unknown>, // non-null optional fields the submitter filled
  studioId?:   string,                     // for repeat-client check
): Promise<number> {
  try {
    const score = await calcScore(email, message, optionalFields, studioId);
    await persistScore(type, inquiryId, score);
    await logAgentAction("LEAD_SCORING", "LEAD_SCORED", type, inquiryId, { score, email });
    return score;
  } catch {
    return 0;
  }
}

/**
 * Daily rescore: recalculate all PENDING inquiries older than 24h.
 * In case the user signed up or upgraded after submitting.
 */
export async function runLeadScoringAgent(): Promise<{ acted: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let acted    = 0;

  // ── ArtistBookingInquiry ──────────────────────────────────────────────────
  const artistInquiries = await db.artistBookingInquiry.findMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ leadScore: null }, { leadScore: 0 }],
    },
    select: { id: true, email: true, message: true, artistId: true },
    take: 100,
  });

  for (const inq of artistInquiries) {
    try {
      const score = await calcScore(inq.email, inq.message, {});
      await persistScore("ARTIST_BOOKING", inq.id, score);
      acted++;
    } catch { /* skip */ }
  }

  // ── IntakeSubmission ──────────────────────────────────────────────────────
  const intakes = await db.intakeSubmission.findMany({
    where: {
      status:    "PENDING",
      createdAt: { lt: cutoff },
      OR: [{ leadScore: null }, { leadScore: 0 }],
    },
    select: {
      id:           true,
      studioId:     true,
      notes:        true,
      genre:        true,
      projectDesc:  true,
      instagram:    true,
      tiktok:       true,
      youtubeHandle: true,
      intakeLink:   { select: { email: true } },
    },
    take: 100,
  });

  for (const sub of intakes) {
    try {
      const optionals: Record<string, unknown> = {};
      if (sub.genre)         optionals.genre = sub.genre;
      if (sub.projectDesc)   optionals.projectDesc = sub.projectDesc;
      if (sub.instagram)     optionals.instagram = sub.instagram;
      if (sub.tiktok)        optionals.tiktok = sub.tiktok;
      if (sub.youtubeHandle) optionals.youtubeHandle = sub.youtubeHandle;

      const score = await calcScore(
        sub.intakeLink.email ?? "",
        sub.notes ?? sub.projectDesc ?? "",
        optionals,
        sub.studioId,
      );
      await persistScore("INTAKE", sub.id, score);
      acted++;
    } catch { /* skip */ }
  }

  // ── DJBookingInquiry ──────────────────────────────────────────────────────
  const djInquiries = await db.dJBookingInquiry.findMany({
    where: {
      status:    "PENDING",
      createdAt: { lt: cutoff },
      OR: [{ leadScore: null }, { leadScore: 0 }],
    },
    select: { id: true, email: true, message: true, phone: true, venue: true, eventDate: true },
    take: 100,
  });

  for (const inq of djInquiries) {
    try {
      const optionals: Record<string, unknown> = {};
      if (inq.phone)     optionals.phone = inq.phone;
      if (inq.venue)     optionals.venue = inq.venue;
      if (inq.eventDate) optionals.eventDate = inq.eventDate;

      const score = await calcScore(inq.email, inq.message, optionals);
      await persistScore("DJ_BOOKING", inq.id, score);
      acted++;
    } catch { /* skip */ }
  }

  await logAgentAction("LEAD_SCORING", "RESCORE_COMPLETE", undefined, undefined, { acted });
  return { acted };
}

// ─── Scoring logic ────────────────────────────────────────────────────────────

async function calcScore(
  email:          string,
  message:        string,
  optionalFields: Record<string, unknown>,
  studioId?:      string,
): Promise<number> {
  let score = 0;

  // ── Look up the user by email ─────────────────────────────────────────────
  const user = email
    ? await db.user.findFirst({
        where: { email },
        select: {
          id: true,
          tracks:       { where: { status: "PUBLISHED" }, select: { id: true }, take: 1 },
          fanContacts:  { select: { id: true }, take: 1 },
          subscription: { select: { tier: true, status: true } },
        },
      })
    : null;

  if (user) {
    // Has IndieThis account
    score += 20;

    // Active paid subscription
    if (user.subscription?.status === "ACTIVE") {
      score += 15;
      // Tier bonus
      const tierBonus: Record<string, number> = { LAUNCH: 5, PUSH: 10, REIGN: 15 };
      score += tierBonus[user.subscription.tier] ?? 0;
    }

    // Has uploaded tracks
    if (user.tracks.length > 0) score += 10;

    // Has fans in CRM
    if (user.fanContacts.length > 0) score += 5;

    // Has previous platform purchases (digital products)
    const purchaseCount = await db.digitalPurchase.count({
      where: { buyerId: user.id },
    });
    if (purchaseCount > 0) score += 10;

    // Repeat client (has prior bookings at this studio)
    if (studioId) {
      const priorBooking = await db.bookingSession.findFirst({
        where: { studioId, artistId: user.id },
        select: { id: true },
      });
      if (priorBooking) score += 15;
    }
  }

  // ── Optional fields filled (+10 if 3 or more filled) ─────────────────────
  const filledCount = Object.values(optionalFields).filter(
    (v) => v !== null && v !== undefined && v !== ""
  ).length;
  if (filledCount >= 3) score += 10;

  // ── Message quality via Claude ────────────────────────────────────────────
  const messageScore = await scoreMessageQuality(message);
  score += messageScore;

  return Math.min(100, Math.max(0, score));
}

async function scoreMessageQuality(message: string): Promise<number> {
  if (!message || message.trim().length < 20) return 0;

  try {
    const completion = await anthropic.messages.create({
      model:      "claude-3-5-haiku-20241022",
      max_tokens: 10,
      messages: [
        {
          role:    "user",
          content: `Rate this booking inquiry message for quality and seriousness on a scale of 0 to 20. A detailed, specific message with project info = 16-20. A moderately detailed message = 8-15. A vague or very short message = 0-7. Reply with only a number 0-20, nothing else.

Message: "${message.slice(0, 500)}"`,
        },
      ],
    });

    const raw = completion.content[0].type === "text" ? completion.content[0].text.trim() : "0";
    const n   = parseInt(raw, 10);
    return isNaN(n) ? 0 : Math.min(20, Math.max(0, n));
  } catch {
    return 0;
  }
}

// ─── Persist helpers ──────────────────────────────────────────────────────────

async function persistScore(type: InquiryType, id: string, score: number): Promise<void> {
  if (type === "ARTIST_BOOKING") {
    await db.artistBookingInquiry.update({ where: { id }, data: { leadScore: score } });
  } else if (type === "INTAKE") {
    await db.intakeSubmission.update({ where: { id }, data: { leadScore: score } });
  } else if (type === "DJ_BOOKING") {
    await db.dJBookingInquiry.update({ where: { id }, data: { leadScore: score } });
  }
}

// ─── UI helper ────────────────────────────────────────────────────────────────

export type LeadTier = "cold" | "warm" | "hot" | "fire";

export function getLeadTier(score: number | null | undefined): LeadTier {
  if (!score || score <= 30) return "cold";
  if (score <= 60)           return "warm";
  if (score <= 80)           return "hot";
  return "fire";
}

export const LEAD_TIER_CONFIG: Record<LeadTier, { label: string; color: string; dot: string }> = {
  cold: { label: "Cold",  color: "#6B7280", dot: "bg-gray-500"   },
  warm: { label: "Warm",  color: "#F59E0B", dot: "bg-amber-500"  },
  hot:  { label: "Hot",   color: "#F97316", dot: "bg-orange-500" },
  fire: { label: "Fire",  color: "#EF4444", dot: "bg-red-500"    },
};
