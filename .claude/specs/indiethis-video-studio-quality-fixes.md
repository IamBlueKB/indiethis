# IndieThis — Video Studio Quality Fixes
_For Sonnet — Implement in order listed. Search codebase before coding._

---

## CONTEXT

The video pipeline works end to end. These fixes address quality issues in the output: bad reference photos, torso-only keyframes, inconsistent resolution, and stuck renders. Implement in the order listed — each fix builds on the previous.

---

## WHAT NOT TO DO

- Do NOT use GPT-4V or OpenAI for any QA checks — use Claude Vision (Anthropic SDK already in the stack)
- Do NOT touch the webhook pipeline (FLUX → Kling → Remotion) — it works
- Do NOT touch `generate_audio: false` on Kling calls
- Do NOT touch `framesPerLambda: 200` on Remotion renders
- Do NOT add new API keys or dependencies unless explicitly stated

---

## FIX 1 — Face Detection on Artist Photo Upload

**Problem:** Artist uploads a photo without a clear face. FLUX generates a keyframe with a made-up face. Every scene has a different person.

**When:** Before storing the artist photo URL. Reject bad uploads before any money is spent.

**How:**

```typescript
// In your upload handler (wherever artistPhotoUrl is saved)

async function validateFaceVisible(imageUrl: string): Promise<{ hasFace: boolean; confidence: number }> {
  try {
    const result = await fal.run("fal-ai/image-utils/face-detection", {
      input: { image_url: imageUrl }
    });

    const faces = result.faces || [];
    const bestFace = faces[0]?.confidence || 0;

    return {
      hasFace: faces.length > 0 && bestFace > 0.7,
      confidence: bestFace
    };
  } catch (error) {
    console.error("Face detection failed:", error);
    return { hasFace: false, confidence: 0 };
  }
}

// Usage:
const { hasFace, confidence } = await validateFaceVisible(uploadedImageUrl);
if (!hasFace) {
  return Response.json(
    { error: "Please upload a photo where your face is clearly visible and facing the camera." },
    { status: 400 }
  );
}
```

**Cost:** ~$0.002 per check. Negligible.

---

## FIX 2 — Resolution Normalization on Kling Clips

**Problem:** Kling clips sometimes return at different resolutions. When Remotion stitches them, you get jump cuts and resolution shifts between scenes.

**When:** In the video webhook handler, after receiving a completed Kling clip, before saving the URL for stitching.

**How:**

```typescript
// Add to app/api/video-studio/webhook/video/route.ts (or equivalent)

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;

async function getVideoDimensions(videoUrl: string): Promise<{ width: number; height: number }> {
  const result = await fal.run("fal-ai/ffprobe", {
    input: { video_url: videoUrl }
  });
  return {
    width: result.streams[0].width,
    height: result.streams[0].height
  };
}

async function rescaleVideo(videoUrl: string, targetWidth: number, targetHeight: number): Promise<string> {
  const result = await fal.queue.submit("fal-ai/ffmpeg", {
    input: {
      video_url: videoUrl,
      operation: "scale",
      width: targetWidth,
      height: targetHeight,
      keep_aspect: "crop",
      format: "mp4"
    }
  });
  const final = await result.wait();
  return final.output.video_url;
}

// In the webhook, after receiving a completed clip:
let finalClipUrl = output.video.url;

const { width, height } = await getVideoDimensions(finalClipUrl);
if (width !== TARGET_WIDTH || height !== TARGET_HEIGHT) {
  finalClipUrl = await rescaleVideo(finalClipUrl, TARGET_WIDTH, TARGET_HEIGHT);
}

// Save finalClipUrl (not the original) to DB for stitching
```

**Cost:** ~$0.01-0.02 per clip if rescaling needed. Most clips will match and skip the call.

---

## FIX 3 — Keyframe QA with Claude Vision

**Problem:** FLUX generates torso-only shots, blurred faces, or scenes that don't match the prompt. These bad keyframes go straight to Kling and waste video generation credits.

**When:** In the keyframe webhook handler, after FLUX returns an image, before submitting to Kling.

**Existing pattern:** `qaReviewScene()` already exists in the codebase using Claude Vision. Follow the same pattern.

**How:**

```typescript
// Add to app/api/video-studio/webhook/keyframe/route.ts (or equivalent)

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // uses ANTHROPIC_API_KEY from env

async function validateKeyframe(
  keyframeUrl: string,
  scenePrompt: string
): Promise<{
  pass: boolean;
  fullBody: boolean;
  faceVisible: boolean;
  framing: string;
  suggestedPrompt?: string;
}> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are evaluating a generated keyframe image for a music video scene.

Original prompt: "${scenePrompt}"

Answer these questions:
1. Does the image show the person's full body (head to toe)? (full_body: true/false)
2. Is the person's face clearly visible (not blurred, turned away, or obscured)? (face_visible: true/false)
3. What is the framing? (wide = full body, medium = waist up, close = shoulders/face only)
4. Should this keyframe be accepted? (pass: true only if face_visible is true AND framing matches what the prompt asks for)

If pass is false, provide a revised prompt that would fix the issue. Add specifics like "full body shot, face clearly visible, straight-on angle" to the original prompt.

Return valid JSON only:
{
  "full_body": boolean,
  "face_visible": boolean,
  "framing": "wide" | "medium" | "close",
  "pass": boolean,
  "suggested_prompt": string or null
}`
          },
          {
            type: "image",
            source: {
              type: "url",
              url: keyframeUrl
            }
          }
        ]
      }
    ]
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
```

**Auto-retry logic (add to keyframe webhook):**

```typescript
// After FLUX returns a keyframeUrl, before submitting to Kling:

