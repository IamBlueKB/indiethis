/**
 * src/lib/agents/session-followup.ts
 * Session Follow-Up Agent — runs daily via master cron.
 *
 * Sends studio-branded follow-up emails to artists/contacts after their
 * recording session at key intervals: 1 / 3 / 7 / 30 days post-session.
 *
 * Gated by Studio.followUpEmailsEnabled — studios can opt out.
 * One email per session per trigger (logged in AgentLog).
 *
 * Follow-up sequence:
 *   Day  1 — "How was your session?" feedback + delivery reminder
 *   Day  3 — "Your files" — check delivered files, next session CTA
 *   Day  7 — "Book your next session" re-engagement
 *   Day 30 — "It's been a month" long-term re-engagement
 */

import { db }            from "@/lib/db";
import {
  logAgentAction,
  sendAgentEmail,
  agentEmailBase,
} from "@/lib/agents";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Trigger definitions ──────────────────────────────────────────────────────

interface FollowUpTrigger {
  action:    string;   // AgentLog action key — uniqueness guard
  daysAfter: number;   // days after session ended
  windowHrs: number;   // matching window
  getSubject: (studioName: string) => string;
  getBody:    (opts: FollowUpOpts) => string;
  getCta:     (slug: string) => { label: string; url: string };
}

interface FollowUpOpts {
  recipientName:  string;
  studioName:     string;
  studioSlug:     string;
  studioLogoUrl:  string | null;
  sessionDate:    Date;
  hasDelivery:    boolean;
  bookingUrl:     string;
}

