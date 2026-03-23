/**
 * Release Planner — Default Task Template
 *
 * Generates the standard rollout checklist for a release plan,
 * with due dates calculated backwards from the release date.
 */

import type { TaskCategory, TaskActionType } from "@prisma/client";

type TaskDef = {
  title: string;
  description: string;
  category: TaskCategory;
  actionType: TaskActionType | null;
  actionUrl: string | null;
  daysBeforeRelease: number; // negative = before, 0 = release day, positive = after
};

const TASK_TEMPLATE: TaskDef[] = [
  // ── Week 4 (28 days before) ──────────────────────────────────────────────
  {
    title: "Upload and master your track",
    description: "Use the AI Mastering tool to get a professional sound before distribution.",
    category: "CREATIVE",
    actionType: "AI_MASTERING",
    actionUrl: "/dashboard/ai/mastering",
    daysBeforeRelease: 28,
  },
  {
    title: "Generate cover art",
    description: "Use the AI Cover Art tool to create stunning artwork for your release.",
    category: "CREATIVE",
    actionType: "AI_COVER_ART",
    actionUrl: "/dashboard/ai/cover-art",
    daysBeforeRelease: 28,
  },
  {
    title: "Create split sheet for collaborators",
    description: "If you collaborated with others, set up a split sheet to define royalty shares.",
    category: "ADMIN",
    actionType: "SPLIT_SHEET",
    actionUrl: "/dashboard/splits",
    daysBeforeRelease: 28,
  },

  // ── Week 3 (21 days before) ──────────────────────────────────────────────
  {
    title: "Create lyric video",
    description: "Generate an AI-powered lyric video to share across social media.",
    category: "CREATIVE",
    actionType: "AI_LYRIC_VIDEO",
    actionUrl: "/dashboard/ai/lyric-video",
    daysBeforeRelease: 21,
  },
  {
    title: "Generate AI music video",
    description: "Create a professional AI-generated music video to accompany your release.",
    category: "CREATIVE",
    actionType: "AI_VIDEO",
    actionUrl: "/dashboard/ai/video",
    daysBeforeRelease: 21,
  },
  {
    title: "Set up pre-save campaign",
    description: "Create a pre-save page so fans can save your release ahead of launch day.",
    category: "MARKETING",
    actionType: "PRE_SAVE_CAMPAIGN",
    actionUrl: "/dashboard/releases",
    daysBeforeRelease: 21,
  },

  // ── Week 2 (14 days before) ──────────────────────────────────────────────
  {
    title: "Generate press kit",
    description: "Create a professional AI press kit with bio, photos, and key stats.",
    category: "CREATIVE",
    actionType: "AI_PRESS_KIT",
    actionUrl: "/dashboard/ai/press-kit",
    daysBeforeRelease: 14,
  },
  {
    title: "Draft email blast to fans",
    description: "Write and schedule an announcement email to your fan mailing list.",
    category: "MARKETING",
    actionType: "EMAIL_BLAST",
    actionUrl: "/dashboard/email-blasts",
    daysBeforeRelease: 14,
  },
  {
    title: "Design and launch release merch",
    description: "Create merch tied to this release — t-shirts, hoodies, or digital bundles.",
    category: "MERCH",
    actionType: "MERCH_LAUNCH",
    actionUrl: "/dashboard/merch",
    daysBeforeRelease: 14,
  },

  // ── Week 1 (7 days before) ───────────────────────────────────────────────
  {
    title: "Schedule release day email blast",
    description: "Queue your release day email so it goes out automatically on launch.",
    category: "MARKETING",
    actionType: "EMAIL_BLAST",
    actionUrl: "/dashboard/email-blasts",
    daysBeforeRelease: 7,
  },
  {
    title: "Schedule release day SMS broadcast",
    description: "Schedule an SMS to fans for the moment your release goes live.",
    category: "MARKETING",
    actionType: "SMS_BROADCAST",
    actionUrl: "/dashboard/broadcasts",
    daysBeforeRelease: 7,
  },
  {
    title: "Update artist page with teaser",
    description: "Add a teaser section, update your bio, and link your pre-save campaign.",
    category: "MARKETING",
    actionType: null,
    actionUrl: "/dashboard/site",
    daysBeforeRelease: 7,
  },

  // ── Release Day (0) ──────────────────────────────────────────────────────
  {
    title: "Publish track on artist page",
    description: "Set your track to Published so it goes live on your artist page.",
    category: "DISTRIBUTION",
    actionType: "UPLOAD_TRACK",
    actionUrl: "/dashboard/music",
    daysBeforeRelease: 0,
  },
  {
    title: "Send email blast",
    description: "Send (or confirm scheduled) release day email to your fans.",
    category: "MARKETING",
    actionType: "EMAIL_BLAST",
    actionUrl: "/dashboard/email-blasts",
    daysBeforeRelease: 0,
  },
  {
    title: "Send SMS broadcast",
    description: "Send (or confirm scheduled) release day SMS to your fans.",
    category: "MARKETING",
    actionType: "SMS_BROADCAST",
    actionUrl: "/dashboard/broadcasts",
    daysBeforeRelease: 0,
  },
  {
    title: "Pin announcement on artist page",
    description: "Add a pinned release day announcement to your artist page.",
    category: "MARKETING",
    actionType: null,
    actionUrl: "/dashboard/site",
    daysBeforeRelease: 0,
  },
  {
    title: "Make release merch live",
    description: "Switch your release merch from draft to live in the merch store.",
    category: "MERCH",
    actionType: "MERCH_LAUNCH",
    actionUrl: "/dashboard/merch",
    daysBeforeRelease: 0,
  },

  // ── Week 1 After (+7 days) ───────────────────────────────────────────────
  {
    title: "Generate A&R report",
    description: "Use the AI A&R Report tool to create a professional one-pager for industry contacts.",
    category: "MARKETING",
    actionType: "AI_AR_REPORT",
    actionUrl: "/dashboard/ai/ar-report",
    daysBeforeRelease: -7,
  },
  {
    title: "Review analytics",
    description: "Check your play counts, fan growth, and engagement since launch.",
    category: "MARKETING",
    actionType: null,
    actionUrl: "/dashboard/analytics",
    daysBeforeRelease: -7,
  },
  {
    title: "Send follow-up email to new fans",
    description: "Reach out to fans who joined around your release with a thank-you email.",
    category: "MARKETING",
    actionType: "EMAIL_BLAST",
    actionUrl: "/dashboard/email-blasts",
    daysBeforeRelease: -7,
  },
];

