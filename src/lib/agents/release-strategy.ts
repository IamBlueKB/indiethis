/**
 * src/lib/agents/release-strategy.ts
 * Release Strategy Agent — runs daily via master cron.
 *
 * Watches ReleasePlan records with upcoming release dates and sends timely
 * reminders + action prompts at 30 / 14 / 7 / 3 / 1 day milestones,
 * and a post-release congratulations at day +1.
 *
 * One notification per release plan per trigger point (logged in AgentLog).
 */

import { db }              from "@/lib/db";
import {
  logAgentAction,
  sendAgentNotification,
  sendAgentEmail,
  agentEmailBase,
} from "@/lib/agents";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Trigger definitions ──────────────────────────────────────────────────────

interface Trigger {
  action:    string; // AgentLog action key — uniqueness guard
  daysOut:   number; // positive = before release, negative = after
  windowHrs: number; // how wide a window to catch this trigger (avoid re-fire)
  getTitle:  (planTitle: string) => string;
  getMessage: (opts: TriggerOpts) => string;
  getEmailSubject: (planTitle: string) => string;
  getEmailBody:    (opts: TriggerOpts) => string;
  getCta:          () => { label: string; url: string };
}

interface TriggerOpts {
  planTitle:       string;
  incompleteCount: number;
  hasAudioFeatures: boolean;
  hasCanvas:       boolean;
  hasPressKit:     boolean;
  hasPreSave:      boolean;
}

