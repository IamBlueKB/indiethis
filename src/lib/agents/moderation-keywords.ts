/**
 * src/lib/agents/moderation-keywords.ts
 * Content moderation keyword lists for IndieThis platform.
 *
 * HIGH severity — triggers auto-unpublish + account flag
 * MEDIUM severity — triggers auto-unpublish + artist notification
 * LOW severity — stays published, admin notified for review
 */

export type ModerationKeyword = {
  pattern: RegExp;
  reason:  string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export const MODERATION_KEYWORDS: ModerationKeyword[] = [
  // ── HIGH: Slurs & hate speech ─────────────────────────────────────────────
  { pattern: /\bn[*i]gg[ae]r\b/i,            reason: "Racial slur",             severity: "HIGH" },
  { pattern: /\bf[*a]gg[oi]t\b/i,            reason: "Homophobic slur",         severity: "HIGH" },
  { pattern: /\bch[*i]nk\b/i,                reason: "Racial slur",             severity: "HIGH" },
  { pattern: /\bsp[*i]c\b/i,                 reason: "Racial slur",             severity: "HIGH" },
  { pattern: /\bk[*i]ke\b/i,                 reason: "Antisemitic slur",        severity: "HIGH" },
  { pattern: /\bc[*u]nt\b/i,                 reason: "Hate speech",             severity: "HIGH" },
  { pattern: /\bk[*i]ll\s+all\s+\w+/i,       reason: "Violent hate speech",     severity: "HIGH" },
  { pattern: /\bwhite\s+power\b/i,            reason: "Extremist content",       severity: "HIGH" },
  { pattern: /\bchild\s+porn/i,               reason: "CSAM reference",          severity: "HIGH" },

  // ── MEDIUM: Spam patterns ──────────────────────────────────────────────────
  { pattern: /(.)\1{6,}/,                     reason: "Excessive repeated characters", severity: "MEDIUM" },
  { pattern: /[A-Z]{15,}/,                    reason: "Excessive caps (spam)",   severity: "MEDIUM" },
  { pattern: /https?:\/\/\S+/i,              reason: "URL in title/bio",        severity: "MEDIUM" },
  { pattern: /\b(free\s+follow|follow\s+back|f4f|like4like|l4l)\b/i, reason: "Engagement farming", severity: "MEDIUM" },
  { pattern: /\b(buy\s+now|limited\s+offer|click\s+here|act\s+now)\b/i, reason: "Spam language", severity: "MEDIUM" },
  { pattern: /(\b\w+\b)(\s+\1){4,}/i,        reason: "Repeated words (spam)",   severity: "MEDIUM" },

  // ── LOW: Impersonation signals ────────────────────────────────────────────
  { pattern: /\bofficial\s+(drake|beyonc[eé]|taylor\s+swift|kanye|jay.?z|eminem|rihanna|kendrick|future|travis\s+scott)\b/i, reason: "Possible artist impersonation", severity: "LOW" },
  { pattern: /\b(drake|beyonc[eé]|taylor\s+swift|kanye|jay.?z|eminem|rihanna|kendrick|future|travis\s+scott)\s+official\b/i, reason: "Possible artist impersonation", severity: "LOW" },
  { pattern: /\breal\s+(drake|beyonc[eé]|taylor\s+swift|kanye|jay.?z|eminem|rihanna|kendrick|future|travis\s+scott)\b/i, reason: "Possible artist impersonation", severity: "LOW" },

  // ── LOW: Suspicious promo ─────────────────────────────────────────────────
  { pattern: /\b(telegram|whatsapp|t\.me|discord\.gg)\b/i, reason: "Off-platform contact in bio", severity: "LOW" },
  { pattern: /\bcontact\s+me\s+at\b/i,       reason: "Solicitation in bio",     severity: "LOW" },
];

/**
 * Scan a text string against all keyword rules.
 * Returns the first (most severe) match found, or null.
 */
export function scanText(text: string): ModerationKeyword | null {
  // Check HIGH first, then MEDIUM, then LOW
  const priority = ["HIGH", "MEDIUM", "LOW"] as const;
  for (const severity of priority) {
    const match = MODERATION_KEYWORDS.find(
      (kw) => kw.severity === severity && kw.pattern.test(text)
    );
    if (match) return match;
  }
  return null;
}
