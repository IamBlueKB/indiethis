/**
 * GET/POST/PUT /api/inngest
 *
 * Inngest serve endpoint — registers all pipeline functions with the Inngest platform.
 * Inngest calls this route to invoke step functions and deliver event payloads.
 *
 * Requires env vars: INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
 * (Install via Vercel Marketplace for automatic setup, or set manually.)
 *
 * maxDuration: 300 — the remotion-render step in stitch-video polls AWS Lambda
 * for up to ~5 minutes on long tracks. Each step.run gets a fresh invocation budget.
 */

import { serve }   from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  videoOrchestrator,
  generateKeyframe,
  keyframesComplete,
  scenesApproved,
  generateScene,
  stitchVideo,
} from "@/inngest/functions/video-pipeline";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    videoOrchestrator,
    generateKeyframe,
    keyframesComplete,
    scenesApproved,
    generateScene,
    stitchVideo,
  ],
});
