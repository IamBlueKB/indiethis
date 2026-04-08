/**
 * admin-permissions.ts
 *
 * Role-based permission gating for the IndieThis admin panel.
 *
 * Pages / sections recognised by this module:
 *   dashboard | users | studios | moderation | content | affiliates | attribution |
 *   support-chat | ai-usage | revenue | settings | team |
 *   promo-codes | ambassadors | promo-analytics | explore | lead-tracking | agents
 *
 * Access matrix:
 * ┌──────────────┬─────────────┬───────────┬───────────────┐
 * │ Page         │ SUPER_ADMIN │ OPS_ADMIN │ SUPPORT_ADMIN │
 * ├──────────────┼─────────────┼───────────┼───────────────┤
 * │ dashboard    │ full        │ full      │ view-only     │
 * │ users        │ full        │ full      │ view-only     │
 * │ studios      │ full        │ full      │ view-only     │
 * │ moderation   │ full        │ full      │ full          │
 * │ content      │ full        │ full      │ full          │
 * │ affiliates   │ full        │ full      │ none          │
 * │ attribution  │ full        │ full      │ none          │
 * │ support-chat │ full        │ full      │ full          │
 * │ ai-usage     │ full        │ view-only │ none          │
 * │ revenue      │ full        │ none      │ none          │
 * │ settings     │ full        │ none      │ none          │
 * │ team         │ full        │ none      │ none          │
 * │ promo-codes  │ full        │ full      │ none          │
 * │ ambassadors  │ full        │ full      │ none          │
 * │ explore      │ full        │ full      │ none          │
 * └──────────────┴─────────────┴───────────┴───────────────┘
 */

import type { AdminRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Permission table
// ---------------------------------------------------------------------------

type AccessLevel = "full" | "view-only" | "none";

/** Map of page → { role → access level } */
const PERMISSIONS: Record<string, Record<AdminRole, AccessLevel>> = {
  dashboard: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "view-only",
  },
  users: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "view-only",
  },
  studios: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "view-only",
  },
  moderation: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "full",
  },
  content: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "full",
  },
  affiliates: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  attribution: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "support-chat": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "full",
  },
  "ai-usage": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "view-only",
    SUPPORT_ADMIN: "none",
  },
  revenue: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "none",
    SUPPORT_ADMIN: "none",
  },
  settings: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "none",
    SUPPORT_ADMIN: "none",
  },
  team: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "none",
    SUPPORT_ADMIN: "none",
  },
  "promo-popups": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "promo-codes": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  ambassadors: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "promo-analytics": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  explore: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "lead-tracking": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "audio-features": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  "dj-verification": {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
  agents: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "view-only",
    SUPPORT_ADMIN: "none",
  },
  mastering: {
    SUPER_ADMIN:   "full",
    OPS_ADMIN:     "full",
    SUPPORT_ADMIN: "none",
  },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `role` is allowed to access `page` (view-only counts as access).
 * Unknown pages return false for non-super-admins.
 */
export function canAccess(role: AdminRole, page: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  const level = PERMISSIONS[page]?.[role];
  return level === "full" || level === "view-only";
}

/**
 * Returns true when the role can see `page` but cannot perform write/mutate actions.
 */
export function isViewOnly(role: AdminRole, page: string): boolean {
  if (role === "SUPER_ADMIN") return false;
  const level = PERMISSIONS[page]?.[role];
  return level === "view-only";
}

/**
 * Convenience: returns the raw AccessLevel for a role + page combo.
 * Useful for rendering conditional UI (badges, disabled buttons, etc.).
 */
export function getAccessLevel(role: AdminRole, page: string): AccessLevel {
  if (role === "SUPER_ADMIN") return "full";
  return PERMISSIONS[page]?.[role] ?? "none";
}
