/**
 * Brevo API client initialization
 * Uses @getbrevo/brevo v2 — BrevoClient with namespaced sub-APIs.
 * All service modules import `brevoClient` from here.
 */

import { BrevoClient } from "@getbrevo/brevo";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// Lazy singleton — created only when first accessed (server-side only)
let _client: BrevoClient | null = null;

export function getBrevoClient(): BrevoClient {
  if (!_client) {
    _client = new BrevoClient({ apiKey: requireEnv("BREVO_API_KEY") });
  }
  return _client;
}
