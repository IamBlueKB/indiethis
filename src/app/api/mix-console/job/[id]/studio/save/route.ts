/**
 * POST /api/mix-console/job/[id]/studio/save
 *
 * Persists the artist's current Pro Studio Mixer state back onto MixJob.
 * Called by the autosave loop in <StudioClient> after a 1.2s debounce on
 * dirty changes — also fires on tab close via sendBeacon.
 *
 * Auth: subscriber session must own the job. Pro tier required (the
 * studio is a Pro feature). Body schema is permissive (Json field on
 * Prisma) but we validate the shape's outer keys before writing so we
 * don't poison MixJob.studioState with arbitrary content.
 */

import { NextResponse }   from "next/server";
import { auth }           from "@/lib/auth";
import { db as prisma }   from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingState {
  global?:       Record<string, unknown>;
  sections?:     Record<string, unknown>;
  master?:       Record<string, unknown>;
  linkedGroups?: Record<string, unknown>;
  snapshots?:    unknown[];
  isDirty?:      boolean;
  lastSavedAt?:  string | null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const job    = await prisma.mixJob.findUnique({
    where:  { id },
    select: { id: true, userId: true, tier: true, status: true },
  });
  if (!job)                            return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.userId !== session.user.id)  return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (job.tier   !== "PRO")            return NextResponse.json({ error: "pro tier required" }, { status: 403 });

  // Parse + validate the incoming state at the outer-key level. Every key
  // is optional so partial saves are fine, but unknown shapes are rejected.
  let body: IncomingState;
  try {
    body = (await req.json()) as IncomingState;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const allowed = ["global","sections","master","linkedGroups","snapshots","isDirty","lastSavedAt"] as const;
  for (const k of Object.keys(body)) {
    if (!(allowed as readonly string[]).includes(k)) {
      return NextResponse.json({ error: `unknown key: ${k}` }, { status: 400 });
    }
  }

  const savedAt = new Date().toISOString();
  const studioState = {
    global:       body.global       ?? {},
    sections:     body.sections     ?? {},
    master:       body.master       ?? {},
    linkedGroups: body.linkedGroups ?? {},
    snapshots:    body.snapshots    ?? [],
    isDirty:      false,
    lastSavedAt:  savedAt,
  };

  await prisma.mixJob.update({
    where: { id },
    data:  { studioState: studioState as unknown as object },
  });

  return NextResponse.json({ ok: true, lastSavedAt: savedAt });
}
