import { PrismaClient } from "@prisma/client";

// Singleton — reuse the same client across hot reloads in dev
// and across module evaluations in production serverless environments
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma ?? new PrismaClient();

globalThis.prisma = db;
