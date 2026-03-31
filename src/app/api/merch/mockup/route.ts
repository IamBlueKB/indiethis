import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMockup, getMockupResult } from "@/lib/printful";

/**
 * POST /api/merch/mockup
 *
 * Submits a Printful mockup generation task and polls until complete.
 * Returns mockup image URLs grouped by placement.
 *
 * Body:
 *   printfulProductId  — Printful catalog product ID
 *   variantIds         — Printful variant IDs to generate mockups for (max 5)
 *   designUrl          — Publicly accessible design image URL
 *   placement          — "front" | "back" | "front_and_back"
 *   position?          — Optional Printful position coordinates from DesignPositioner
 *
 * Response:
 *   { mockups: { placement: string; url: string }[] }
 */

type Position = {
  area_width:  number;
  area_height: number;
  width:       number;
  height:      number;
  top:         number;
  left:        number;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    printfulProductId: number;
    variantIds:        number[];
    designUrl:         string;
    placement:         string;
    position?:         Position;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { printfulProductId, variantIds, designUrl, placement, position } = body;

  if (!printfulProductId || !variantIds?.length || !designUrl || !placement) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Cap at 5 variants to avoid long generation times
  const limitedVariants = variantIds.slice(0, 5);

  // Build placements — handle "front_and_back" by submitting both files
  const placements = placement === "front_and_back"
    ? ["front", "back"]
    : [placement];

  const files = placements.map((p) => ({
    placement:  p,
    image_url:  designUrl,
    ...(position ? { position } : {}),
  }));

  // Submit task to Printful
  let taskKey: string;
  try {
    taskKey = await createMockup(printfulProductId, limitedVariants, files);
  } catch (err) {
    console.error("[mockup] createMockup failed:", err);
    return NextResponse.json({ error: "Failed to start mockup generation" }, { status: 502 });
  }

  // Poll until complete (max 60s, 2s intervals = 30 attempts)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    let result;
    try {
      result = await getMockupResult(taskKey);
    } catch (err) {
      console.error("[mockup] getMockupResult failed:", err);
      return NextResponse.json({ error: "Failed to poll mockup result" }, { status: 502 });
    }

    if (result.status === "completed" && result.mockups?.length) {
      return NextResponse.json({
        mockups: result.mockups.map((m) => ({
          placement: m.placement,
          url:       m.mockup_url,
        })),
      });
    }

    if (result.status === "failed") {
      return NextResponse.json({ error: "Mockup generation failed" }, { status: 422 });
    }
  }

  return NextResponse.json({ error: "Mockup generation timed out" }, { status: 504 });
}
