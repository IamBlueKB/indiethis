/**
 * Rotating "What's New" content for transactional email footers.
 * One item per day — consistent across all emails sent on the same day.
 * Update this array whenever new features launch.
 */

const whatsNewItems = [
  "Canvas videos now play on your explore card — upload yours for free or generate one for $1.99.",
  "New: Sample pack sales are live. Producers, start selling your sound kits today.",
  "Track Shield scans the internet for unauthorized use of your music. Try it from your AI tools.",
  "DJs can now earn 10% when fans discover your crate and buy music. Activate DJ mode in settings.",
  "New AI tool: Vocal Remover separates stems from any track for just $1.99.",
  "Fan Funding is live — your fans can support you directly with one-click contributions.",
  "Release planner: map your rollout, set task deadlines, and go live with confidence.",
  "Merch store is built in — drop branded gear without handling inventory yourself.",
  "Beat marketplace: license your beats with flexible terms and get paid automatically.",
  "Your public artist page includes a built-in pre-save campaign widget.",
];

/**
 * Returns the What's New item for today.
 * Rotates by day-of-year so every email on the same day shows the same item.
 */
export function getWhatsNew(): string {
  const now       = new Date();
  const start     = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return whatsNewItems[dayOfYear % whatsNewItems.length];
}
