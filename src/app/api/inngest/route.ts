/**
 * GET/POST/PUT /api/inngest
 *
 * Inngest serve endpoint — kept for registration introspection only.
 * The active video pipeline no longer uses Inngest; all generation is
 * driven by fal.ai webhooks (/api/video-studio/webhook/keyframe + /webhook/fal).
 *
 * Requires env vars: INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
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
