import { PrismaClient } from "@prisma/client";

// Singleton — reuse the same client across hot reloads in dev
// and across module evaluations in production serverless environments
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Increase connection pool — Supabase pgbouncer defaults to 1 which causes
// timeouts when Next.js fires multiple concurrent requests during dev/SSR
const dbUrl = (process.env.DATABASE_URL ?? "").replace(
  /connection_limit=\d+/,
  "connection_limit=10"
);

export const db = globalThis.prisma ?? new PrismaClient({
  datasources: { db: { url: dbUrl || undefined } },
});

globalThis.prisma = db;
