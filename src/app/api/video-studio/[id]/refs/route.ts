/**
 * POST /api/video-studio/[id]/refs
 *
 * Saves reference image URLs for character consistency (Director Mode).
 * Called after the user uploads images via the UploadThing videoStudioRef key.
 *
 * Body: { imageUrls: string[] }
 * Returns: { characterRefs: string[] }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ─── Face validation ──────────────────────────────────────────────────────────

/**
 * Uses Claude Vision to check whether a clear, forward-facing face is visible
 * in the supplied image. Returns true only if at least one face is clearly
 * visible — silhouettes, back-of-head shots, or masked images return false.
 *
 * Non-blocking on failure: if Claude Vision is unavailable, we pass through
 * rather than blocking the artist.
 */
async function imageHasClearFace(imageUrl: string): Promise<boolean> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{
        role:    "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: `Is there a clearly visible human face in this image — meaning the face is facing the camera (or at most a 45° angle), not obscured, not a silhouette, and recognizable enough for an AI to reproduce the person's likeness?

Reply with ONLY valid JSON: {"hasFace": true} or {"hasFace": false}`,
          },
        ],
      }],
    });

    const text    = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned) as { hasFace: boolean };
    return parsed.hasFace === true;
  } catch (err) {
    // Vision check failed — pass through rather than blocking the upload
    console.warn("[refs] Face detection failed — passing through:", err);
    return true;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }       = await params;
    const { imageUrls } = await req.json() as { imageUrls: string[] };
    const session      = await auth();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "imageUrls array required" }, { status: 400 });
    }

    // ── Face validation — reject silhouettes / back-of-head photos ───────────
    // Check the first new image; if none have a face, reject before spending
    // any generation credits.
    const faceCheckUrl = imageUrls[0];
    const hasFace = await imageHasClearFace(faceCheckUrl);
    if (!hasFace) {
      return NextResponse.json(
        { error: "Please upload a photo where your face is clearly visible and facing the camera. Silhouettes, back-of-head, or masked photos won't work for character consistency." },
        { status: 400 },
      );
    }

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, userId: true, characterRefs: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check (guests can update their own videos too)
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Merge with existing refs, deduplicate, cap at 5
    const existing = (video.characterRefs as string[] | null) ?? [];
    const merged   = Array.from(new Set([...existing, ...imageUrls])).slice(0, 5);

    await db.musicVideo.update({
      where: { id },
      data:  { characterRefs: merged },
    });

    return NextResponse.json({ characterRefs: merged });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