const MAX_QA_RETRIES = 2;
let currentAttempt = 0;
let finalKeyframeUrl = keyframeUrl;
let passed = false;
let currentPrompt = scenePrompt;

while (currentAttempt <= MAX_QA_RETRIES && !passed) {
  const qa = await validateKeyframe(finalKeyframeUrl, currentPrompt);

  if (qa.pass) {
    passed = true;
    break;
  }

  currentAttempt++;
  if (currentAttempt > MAX_QA_RETRIES) {
    // Mark scene as failed after all retries exhausted
    await prisma.keyframeJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: "Keyframe QA failed after retries" }
    });
    return Response.json({ ok: false, error: "Keyframe quality check failed" });
  }

  // Regenerate with suggested prompt
  const retryPrompt = qa.suggestedPrompt || currentPrompt + " (full body shot, face clearly visible, straight-on angle)";
  currentPrompt = retryPrompt;

  const retryResult = await fal.subscribe("fal-ai/flux-pro/kontext", {
    input: {
      prompt: retryPrompt,
      image_url: artistPhotoUrl,
      aspect_ratio: "16:9"
    },
    timeout: 120000
  });

  finalKeyframeUrl = retryResult.data.images[0].url;
}

// If passed, proceed to submit Kling job with finalKeyframeUrl
```

**Cost:** ~$0.01-0.02 per QA check (Claude Sonnet Vision). For an 8-scene video with no retries: ~$0.08-0.16. With retries: ~$0.24-0.48 worst case. Cheap insurance against wasting $1.68+ on a bad Kling clip.

---

## FIX 4 — Stuck Stitch Recovery

**Problem:** Video gets stuck in STITCHING status if the Remotion webhook fails or Lambda times out without updating the DB.

**When:** Cron job running every 30 minutes.

**How:**

```typescript
// Add to your cron routes or master-cron orchestrator

async function recoverStuckStitches() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const stuckSessions = await prisma.videoGenerationSession.findMany({
    where: {
      status: "STITCHING",
      updatedAt: { lt: oneHourAgo }
    },
    include: { videoStudio: true }
  });

  for (const session of stuckSessions) {
    // Check if all clips exist
    const clips = await prisma.videoClipJob.findMany({
      where: { sessionId: session.id, status: "COMPLETED" },
      orderBy: { sceneIndex: "asc" }
    });

    if (clips.length === session.totalScenes) {
      // All clips are there — resubmit stitch
      const clipUrls = clips.map(c => c.resultUrl);
      
      await renderMediaOnLambda({
        // ... same params as original stitch
        inputProps: {
          clips: clipUrls,
          audioUrl: session.videoStudio.audioUrl
        },
        framesPerLambda: 200,
        webhook: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/video-studio/webhook/remotion`,
          secret: process.env.REMOTION_WEBHOOK_SECRET
        }
      });

      console.log(`Resubmitted stitch for session ${session.id}`);
    } else {
      // Missing clips — mark as FAILED
      await prisma.videoGenerationSession.update({
        where: { id: session.id },
        data: {
          status: "FAILED",
          error: `Stitch timeout. Only ${clips.length}/${session.totalScenes} clips completed.`
        }
      });
    }
  }
}
```

**Add to vercel.json cron schedule** or wire into master-cron route.

---

## FIX 5 — Scene Retry on Kling Failure

**Problem:** If a Kling i2v call fails, the scene is marked failed and the whole video stops.

**When:** In the video webhook handler, when receiving a failed status from Kling.

**How:**

```typescript
// In the video webhook, on status === "FAILED":

if (status === "FAILED") {
  const retryCount = clipJob.retryCount || 0;

  if (retryCount < 3) {
    // Resubmit the same keyframe to Kling
    await fal.queue.submit("fal-ai/kling-video/v3/pro/image-to-video", {
      input: {
        start_image_url: clipJob.keyframeUrl,
        prompt: clipJob.prompt,
        duration: clipJob.duration,
        generate_audio: false,
        aspect_ratio: "16:9"
      },
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/video-studio/webhook/video`
    });

    await prisma.videoClipJob.update({
      where: { id: clipJob.id },
      data: { retryCount: retryCount + 1, status: "PENDING" }
    });
  } else {
    // All retries exhausted — mark session as FAILED
    await prisma.videoClipJob.update({
      where: { id: clipJob.id },
      data: { status: "FAILED", error: payload.error }
    });

    await prisma.videoGenerationSession.update({
      where: { id: clipJob.sessionId },
      data: {
        status: "FAILED",
        error: `Scene ${clipJob.sceneIndex} failed after 3 retries`
      }
    });
  }
}
```

---

## IMPLEMENTATION ORDER

1. Face detection on upload — stops bad inputs immediately
2. Resolution normalization — add to video webhook
3. Keyframe QA with Claude Vision — add to keyframe webhook
4. Stuck stitch recovery cron — add to cron schedule
5. Scene retry on Kling failure — add to video webhook

Test after each fix. Do not implement the next fix until the previous one is confirmed working.

---

## COST SUMMARY (per 8-scene video, worst case)

| Fix | Cost |
|-----|------|
| Face detection (1 upload) | $0.002 |
| Resolution normalization (8 clips) | $0.08-0.16 |
| Keyframe QA (8 scenes × up to 3 checks) | $0.24-0.48 |
| Stuck stitch cron | $0 |
| Scene retry (reuses existing Kling calls) | $0 extra |
| **Total added cost** | **~$0.32-0.64** |

On a $69.99 sale, this is less than 1% of revenue. Worth it to prevent bad videos from reaching the artist.
