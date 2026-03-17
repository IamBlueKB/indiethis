/**
 * Format a raw phone input string to (XXX) XXX-XXXX as the user types.
 * Strips all non-digits and caps at 10 digits (US number).
 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Convert a (XXX) XXX-XXXX formatted number to E.164 (+1XXXXXXXXXX).
 * Falls back to the original string if fewer than 10 digits are found.
 */
export function toE164(formatted: string): string {
  const digits = formatted.replace(/\D/g, "").slice(0, 10);
  return digits.length === 10 ? `+1${digits}` : formatted;
}
