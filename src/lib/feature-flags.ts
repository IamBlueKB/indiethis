/**
 * Feature flags — central access control for gated features.
 *
 * Mix Console + Pro Studio Mixer are hidden from the public for the Lite Launch.
 * Gating is server-side only. Public users get a hard 404 — no "coming soon",
 * no redirects, no hints the feature exists.
 *
 * Access is granted in three ways:
 *   1. Global kill switch — `MIX_CONSOLE_ENABLED=true` → everyone gets it.
 *   2. Per-user DB flag — `User.mixConsoleAccess = true` → that account gets it.
 *   3. Env email allowlist — `MIX_CONSOLE_ALLOWLIST` (comma-separated emails).
 *
 * Use `canAccessMixConsole()` on every gated route and every conditional render.
 */

export type MixConsoleUser = {
  id?: string | null;
  email?: string | null;
  mixConsoleAccess?: boolean | null;
};

export function canAccessMixConsole(user?: MixConsoleUser | null): boolean {
  // Global kill switch — when true, everyone gets it (full launch later)
  if (process.env.MIX_CONSOLE_ENABLED === "true") return true;

  // Otherwise, only explicitly allowlisted accounts
  if (!user) return false;
  if (user.mixConsoleAccess === true) return true;

  // Founder allowlist by email (env-driven, comma-separated)
  const allowlist = (process.env.MIX_CONSOLE_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && allowlist.includes(user.email.toLowerCase())) return true;

  return false;
}
