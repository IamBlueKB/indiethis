/**
 * PATCH /api/video-studio/director/[id]/shot-list/update
 *
 * Persists an edited shot list (scene descriptions, camera directions, etc.)
 * back to the MusicVideo record. Called from the WorkflowBoard scene edit panel.
 *
 * Body: { shotList: ShotListScene[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }              from "@/lib/auth";
import { db }                from "@/lib/db";
import {
  CAMERA_DIRECTION_MAP,
  type CameraDirectionKey,
  FILM_LOOKS,
  type FilmLookKey,
} from "@/components/video-studio/CameraDirectionPicker";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }    = await params;
    const session   = await auth();
    const userId    = session?.user?.id ?? null;

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, userId: true, status: true, style: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Allow owner or anonymous (guests access their own video by ID)
    if (userId && video.userId && video.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json() as { shotList: unknown[] };
    if (!Array.isArray(body.shotList)) {
      return NextResponse.json({ error: "shotList array required" }, { status: 400 });
    }

    // Get style prompt base (for re-building prompts with updated camera directions)
    const styleRecord = video.style ? await db.videoStyle.findFirst({
      where:  { name: video.style },
      select: { promptBase: true },
    }) : null;
    const stylePrompt = styleRecord?.promptBase ?? "";

    // Rebuild prompts incorporating updated camera directions and film look
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedList = (body.shotList as any[]).map((scene) => {
      const cameraDir      = (scene.cameraDirection as CameraDirectionKey) ?? "static_wide";
      const cameraPrompt   = CAMERA_DIRECTION_MAP[cameraDir]?.prompt ?? "";
      const validFilmLooks = Object.keys(FILM_LOOKS) as FilmLookKey[];
      const filmLook       = validFilmLooks.includes(scene.filmLook as FilmLookKey)
        ? (scene.filmLook as FilmLookKey)
        : "clean_digital";
      const filmLookPrompt = FILM_LOOKS[filmLook]?.prompt ?? "";
      const description    = (scene.description as string) ?? "";
      const sceneType      = (scene.type as string) ?? "abstract";
      const energy         = (scene.energyLevel as number) ?? 0.5;
      const prompt         = `${stylePrompt}, ${description}, ${cameraPrompt}, ${filmLookPrompt}, ${sceneType} music video scene, energy ${Math.round(energy * 10)}/10`.slice(0, 600);

      return { ...scene, filmLook, prompt };
    });

    await db.musicVideo.update({
      where: { id },
      data:  { shotList: updatedList },
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/shot-list/update]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
