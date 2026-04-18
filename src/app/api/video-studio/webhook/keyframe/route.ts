/**
 * POST /api/video-studio/webhook/keyframe
 *
 * Receives FLUX Kontext Pro keyframe completion callbacks from fal.ai.
 * Called once per scene when its keyframe image is ready.
 *
 * Flow per callback:
 *   1. Look up FalKeyframeJob by request_id
 *   2. Re-upload image to UploadThing (fal.ai URLs expire)
 *   3. Save keyframeUrl on shotList[sceneIndex]
 *   4. When all keyframes for this video are done:
 *        - Director Mode → set status STORYBOARD
 *        - Quick/Canvas  → call startSceneGeneration() (submit Kling jobs)
 *
 * maxDuration: 60 — re-upload + DB writes only; no long-running work.
 */

import { NextRequest, NextResponse }          from "next/server";
import { db }                                 from "@/lib/db";
import { UTApi }                              from "uploadthing/server";
import { startSceneGeneration }               from "@/lib/video-studio/pipeline";
import { fal }                                from "@fal-ai/client";

const utapi = new UTApi();

// ─── Keyframe QA ──────────────────────────────────────────────────────────────

interface KeyframeQAResult {
  pass:            boolean;
  fullBody:        boolean;
  faceVisible:     boolean;
  framing:         "wide" | "medium" | "close";
  suggestedPrompt: string | null;
}

/**
 * Runs Claude Vision on a generated keyframe.
 * Returns pass=true only if the frame shows a visible face AND appropriate framing.
 * On error, returns pass=true so a Vision outage never blocks generation.
 */
async function validateKeyframe(
  keyframeUrl: string,
  scenePrompt: string,
): Promise<KeyframeQAResult> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{
        role:    "user",
        content: [
          { type: "image", source: { type: "url", url: keyframeUrl } },
          {
            type: "text",
            text: `You are evaluating a keyframe image for a music video scene.

Original scene prompt: "${scenePrompt.slice(0, 300)}"

Answer these questions about the image:
1. Is a human face clearly visible and not obscured? (face_visible: true/false)
2. Does the image show the full body from head to toe? (full_body: true/false)
3. What is the framing? wide = full body visible, medium = waist up, close = face/shoulders only

Pass criteria: face_visible must be true. If the prompt requests a full body shot, full_body must also be true.

If pass is false, provide a brief revised prompt addition to fix the issue (e.g. "full body shot, complete figure head to toe, face clearly visible, wide angle").

Return ONLY valid JSON:
{
  "pass": boolean,
  "full_body": boolean,
  "face_visible": boolean,
  "framing": "wide" | "medium" | "close",
  "suggested_prompt": string | null
}`,
          },
        ],
      }],
    });

    const text    = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned);

    return {
      pass:            parsed.pass           === true,
      fullBody:        parsed.full_body      === true,
      faceVisible:     parsed.face_visible   === true,
      framing:         parsed.framing        ?? "medium",
      suggestedPrompt: parsed.suggested_prompt ?? null,
    };
  } catch (err) {
    console.warn("[keyframe webhook] QA check failed — passing through:", err);
    // Non-blocking: pass on error so Vision outages never stall generation
    return { pass: true, fullBody: true, faceVisible: true, framing: "wide", suggestedPrompt: null };
  }
}

/**
 * Re-generates a FLUX Kontext Pro keyframe synchronously with an improved prompt.
 * Uses fal.run() (blocking) — suitable for in-webhook retries up to ~20s per attempt.
 */
async function regenerateKeyframe(
  artistImageUrl: string,
  prompt:         string,
): Promise<string | null> {
  try {
    fal.config({ credentials: process.env.FAL_KEY! });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal as any).run("fal-ai/flux-pro/kontext", {
      input: {
        prompt,
        image_url:    artistImageUrl,
      },
    });

    const url = result?.images?.[0]?.url ?? result?.image?.url ?? null;
    return url ?? null;
  } catch (err) {
    console.error("[keyframe webhook] Keyframe regeneration failed:", err);
    return null;
  }
}

/** Re-uploads a fal.ai image URL to permanent UploadThing storage. */
async function reuploadImageUrl(falUrl: string, filename: string): Promise<string> {
  try {
    const res    = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const file   = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
    const upload = await utapi.uploadFiles(file);
    const url    = upload.data?.ufsUrl ?? upload.data?.url;
    if (!url) throw new Error("No URL returned from UploadThing");
    console.log(`[keyframe webhook] Uploaded ${filename} → ${url.slice(0, 60)}…`);
    return url;
  } catch (err) {
    console.warn(`[keyframe webhook] Re-upload failed for ${filename} — keeping fal.ai URL:`, err);
    return falUrl;
  }
}

