# IndieThis — Video Studio Inngest Migration Spec
_For Sonnet — Search codebase before coding_

---

## CONTEXT

The video generation pipeline fails because all steps run inside a single Vercel function with a 300s timeout. FLUX keyframe generation alone can take 360s+ for 7 scenes. The function dies mid-execution, producing empty keyframes or partial results.

Inngest solves this by making each step an independent function. No single call ever times out. Each step completes on its own, saves its result, and triggers the next step. If step 3 fails, Inngest retries only step 3.

---

## WHAT NOT TO DO

- Do NOT run multiple FLUX calls inside one Vercel function
- Do NOT use `fal.queue.submit` for FLUX — use `fal.subscribe` with timeout per call
- Do NOT use `fal-ai/kling-video/v3/pro/text-to-video` with `elements` or `@Element1`
- Do NOT make changes not listed in this spec

---

## STEP 1 — Install Inngest

```bash
npm install inngest
```

Follow the Inngest Next.js guide: https://www.inngest.com/docs/getting-started/nextjs

Create:
- `src/inngest/client.ts` — Inngest client instance
- `src/inngest/functions/video-pipeline.ts` — all pipeline step functions
- `src/app/api/inngest/route.ts` — Inngest serve endpoint

Register on Vercel Marketplace or set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` env vars.

---

## STEP 2 — Define Pipeline Events

Each event triggers the next step. The pipeline is a chain:

```
video/generate.requested
  → video/keyframe.generate (per scene, parallel)
    → video/keyframes.complete (when all done)
      → video/scene.generate (per scene, parallel — Kling i2v)
        → video/scenes.complete (when all done)
          → video/stitch.requested (Remotion assembly)
            → video/complete
