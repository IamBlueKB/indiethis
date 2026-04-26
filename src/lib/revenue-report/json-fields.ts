/**
 * Defensive normalizer for RevenueReportConfig.recipients / enabledSections.
 *
 * Both columns are declared as Prisma `Json`. Historically some writes used
 * `JSON.stringify(arr)` (so Prisma returns a string on read) and some writes
 * passed the array directly (Prisma returns an array on read). Schema defaults
 * also produce arrays. This helper accepts either shape and always returns
 * `string[]`, so callers don't crash with "Unexpected token" / "No number
 * after minus sign" when the row was written via the other path.
 */
export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed)
        ? parsed.filter((x: unknown): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