// Increased to 120s — QA checks + up to 2 FLUX retries can take ~60s total
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body                       = await req.json() as Record<string, any>;
    const { request_id, status, payload } = body;

    if (!request_id) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    // ── 1. Look up the keyframe job ──────────────────────────────────────────
    const job = await db.falKeyframeJob.findUnique({ where: { requestId: request_id } });
    if (!job) {
      console.warn(`[keyframe webhook] No FalKeyframeJob for request_id: ${request_id}`);
      return NextResponse.json({ received: true });
    }

    const { musicVideoId, sceneIndex, totalScenes } = job;

    // Guard: skip if video is already complete or failed
    const videoCheck = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { status: true },
    });
    if (!videoCheck || videoCheck.status === "COMPLETE" || videoCheck.status === "FAILED") {
      return NextResponse.json({ received: true });
    }

    // ── 2. Handle result ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falImageUrl: string = payload?.images?.[0]?.url ?? (payload as any)?.image?.url ?? "";

    if (status === "OK" && falImageUrl) {
      const filename     = `keyframe-${musicVideoId}-scene${sceneIndex}-${Date.now()}.png`;
      let permanentUrl   = await reuploadImageUrl(falImageUrl, filename);

      // ── QA: Claude Vision keyframe check + FLUX auto-retry ─────────────────
      const video0 = await db.musicVideo.findUnique({
        where:  { id: musicVideoId },
        select: { shotList: true, referenceImageUrl: true, thumbnailUrl: true },
      });
      const shotList0   = (video0?.shotList as Record<string, unknown>[]) ?? [];
      const scenePrompt = (shotList0[sceneIndex]?.prompt as string) ?? "";
      const artistRef   = (video0?.referenceImageUrl ?? video0?.thumbnailUrl) ?? "";

      const MAX_QA_RETRIES = 2;
      let qaAttempt = 0;
      let qaPassed  = false;

      while (qaAttempt <= MAX_QA_RETRIES) {
        const qa = await validateKeyframe(permanentUrl, scenePrompt);
        if (qa.pass) { qaPassed = true; break; }

        qaAttempt++;
        if (qaAttempt > MAX_QA_RETRIES) {
          console.warn(`[keyframe webhook] QA failed after ${MAX_QA_RETRIES} retries for scene ${sceneIndex} — using best result`);
          qaPassed = true; // Use what we have rather than blocking generation
          break;
        }

        console.log(`[keyframe webhook] QA failed (attempt ${qaAttempt}) — regenerating scene ${sceneIndex}. Issue: face=${qa.faceVisible} fullBody=${qa.fullBody}`);

        // Build improved prompt
        const fixSuffix = qa.suggestedPrompt
          ?? "full body shot head to toe, face clearly visible facing camera, wide angle framing, complete figure";
        const improvedPrompt =
          `Full body shot of this person: ${scenePrompt.slice(0, 400)}. ` +
          `Show the complete figure from head to toe. ${fixSuffix}. ` +
          `Maintain exact facial features, clothing and appearance from reference photo.`;

        if (!artistRef) break; // Can't retry without reference image

        const retryUrl = await regenerateKeyframe(artistRef, improvedPrompt);
        if (!retryUrl) break;

        const retryFilename = `keyframe-${musicVideoId}-scene${sceneIndex}-retry${qaAttempt}-${Date.now()}.png`;
        permanentUrl = await reuploadImageUrl(retryUrl, retryFilename);
      }

      console.log(`[keyframe webhook] Scene ${sceneIndex} QA ${qaPassed ? "passed" : "forced-pass after retries"}`);
      // ── End QA block ────────────────────────────────────────────────────────

      await db.falKeyframeJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETE", imageUrl: permanentUrl },
      });

      // Persist keyframeUrl on shotList entry
      const video = await db.musicVideo.findUnique({
        where:  { id: musicVideoId },
        select: { shotList: true, progress: true },
      });
      if (video) {
        const shotList: Record<string, unknown>[] =
          (video.shotList as Record<string, unknown>[]) ?? [];
        while (shotList.length <= sceneIndex) shotList.push({});
        shotList[sceneIndex] = { ...shotList[sceneIndex], keyframeUrl: permanentUrl };

        const progress = 10 + Math.round(((sceneIndex + 1) / totalScenes) * 30);
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data:  {
            shotList: shotList as object[],
            progress,
            currentStep: `Keyframe ${sceneIndex + 1}/${totalScenes} ready…`,
          },
        });
        console.log(`[keyframe webhook] Scene ${sceneIndex + 1}/${totalScenes} keyframe saved for ${musicVideoId}`);
      }
    } else {
      await db.falKeyframeJob.update({
        where: { id: job.id },
        data:  { status: "FAILED" },
      });
      console.error(`[keyframe webhook] Scene ${sceneIndex} keyframe failed for ${musicVideoId} — fal status: ${status}`);
    }

    // ── 3. Check if all keyframes for this video are done ────────────────────
    const allJobs = await db.falKeyframeJob.findMany({
      where:   { musicVideoId },
      orderBy: { sceneIndex: "asc" },
    });

    const doneCount = allJobs.filter(j => j.status === "COMPLETE" || j.status === "FAILED").length;
    if (doneCount < totalScenes) {
      return NextResponse.json({ received: true });
    }

    const successCount = allJobs.filter(j => j.status === "COMPLETE").length;
    if (successCount === 0) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Keyframe generation failed",
          errorMessage: "All keyframes failed to generate",
        },
      });
      console.error(`[keyframe webhook] All keyframes failed for ${musicVideoId}`);
      return NextResponse.json({ received: true });
    }

    // ── 4. All keyframes done — route based on mode ──────────────────────────
    const video = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { mode: true },
    });
    if (!video) return NextResponse.json({ received: true });

    if (video.mode === "DIRECTOR") {
      // Director Mode: show storyboard for user review before starting Kling
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:      "STORYBOARD",
          progress:    40,
          currentStep: "Review your storyboard — approve or regenerate scenes…",
        },
      });
      console.log(`[keyframe webhook] Director Mode — storyboard ready for ${musicVideoId}`);
    } else {
      // Quick/Canvas Mode: automatically start Kling scene generation
      console.log(`[keyframe webhook] Quick/Canvas Mode — starting scene generation for ${musicVideoId}`);
      await startSceneGeneration(musicVideoId);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[keyframe webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
