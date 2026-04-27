/**
 * POST /api/mix-console/job/[id]/studio/render
 *
 * Pro tier only. Renders the artist's CURRENT studio state to a single
 * mixed-down WAV via Replicate's predict.py (action: "studio-render").
 *
 * Step 25 scope: API route + webhook stub. The actual `_studio_render`
 * implementation in predict.py lands in Step 26 along with the cog push.
 *
 * Body (all optional — falls back to persisted job.studioState):
 *   {
 *     global?:       Record<StemRole, StemState>,
 *     sections?:     Record<string, SectionOverride>,
 *     master?:       MasterState,
 *     linkedGroups?: Record<string, StemRole[]>,
 *   }
 *
 * Status flow: studioStatus = STUDIO_RENDERING → (webhook) → STUDIO_COMPLETE
 * Sets studioFilePath when the webhook lands a successful render.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

interface IncomingState {
  global?:       Record<string, unknown>;
  sections?:     Record<string, unknown>;
  master?:       Record<string, unknown>;
  linkedGroups?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:              true,
        userId:          true,
        tier:            true,
        genre:           true,
        status:          true,
        studioStatus:    true,
        studioState:     true,
        mixParameters:   true,
        analysisData:    true,
        inputFiles:      true,
        pitchCorrection: true,
        breathEditing:   true,
        fadeOut:         true,
        sectionMap:      true,
        cleanFilePath:   true,
      },
    });
    if (!job)                            return NextResponse.json({ error: "not found" }, { status: 404 });
    if (job.userId !== session.user.id)  return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (job.tier   !== "PRO")            return NextResponse.json({ error: "pro tier required" }, { status: 403 });

    // Must have a finished initial mix before the studio can render anything.
    if (!job.cleanFilePath) {
      return NextResponse.json(
        { error: "No mix has been rendered yet." },
        { status: 409 },
      );
    }
    // Block if a studio render is already in flight.
    if (job.studioStatus === "STUDIO_RENDERING") {
      return NextResponse.json(
        { error: "A studio render is already in progress." },
        { status: 409 },
      );
    }

    // Parse body — empty/invalid bodies fall back to the persisted state.
    let body: IncomingState = {};
    try {
      body = (await req.json()) as IncomingState;
    } catch {
      body = {};
    }

    // Resolve current studio state: prefer body (what the artist is hearing
    // right now in the browser), fall back to the autosaved DB copy.
    const persisted = (job.studioState ?? {}) as Record<string, unknown>;
    const studioStateFinal = {
      global:       body.global       ?? (persisted.global       as Record<string, unknown>) ?? {},
      sections:     body.sections     ?? (persisted.sections     as Record<string, unknown>) ?? {},
      master:       body.master       ?? (persisted.master       as Record<string, unknown>) ?? {},
      linkedGroups: body.linkedGroups ?? (persisted.linkedGroups as Record<string, unknown>) ?? {},
    };

    // Rebuild stems_urls from inputFiles. Step 26 may add an original_stems_urls
    // sibling once we wire dry/wet against raw uploads.
    const inputFiles  = (job.inputFiles ?? []) as { url: string; label: string }[];
    const stemsUrlsObj: Record<string, string> = {};
    for (const f of inputFiles) stemsUrlsObj[f.label] = f.url;

    const analysisData = (job.analysisData  ?? {}) as Record<string, unknown>;
    const baseParams   = (job.mixParameters ?? {}) as Record<string, unknown>;

    // Build the payload predict.py's `_studio_render` will consume in Step 26.
    // Carries Claude's original decisions plus the artist's overrides so the
    // engine can compute final per-stem effects relative to the AI baseline.
    const fullStudioParams = {
      ...baseParams,
      stems_urls:          stemsUrlsObj,
      genre:               job.genre ?? "HIP_HOP",
      pitchCorrection:     job.pitchCorrection ?? "OFF",
      breathEditing:       (job as any).breathEditing ?? "SUBTLE",
      roomReverb:          (analysisData.room_reverb as number) ?? 0,
      bpm:                 (analysisData.bpm         as number) ?? 120,
      sectionMap:          job.sectionMap ?? (baseParams as any).sectionMap ?? [],
      sections:            (analysisData.sections as unknown[]) ?? [],
      fadeOut:             job.fadeOut    ?? (baseParams as any).fadeOut    ?? "AUTO",

      // Studio overrides — the new fields predict.py reads in Step 26.
      studioState: studioStateFinal,
    };

    // Mark RENDERING + snapshot the state we sent (so the webhook can
    // reconcile against exactly what was rendered).
    await prisma.mixJob.update({
      where: { id },
      data:  {
        studioStatus: "STUDIO_RENDERING",
        studioState:  {
          ...persisted,
          ...studioStateFinal,
          isDirty:     false,
          lastSavedAt: new Date().toISOString(),
        } as unknown as object,
      },
    });

    await startMixAction(
      "studio-render",
      {
        job_id:          id,
        mix_params_json: JSON.stringify(fullStudioParams),
      },
      "/api/mix-console/webhook/replicate/studio-render",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mix-console/job/${id}/studio/render:`, err);
    // Best-effort revert to non-rendering so the UI isn't stuck.
    try {
      await prisma.mixJob.update({
        where: { id },
        data:  { studioStatus: "STUDIO_FAILED" },
      });
    } catch { /* ignore */ }
    return NextResponse.json({ error: "Failed to start studio render." }, { status: 500 });
  }
}
