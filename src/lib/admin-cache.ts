// Module-level in-memory cache for admin AI features.
// Survives across requests for the lifetime of the Node.js process.

type CacheEntry<T> = { data: T; ts: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: Record<string, CacheEntry<any>> = {};

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    delete store[key];
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T): void {
  store[key] = { data, ts: Date.now() };
}

export const TTL_24H = 24 * 60 * 60 * 1000;
export const TTL_7D  = 7  * 24 * 60 * 60 * 1000;
