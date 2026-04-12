/**
 * POST /api/video-studio/generate-ref-image
 *
 * Generates a reference image from a text prompt using Seedream V4.
 * Used by the Image Source wizard step (AI Generated option).
 *
 * Body:   { prompt: string }
 * Returns: { imageUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import * as fal                      from "@fal-ai/serverless-client";

export const maxDuration = 60;

const MODEL = "fal-ai/bytedance/seedream/v4/text-to-image";

export async function POST(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "Image generation not available" }, { status: 503 });
    }
    fal.config({ credentials: falKey });

    const body   = await req.json() as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt || prompt.length < 3) {
      return NextResponse.json({ error: "Prompt is required (min 3 chars)" }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: "Prompt too long (max 500 chars)" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe(MODEL as any, {
      input: {
        prompt,
        aspect_ratio:    "1:1",
        guidance_scale:   7.5,
        num_images:       1,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output   = (result as any).data ?? result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageUrl = (output as any)?.images?.[0]?.url ?? (output as any)?.image?.url ?? "";

    if (!imageUrl) {
      return NextResponse.json({ error: "Image generation failed — no URL returned" }, { status: 500 });
    }

    return NextResponse.json({ imageUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-ref-image]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