const FOLLOW_UP_TRIGGERS: FollowUpTrigger[] = [
  {
    action:    "FOLLOWUP_DAY1",
    daysAfter: 1,
    windowHrs: 36,
    getSubject: (s) => `How was your session at ${s}?`,
    getCta: (slug) => ({
      label: "Book Again →",
      url:   `${APP_URL()}/studios/${slug}`,
    }),
    getBody: ({ recipientName, studioName, sessionDate, hasDelivery, studioLogoUrl }) => `
      ${studioLogoUrl ? `<div style="text-align:center;margin:0 0 20px;"><img src="${studioLogoUrl}" alt="${studioName}" style="max-height:48px;max-width:160px;object-fit:contain;" /></div>` : ""}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">
        Hey ${recipientName} — we hope your session on ${sessionDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} was great.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">
        ${hasDelivery
          ? "Your files have been delivered to your dashboard — download them any time and start mixing."
          : "If you need your session files, reach out to the studio and they'll deliver them to your dashboard."}
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">
        If you have a moment, share any feedback with <strong style="color:#fff;">${studioName}</strong> — it helps them keep getting better.
      </p>`,
  },
  {
    action:    "FOLLOWUP_DAY3",
    daysAfter: 3,
    windowHrs: 36,
    getSubject: (s) => `Your files from ${s} — next steps`,
    getCta: (slug) => ({
      label: "View Your Dashboard →",
      url:   `${APP_URL()}/dashboard/music`,
    }),
    getBody: ({ recipientName, studioName, sessionDate, hasDelivery, studioLogoUrl }) => `
      ${studioLogoUrl ? `<div style="text-align:center;margin:0 0 20px;"><img src="${studioLogoUrl}" alt="${studioName}" style="max-height:48px;max-width:160px;object-fit:contain;" /></div>` : ""}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">
        Hey ${recipientName} — checking in on your session from ${sessionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
      </p>
      ${hasDelivery
        ? `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Your delivered files are in your IndieThis dashboard. Upload the final mix to generate audio features, create cover art, or master your track — all in one place.</p>`
        : `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Once you have your final mix, upload it to IndieThis to master it, generate cover art, or build a release plan — everything you need to get it out.</p>`}
      <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
        <li>AI Mastering — professional sound in 3 minutes</li>
        <li>AI Cover Art — 4 generated options from your description</li>
        <li>Release Planner — build your rollout strategy</li>
      </ul>`,
  },
  {
    action:    "FOLLOWUP_DAY7",
    daysAfter: 7,
    windowHrs: 36,
    getSubject: (s) => `Ready to book your next session at ${s}?`,
    getCta: (slug) => ({
      label: `Book at ${slug.replace(/-/g, " ")} →`,
      url:   `${APP_URL()}/studios/${slug}`,
    }),
    getBody: ({ recipientName, studioName, studioLogoUrl }) => `
      ${studioLogoUrl ? `<div style="text-align:center;margin:0 0 20px;"><img src="${studioLogoUrl}" alt="${studioName}" style="max-height:48px;max-width:160px;object-fit:contain;" /></div>` : ""}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">
        Hey ${recipientName} — it's been a week since your session at <strong style="color:#fff;">${studioName}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">
        Consistency is what separates artists who grow from those who plateau. If you've got more material to record, now is a great time to lock in your next date.
      </p>
      <p style="margin:0;font-size:14px;color:#D4A843;font-weight:600;">Keep the momentum going.</p>`,
  },
  {
    action:    "FOLLOWUP_DAY30",
    daysAfter: 30,
    windowHrs: 48,
    getSubject: (s) => `It's been a month — come back to ${s}`,
    getCta: (slug) => ({
      label: "Book a Session →",
      url:   `${APP_URL()}/studios/${slug}`,
    }),
    getBody: ({ recipientName, studioName, studioLogoUrl }) => `
      ${studioLogoUrl ? `<div style="text-align:center;margin:0 0 20px;"><img src="${studioLogoUrl}" alt="${studioName}" style="max-height:48px;max-width:160px;object-fit:contain;" /></div>` : ""}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">
        Hey ${recipientName} — it's been about a month since your last session at <strong style="color:#fff;">${studioName}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">
        Whether you're working on something new or ready to finish what you started, the studio is ready when you are. Book anytime.
      </p>`,
  },
];

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runSessionFollowUpAgent(): Promise<{ acted: number }> {
  const now = Date.now();

  // Widest window we need to check: 30 days + 48h = ~32 days
  const windowStart = new Date(now - 32 * 24 * 60 * 60 * 1000);
  const windowEnd   = new Date(now);

  // Load completed sessions within the look-back window
  const sessions = await db.bookingSession.findMany({
    where: {
      status:   "COMPLETED",
      dateTime: { gte: windowStart, lte: windowEnd },
      studio: {
        followUpEmailsEnabled: true,
        isPublished:           true,
      },
    },
    select: {
      id:       true,
      dateTime: true,
      studio: {
        select: {
          id:      true,
          name:    true,
          slug:    true,
          logoUrl: true,
          logo:    true,
          email:   true,
          owner: {
            select: { email: true, name: true },
          },
        },
      },
      // Artist (may be null for walk-in bookings)
      artist: {
        select: { email: true, name: true, artistName: true },
      },
      // Contact (walk-in or linked contact)
      contact: {
        select: { email: true, name: true, firstName: true },
      },
      // Delivered files for this session
      deliveredFiles: {
        select: { id: true },
        take:   1,
      },
    },
  });

  let acted = 0;

  for (const session of sessions) {
    const sessionAge = (now - session.dateTime.getTime()) / (24 * 60 * 60 * 1000);

    // Determine recipient email + name
    const recipientEmail =
      session.contact?.email ??
      session.artist?.email ??
      null;

    if (!recipientEmail) continue; // no email to send to

    const recipientName =
      session.contact?.firstName ??
      session.contact?.name ??
      session.artist?.artistName ??
      session.artist?.name ??
      "there";

    const studio      = session.studio;
    const hasDelivery = session.deliveredFiles.length > 0;

    // The logo URL prefers the `logoUrl` field, falls back to `logo`
    const studioLogoUrl = studio.logoUrl ?? studio.logo ?? null;

    for (const trigger of FOLLOW_UP_TRIGGERS) {
      const diff = sessionAge - trigger.daysAfter;
      if (Math.abs(diff) > trigger.windowHrs / 24) continue;

      // Check if already sent
      const alreadyFired = await db.agentLog.findFirst({
        where: {
          agentType: "SESSION_FOLLOWUP",
          action:    trigger.action,
          targetId:  session.id,
        },
        select: { id: true },
      });
      if (alreadyFired) continue;

      const cta  = trigger.getCta(studio.slug);
      const opts: FollowUpOpts = {
        recipientName,
        studioName:   studio.name,
        studioSlug:   studio.slug,
        studioLogoUrl,
        sessionDate:  session.dateTime,
        hasDelivery,
        bookingUrl:   cta.url,
      };

      const subject = trigger.getSubject(studio.name);
      const body    = trigger.getBody(opts);

      await sendAgentEmail(
        { email: recipientEmail, name: recipientName },
        subject,
        agentEmailBase(body, cta.label, cta.url),
        ["agent", "session-followup"],
      );

      await logAgentAction(
        "SESSION_FOLLOWUP",
        trigger.action,
        "BOOKING_SESSION",
        session.id,
        {
          studioId:      studio.id,
          studioName:    studio.name,
          recipientEmail,
          daysAfterSession: Math.round(sessionAge),
        },
      );

      acted++;
      break; // only one trigger per session per run
    }
  }

  await logAgentAction("SESSION_FOLLOWUP", "AGENT_RUN_COMPLETE", undefined, undefined, {
    sessionsChecked: sessions.length,
    acted,
  });

  return { acted };
}