/**
 * Generate the default task list for a release plan.
 * Returns an array ready for Prisma `createMany`.
 */
export function generateDefaultTasks(
  releasePlanId: string,
  releaseDate: Date
): {
  releasePlanId: string;
  title: string;
  description: string;
  category: TaskCategory;
  actionType: TaskActionType | null;
  actionUrl: string | null;
  dueDate: Date;
  sortOrder: number;
}[] {
  return TASK_TEMPLATE.map((def, i) => {
    const dueDate = new Date(releaseDate);
    // daysBeforeRelease: positive = before release, 0 = release day, negative = after
    dueDate.setDate(dueDate.getDate() - def.daysBeforeRelease);

    return {
      releasePlanId,
      title: def.title,
      description: def.description,
      category: def.category,
      actionType: def.actionType,
      actionUrl: def.actionUrl,
      dueDate,
      sortOrder: i,
    };
  });
}

/**
 * Group label and description for timeline display.
 */
export function getWeekLabel(daysFromRelease: number): { label: string; subtitle: string } {
  if (daysFromRelease >= 28) return { label: "Week 4", subtitle: "Creative Foundation" };
  if (daysFromRelease >= 21) return { label: "Week 3", subtitle: "Content Creation" };
  if (daysFromRelease >= 14) return { label: "Week 2", subtitle: "Pre-Launch Prep" };
  if (daysFromRelease >= 7)  return { label: "Week 1", subtitle: "Final Countdown" };
  if (daysFromRelease >= 0)  return { label: "Release Day", subtitle: "Go Time 🚀" };
  return { label: "Post-Launch", subtitle: "Momentum & Growth" };
}
