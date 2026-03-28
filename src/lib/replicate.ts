/**
 * src/lib/replicate.ts
 * Replicate API client singleton.
 * Token is optional at build time — guarded at call sites.
 */

import Replicate from "replicate";

export const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;