const TRIGGERS: Trigger[] = [
  {
    action:    "RELEASE_30_DAYS",
    daysOut:   30,
    windowHrs: 36,
    getTitle:  (t) => `Release countdown: 30 days — "${t}"`,
    getMessage: ({ planTitle, incompleteCount }) =>
      `Start building buzz for "${planTitle}". Post teasers on social, get your press kit ready, and line up your playlist pitches. ${incompleteCount > 0 ? `You have ${incompleteCount} tasks still to complete.` : ""}`.trim(),
    getEmailSubject: (t) => `30 days until your release — "${t}"`,
    getEmailBody: ({ planTitle, incompleteCount, hasPressKit }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Your release <strong style="color:#fff;">"${planTitle}"</strong> is 30 days away. Here's what to focus on this week:</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         <li>Post teasers on social media (snippets, behind-the-scenes, cover art reveals)</li>
         <li>Build a pre-save campaign to capture fan emails before release day</li>
         ${!hasPressKit ? '<li style="color:#D4A843;">Generate your press kit — you\'ll need it for playlist and media submissions</li>' : ''}
         <li>Research playlist curators and DJs in your genre to pitch</li>
       </ul>
       ${incompleteCount > 0 ? `<p style="margin:0 0 16px;font-size:13px;color:#666;">You have <strong style="color:#FBBF24;">${incompleteCount} tasks</strong> still to complete in your release plan.</p>` : ''}`,
    getCta: () => ({ label: "View Release Plan →", url: `${APP_URL()}/dashboard/releases` }),
  },
  {
    action:    "RELEASE_14_DAYS",
    daysOut:   14,
    windowHrs: 36,
    getTitle:  (t) => `Release countdown: 14 days — "${t}"`,
    getMessage: ({ planTitle, hasPressKit, hasPreSave }) =>
      `2 weeks until "${planTitle}" drops. ${!hasPressKit ? "Generate your press kit for media pitches." : ""} ${!hasPreSave ? "Set up your pre-save campaign now." : ""} Submit to playlist curators and DJs.`.trim(),
    getEmailSubject: (t) => `2 weeks to go — submit your release to curators`,
    getEmailBody: ({ planTitle, hasPressKit, hasPreSave, incompleteCount }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;"><strong style="color:#fff;">"${planTitle}"</strong> drops in 2 weeks. This is the window to get in front of curators.</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         ${!hasPressKit ? '<li style="color:#D4A843;">Generate your press kit — curators want to know your story</li>' : '<li>Press kit ready ✓</li>'}
         ${!hasPreSave ? '<li style="color:#D4A843;">Set up a pre-save campaign to capture fans before release day</li>' : '<li>Pre-save campaign ready ✓</li>'}
         <li>Submit your track to SubmitHub, Groover, or DMs with curators in your genre</li>
         <li>Reach out to DJs on IndieThis whose crates match your sound</li>
       </ul>
       ${incompleteCount > 0 ? `<p style="margin:0;font-size:13px;color:#666;"><strong style="color:#FBBF24;">${incompleteCount} tasks</strong> still to complete in your release plan.</p>` : ''}`,
    getCta: () => ({ label: "View Release Plan →", url: `${APP_URL()}/dashboard/releases` }),
  },
  {
    action:    "RELEASE_7_DAYS",
    daysOut:   7,
    windowHrs: 36,
    getTitle:  (t) => `Final week: "${t}" releases in 7 days`,
    getMessage: ({ planTitle, incompleteCount }) =>
      `One week until "${planTitle}". Schedule your email blast to go out on release day, make sure your pre-save is live, and confirm your artist page is published. ${incompleteCount > 0 ? `${incompleteCount} tasks still to complete.` : ""}`.trim(),
    getEmailSubject: (t) => `Final week checklist — "${t}"`,
    getEmailBody: ({ planTitle, incompleteCount, hasPreSave }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">One week until <strong style="color:#fff;">"${planTitle}"</strong> drops. Final push:</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         <li>Schedule your email blast to go out on release day</li>
         ${!hasPreSave ? '<li style="color:#D4A843;">Pre-save campaign — still time to set this up</li>' : '<li>Pre-save live ✓</li>'}
         <li>Confirm your artist page is published and your track is uploaded</li>
         <li>Prepare your release day social posts in advance</li>
         <li>Brief your team, collaborators, and anyone reposting</li>
       </ul>
       ${incompleteCount > 0 ? `<p style="margin:0;font-size:13px;color:#666;"><strong style="color:#FBBF24;">${incompleteCount} tasks</strong> still to complete.</p>` : ''}`,
    getCta: () => ({ label: "View Release Plan →", url: `${APP_URL()}/dashboard/releases` }),
  },
  {
    action:    "RELEASE_3_DAYS",
    daysOut:   3,
    windowHrs: 36,
    getTitle:  (t) => `3 days until "${t}" — final checks`,
    getMessage: ({ planTitle, hasCanvas, hasAudioFeatures }) =>
      `Almost time for "${planTitle}". Make sure your cover art is finalized${!hasCanvas ? ", generate your canvas video" : ""}${!hasAudioFeatures ? ", and upload the final mix so your track features populate" : ""}. You're almost there.`,
    getEmailSubject: (t) => `3 days to release — final checks for "${t}"`,
    getEmailBody: ({ planTitle, hasCanvas, hasAudioFeatures }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;"><strong style="color:#fff;">"${planTitle}"</strong> drops in 3 days. Final checks:</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         <li>Cover art finalized and uploaded ✓</li>
         ${!hasCanvas ? '<li style="color:#D4A843;">Canvas video — generate now so it\'s ready on release day</li>' : '<li>Canvas video ready ✓</li>'}
         ${!hasAudioFeatures ? '<li style="color:#D4A843;">Upload your final mix — audio features power our recommendation engine</li>' : ''}
         <li>Lyric video published and shareable</li>
         <li>All social posts scheduled and queued</li>
       </ul>`,
    getCta: () => ({ label: "Check Your Release →", url: `${APP_URL()}/dashboard/music` }),
  },
  {
    action:    "RELEASE_1_DAY",
    daysOut:   1,
    windowHrs: 36,
    getTitle:  (t) => `Tomorrow: "${t}" releases`,
    getMessage: ({ planTitle }) =>
      `Tomorrow's the day for "${planTitle}". Double-check everything is uploaded and published. Your artist page, track, canvas video, and any pre-save links should all be live and tested.`,
    getEmailSubject: (t) => `Tomorrow is release day — "${t}"`,
    getEmailBody: ({ planTitle }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Tomorrow, <strong style="color:#fff;">"${planTitle}"</strong> is live. Quick final run-through:</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         <li>Open your artist page and play the track — confirm it works</li>
         <li>Test your pre-save link from a browser you're not logged into</li>
         <li>Confirm your email blast is scheduled for tomorrow morning</li>
         <li>Send the track link to 5 people right now — get it moving early</li>
       </ul>
       <p style="margin:0;font-size:14px;color:#D4A843;font-weight:600;">You got this.</p>`,
    getCta: () => ({ label: "View Your Artist Page →", url: `${APP_URL()}/dashboard/site` }),
  },
  {
    action:    "RELEASE_POST_DAY1",
    daysOut:   -1,
    windowHrs: 36,
    getTitle:  (t) => `Your release is live! — "${t}"`,
    getMessage: ({ planTitle }) =>
      `"${planTitle}" is out. Share it everywhere today — every stream, save, and share in the first 24 hours matters most for algorithmic push. Run a Track Shield scan in a week to monitor usage.`,
    getEmailSubject: (t) => `"${t}" is out — what to do today`,
    getEmailBody: ({ planTitle }) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Congratulations — <strong style="color:#fff;">"${planTitle}"</strong> is out.</p>
       <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">The first 24–48 hours are the most important for algorithmic consideration. Here's what to do right now:</p>
       <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
         <li>Post on every platform — IG, TikTok, Twitter, everywhere</li>
         <li>Reply to every comment and DM today</li>
         <li>Ask your closest fans to share and save</li>
         <li>Send your release to any blogs, curators, or press contacts</li>
         <li>In 7 days, run a Track Shield scan to monitor unauthorized use</li>
       </ul>`,
    getCta: () => ({ label: "View Your Analytics →", url: `${APP_URL()}/dashboard` }),
  },
];

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runReleaseStrategyAgent(): Promise<{ acted: number }> {
  const now = Date.now();

  // Load all non-cancelled release plans with dates within ±35 days
  const windowStart = new Date(now - 2  * 24 * 60 * 60 * 1000); // 2 days ago (catch post-release)
  const windowEnd   = new Date(now + 31 * 24 * 60 * 60 * 1000); // 31 days out

  const plans = await db.releasePlan.findMany({
    where: {
      status:      { not: "CANCELLED" as const },
      releaseDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id:          true,
      title:       true,
      releaseDate: true,
      artistId:    true,
      artist: {
        select: { email: true, name: true },
      },
      tasks: {
        select: { isCompleted: true },
      },
      track: {
        select: {
          id:            true,
          canvasVideoUrl: true,
          audioFeatures: { select: { id: true } },
        },
      },
    },
  });

  // Pre-save campaigns keyed by artistId
  const preSaves = await db.preSaveCampaign.findMany({
    where: {
      artistId: { in: [...new Set(plans.map((p) => p.artistId))] },
      isActive: true,
    },
    select: { artistId: true },
  });
  const artistsWithPreSave = new Set(preSaves.map((p) => p.artistId));

  // Press kits keyed by artistId (AI generation of type PRESS_KIT)
  const pressKits = await db.aIGeneration.findMany({
    where: {
      userId: { in: [...new Set(plans.map((p) => p.artistId))] },
      type:   "PRESS_KIT",
      status: "COMPLETED",
    },
    select: { userId: true },
  });
  const artistsWithPressKit = new Set(pressKits.map((p) => p.userId));

  let acted = 0;

  for (const plan of plans) {
    const daysUntil = (plan.releaseDate.getTime() - now) / (24 * 60 * 60 * 1000);

    for (const trigger of TRIGGERS) {
      // Check if this trigger window applies
      const diff = daysUntil - trigger.daysOut;
      if (Math.abs(diff) > trigger.windowHrs / 24) continue;

      // Check if we've already fired this trigger for this plan
      const alreadyFired = await db.agentLog.findFirst({
        where: {
          agentType:  "RELEASE_STRATEGY",
          action:     trigger.action,
          targetId:   plan.id,
        },
        select: { id: true },
      });
      if (alreadyFired) continue;

      const incompleteCount = plan.tasks.filter((t) => !t.isCompleted).length;
      const hasCanvas       = !!plan.track?.canvasVideoUrl;
      const hasAudioFeatures = !!plan.track?.audioFeatures;
      const hasPressKit     = artistsWithPressKit.has(plan.artistId);
      const hasPreSave      = artistsWithPreSave.has(plan.artistId);

      const opts: TriggerOpts = {
        planTitle:        plan.title,
        incompleteCount,
        hasAudioFeatures,
        hasCanvas,
        hasPressKit,
        hasPreSave,
      };

      const cta = trigger.getCta();

      // Send in-app notification
      await sendAgentNotification(
        plan.artistId,
        trigger.getTitle(plan.title),
        trigger.getMessage(opts),
        `${APP_URL()}/dashboard/releases`,
      );

      // Send email
      await sendAgentEmail(
        { email: plan.artist.email, name: plan.artist.name ?? "there" },
        trigger.getEmailSubject(plan.title),
        agentEmailBase(trigger.getEmailBody(opts), cta.label, cta.url),
        ["agent", "release-strategy"],
      );

      // Log so we never re-fire this trigger for this plan
      await logAgentAction("RELEASE_STRATEGY", trigger.action, "RELEASE_PLAN", plan.id, {
        planTitle:    plan.title,
        daysUntil:    Math.round(daysUntil),
        artistId:     plan.artistId,
      });

      acted++;
      break; // only one trigger per plan per run
    }
  }

  await logAgentAction("RELEASE_STRATEGY", "AGENT_RUN_COMPLETE", undefined, undefined, {
    plansChecked: plans.length,
    acted,
  });

  return { acted };
}