```

---

## STEP 3 — Pipeline Functions

### 3.1 — Orchestrator: `video/generate.requested`

Triggered when user clicks generate (after payment cleared).

**Input:** `{ videoId, scenes: shotList[], artistImageUrl }`

**What it does:**
1. Update MusicVideo status to GENERATING
2. For each scene in shotList, send event `video/keyframe.generate` with scene data
3. Return immediately — function completes in <1s

```typescript
inngest.createFunction(
  { id: "video-orchestrator" },
  { event: "video/generate.requested" },
  async ({ event, step }) => {
    const { videoId, scenes, artistImageUrl } = event.data;

    // Update status
    await step.run("set-status", async () => {
      await db.musicVideo.update({
        where: { id: videoId },
        data: { status: "GENERATING" }
      });
    });

    // Fan out keyframe generation — one event per scene
    await step.sendEvent("fan-out-keyframes",
      scenes.map((scene, index) => ({
        name: "video/keyframe.generate",
        data: {
          videoId,
          sceneIndex: index,
          totalScenes: scenes.length,
          artistImageUrl,
          description: scene.description,
          cameraDirection: scene.cameraDirection,
          filmLook: scene.filmLook,
          duration: scene.duration
        }
      }))
    );
  }
);
```

### 3.2 — Keyframe Generation: `video/keyframe.generate`

One function per scene. Runs independently. Max 120s.

**What it does:**
1. Call FLUX Kontext Pro (`fal-ai/flux-pro/kontext`) with `fal.subscribe`
2. Extract `result.data.images[0].url`
3. Upload to UploadThing (permanent URL)
4. Store `keyframeUrl` on shotList JSON in DB
5. Check if all keyframes for this video are done — if yes, send `video/keyframes.complete`

```typescript
inngest.createFunction(
  { id: "generate-keyframe", concurrency: { limit: 3 } },
  { event: "video/keyframe.generate" },
  async ({ event, step }) => {
    const { videoId, sceneIndex, totalScenes, artistImageUrl,
            description, cameraDirection, filmLook } = event.data;

    // Generate keyframe
    const keyframeUrl = await step.run("flux-generate", async () => {
      const prompt = `Place this person in the following scene: ${description}. ${cameraDirection}. ${filmLook}. Maintain the person's exact facial features, clothing, and appearance from the reference photo.`;

      const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
        input: {
          prompt,
          image_url: artistImageUrl
        },
        timeout: 120000
      });

      return result.data.images[0].url;
    });

    // Upload to permanent storage
    const permanentUrl = await step.run("upload-keyframe", async () => {
      // Re-upload fal.ai temporary URL to UploadThing
      // Follow existing pattern from webhook re-upload code
      return await reuploadToUploadThing(keyframeUrl, `keyframe-${videoId}-${sceneIndex}`);
    });

    // Store on shotList
    await step.run("save-keyframe", async () => {
      const video = await db.musicVideo.findUnique({ where: { id: videoId } });
      const shotList = video.shotList as any[];
      shotList[sceneIndex].keyframeUrl = permanentUrl;
      await db.musicVideo.update({
        where: { id: videoId },
        data: { shotList }
      });
    });

    // Check if all keyframes done
    await step.run("check-complete", async () => {
      const video = await db.musicVideo.findUnique({ where: { id: videoId } });
      const shotList = video.shotList as any[];
      const allDone = shotList.every(s => s.keyframeUrl);

      if (allDone) {
        await inngest.send({
          name: "video/keyframes.complete",
          data: { videoId }
        });
      }
    });
  }
);
```

### 3.3 — Keyframes Complete: `video/keyframes.complete`

**For Director Mode:** Update status to AWAITING_APPROVAL. Wait for user to approve storyboard before proceeding.

**For Quick Mode / Canvas:** Skip approval, immediately fan out Kling i2v calls.

```typescript
inngest.createFunction(
  { id: "keyframes-complete" },
  { event: "video/keyframes.complete" },
  async ({ event, step }) => {
    const { videoId } = event.data;

    const video = await step.run("get-video", async () => {
      return await db.musicVideo.findUnique({ where: { id: videoId } });
    });

    if (video.mode === "DIRECTOR") {
      // Wait for approval — status change triggers next step
      await step.run("set-awaiting-approval", async () => {
        await db.musicVideo.update({
          where: { id: videoId },
          data: { status: "AWAITING_APPROVAL" }
        });
      });
    } else {
      // Quick Mode / Canvas — go straight to video generation
      await step.sendEvent("start-video-gen", {
        name: "video/scenes.approved",
        data: { videoId }
      });
    }
  }
);
```

### 3.4 — Storyboard Approved: `video/scenes.approved`

Triggered by approval UI (Director Mode) or automatically (Quick/Canvas).

**What it does:** Fan out Kling i2v calls — one per scene.

```typescript
inngest.createFunction(
  { id: "scenes-approved" },
  { event: "video/scenes.approved" },
  async ({ event, step }) => {
    const { videoId } = event.data;

    const video = await step.run("get-video", async () => {
      return await db.musicVideo.findUnique({ where: { id: videoId } });
    });

    const shotList = video.shotList as any[];

    // Delete stale FalSceneJobs before starting
    await step.run("cleanup-stale-jobs", async () => {
      await db.falSceneJob.deleteMany({ where: { musicVideoId: videoId } });
    });

    // Fan out Kling i2v — one event per scene
    await step.sendEvent("fan-out-scenes",
      shotList.map((scene, index) => ({
        name: "video/scene.generate",
        data: {
          videoId,
          sceneIndex: index,
          totalScenes: shotList.length,
          keyframeUrl: scene.keyframeUrl,
          description: scene.description,
          cameraDirection: scene.cameraDirection,
          filmLook: scene.filmLook,
          duration: String(Math.min(scene.duration, 15))
        }
      }))
    );
  }
);
```

### 3.5 — Scene Video Generation: `video/scene.generate`

One function per scene. Uses `fal.queue.submit` with webhook (existing pattern).

```typescript
inngest.createFunction(
  { id: "generate-scene", concurrency: { limit: 3 } },
  { event: "video/scene.generate" },
  async ({ event, step }) => {
    const { videoId, sceneIndex, totalScenes, keyframeUrl,
            description, cameraDirection, filmLook, duration } = event.data;

    await step.run("submit-kling", async () => {
      const prompt = `${description}. ${cameraDirection}. ${filmLook}`;

      // Create FalSceneJob record
      const sceneJob = await db.falSceneJob.create({
        data: {
          musicVideoId: videoId,
          sceneIndex,
          status: "PENDING",
          prompt
        }
      });

      // Submit to Kling i2v with webhook
      await fal.queue.submit("fal-ai/kling-video/v3/pro/image-to-video", {
        input: {
          prompt,
          start_image_url: keyframeUrl,  // FLUX keyframe, NOT original photo
          duration,
          generate_audio: false
        },
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/video-studio/webhook?jobId=${sceneJob.id}&videoId=${videoId}&sceneIndex=${sceneIndex}&totalScenes=${totalScenes}`
      });

      // Update job status
      await db.falSceneJob.update({
        where: { id: sceneJob.id },
        data: { status: "SUBMITTED" }
      });
    });
  }
);
```

### 3.6 — Webhook Handler (existing, modify)

The existing webhook at `/api/video-studio/webhook` receives completed Kling clips. Modify it to:

1. Re-upload clip to UploadThing (permanent URL) — already done per commit `b7d5f5e9`
2. Update FalSceneJob with video URL
3. Check if all scenes for this video are done
4. If all done, send Inngest event `video/stitch.requested`

```typescript
// In existing webhook handler, after all scenes complete:
await inngest.send({
  name: "video/stitch.requested",
  data: { videoId }
});
```

### 3.7 — Remotion Assembly: `video/stitch.requested`

```typescript
inngest.createFunction(
  { id: "stitch-video" },
  { event: "video/stitch.requested" },
  async ({ event, step }) => {
    const { videoId } = event.data;

    const finalUrl = await step.run("remotion-render", async () => {
      const video = await db.musicVideo.findUnique({
        where: { id: videoId },
        include: { falSceneJobs: true }
      });

      // Collect clip URLs in order
      const clips = video.falSceneJobs
        .sort((a, b) => a.sceneIndex - b.sceneIndex)
        .map(j => j.videoUrl);

      // Call Remotion Lambda — existing stitchWithRemotion function
      return await stitchWithRemotion(clips, video.audioUrl, video.aspectRatio);
    });

    // Save final video
    await step.run("save-final", async () => {
      await db.musicVideo.update({
        where: { id: videoId },
        data: {
          finalVideoUrl: finalUrl,
          status: "COMPLETE"
        }
      });
    });
  }
);
```

---

## STEP 4 — Keyframe Regeneration (Director Mode Approval)

When artist clicks regenerate on a keyframe in the storyboard view:

```typescript
// API route: POST /api/video-studio/[id]/regenerate-keyframe
// Body: { sceneIndex: number }

// 1. Check redoCount < 3
// 2. Send Inngest event:
await inngest.send({
  name: "video/keyframe.generate",
  data: {
    videoId,
    sceneIndex,
    totalScenes,
    artistImageUrl,
    description: shotList[sceneIndex].description,
    cameraDirection: shotList[sceneIndex].cameraDirection,
    filmLook: shotList[sceneIndex].filmLook,
    duration: shotList[sceneIndex].duration
  }
});

// 3. Increment redoCount on shotList[sceneIndex]
```

When artist clicks "Accept All":
```typescript
await inngest.send({
  name: "video/scenes.approved",
  data: { videoId }
});
```

---

## STEP 5 — Trigger Points

### Where the pipeline starts:

**Director Mode:** After user approves shot list in Director chat → fire `video/generate.requested`

**Quick Mode:** After Stripe payment confirms → auto-generate shot list → fire `video/generate.requested`

**Canvas:** After Stripe payment confirms → single scene from style selection → fire `video/generate.requested`

### The generate route (`/api/video-studio/[id]/generate`):

Replace the existing synchronous pipeline with a single Inngest event:

```typescript
await inngest.send({
  name: "video/generate.requested",
  data: {
    videoId,
    scenes: shotList,
    artistImageUrl
  }
});

// Return immediately — 200 OK
return NextResponse.json({ status: "GENERATING" });
```

This is the key change. The generate route returns in <1s instead of blocking for 300s+.

---

## STEP 6 — Environment Variables

Add to Vercel:
- `INNGEST_EVENT_KEY` — from Inngest dashboard
- `INNGEST_SIGNING_KEY` — from Inngest dashboard

Or install via Vercel Marketplace for automatic setup.

---

## STEP 7 — Status Polling

The existing status endpoint (`/api/video-studio/[id]/status`) already polls MusicVideo status. No changes needed — it will reflect the status updates from each Inngest step:

- `GENERATING` — pipeline started
- `AWAITING_APPROVAL` — keyframes ready for review (Director only)
- `RENDERING` — Kling clips generating
- `STITCHING` — Remotion assembling
- `COMPLETE` — done
- `FAILED` — error (check `errorMessage`)

---

## STEP 8 — Error Handling

Inngest handles retries automatically. Configure per function:

```typescript
inngest.createFunction(
  {
    id: "generate-keyframe",
    concurrency: { limit: 3 },
    retries: 2  // retry failed keyframes up to 2 times
  },
  ...
);
```

If a step permanently fails after retries, update MusicVideo status to FAILED with the error message:

```typescript
onFailure: async ({ error, event }) => {
  await db.musicVideo.update({
    where: { id: event.data.videoId },
    data: {
      status: "FAILED",
      errorMessage: error.message
    }
  });
}
```

---

## STEP 9 — Remove Old Synchronous Code

After Inngest pipeline is working:

1. Remove the synchronous `generateAllKeyframes` call from the generate route
2. Remove the synchronous `generateAllScenes` call from the generate route
3. Remove `Promise.race` timeout wrappers on FLUX calls
4. Keep `generateSceneKeyframe` and `generateSceneClip` as utility functions — they're called from within Inngest steps now

---

## IMPLEMENTATION ORDER

1. Install Inngest, create client, create serve route, verify connection
2. Build the orchestrator function (`video/generate.requested`)
3. Build keyframe generation function (`video/keyframe.generate`)
4. Build keyframes complete function (`video/keyframes.complete`)
5. Test: trigger a video and confirm all keyframes generate without timeout
6. Build scenes approved function (`video/scenes.approved`)
7. Build scene generation function (`video/scene.generate`)
8. Modify webhook to send `video/stitch.requested` when all scenes done
9. Build stitch function (`video/stitch.requested`)
10. Test full pipeline end to end with Razor's Edge
11. Build keyframe regeneration endpoint for Director Mode approval
12. Remove old synchronous pipeline code

---

## VERIFICATION

1. Does the generate route return immediately (<1s)?
2. Do all keyframes generate without Vercel timeout?
3. Does a 7-scene video complete all keyframes?
4. Does a 10-scene video complete all keyframes?
5. Does each keyframe show the artist in a different scene (not the same photo)?
6. Does Director Mode show storyboard for approval after keyframes complete?
7. Does regeneration work and respect 3-redo limit?
8. Does Accept All trigger Kling i2v for all scenes?
9. Does each Kling call use the keyframe URL (not original photo)?
10. Does `generate_audio` stay `false` on all Kling calls?
11. Do all clips get re-uploaded to permanent URLs before Remotion?
12. Does Remotion produce a final video with all scenes + audio?
13. Does the status endpoint reflect each stage accurately?
14. Does a failed step retry automatically?
15. Does a permanently failed step set status to FAILED with error message?
