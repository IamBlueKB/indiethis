/**
 * POST /api/video-studio/director/[id]/shot-list
 *
 * Generates the shot list from the creative brief + song analysis.
 * Claude creates a detailed scene-by-scene plan with model assignments.
 *
 * Returns: { shotList: Scene[] }
 */

import { db }                  from "@/lib/db";
import { claude, SONNET }      from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";
import {
  inferSceneType,
  selectModel,
  type SceneSpec,
} from "@/lib/video-studio/model-router";
import type { SongSection }    from "@/lib/video-studio/song-analyzer";
import {
  detectCameraDirection,
  CAMERA_DIRECTION_MAP,
  type CameraDirectionKey,
} from "@/components/video-studio/CameraDirectionPicker";

interface ShotListScene {
  index:           number;
  title:           string;       // short scene title e.g. "Rooftop Opening"
  description:     string;       // visual description for the prompt
  cameraDirection: CameraDirectionKey; // detected from description or default
  model:           string;
  modelDisplay:    string;
  modelReason:     string;
  startTime:       number;
  endTime:         number;
  duration:        number;
  type:            string;
  energyLevel:     number;
  prompt:          string;
  hasLipSync:      boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: {
        id: true, trackTitle: true, mode: true, creativeBrief: true,
        songStructure: true, bpm: true, musicalKey: true, energy: true,
        videoLength: true, style: true, aspectRatio: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!video.creativeBrief) return NextResponse.json({ error: "Creative brief required first" }, { status: 400 });

    const brief       = video.creativeBrief as { narrative?: string; visualThemes?: string[]; cinematography?: string; tone?: string; logline?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysis    = video.songStructure as any;
    const sections: SongSection[] = analysis?.sections ?? [];

    // Get style prompt
    const styleRecord = video.style ? await db.videoStyle.findFirst({
      where:  { name: video.style },
      select: { promptBase: true },
    }) : null;
    const stylePrompt = styleRecord?.promptBase ?? "";

    // Determine scene count
    const sceneLimit = video.videoLength === "SHORT" ? 4 : video.videoLength === "EXTENDED" ? 10 : 7;

    // Have Claude write creative descriptions for each section
    const sectionsForClaude = sections.slice(0, sceneLimit).map((s, i) => ({
      index: i,
      type:  s.type,
      start: s.startTime.toFixed(1),
      end:   s.endTime.toFixed(1),
      energy: s.energy.toFixed(2),
      lyrics: s.lyrics ? `"${s.lyrics.slice(0, 80)}"` : null,
    }));

    const briefSummary = [
      brief.logline && `Logline: ${brief.logline}`,
      brief.tone && `Tone: ${brief.tone}`,
      brief.narrative && `Narrative: ${brief.narrative}`,
      brief.cinematography && `Cinematography: ${brief.cinematography}`,
      brief.visualThemes?.length && `Themes: ${brief.visualThemes.join(", ")}`,
    ].filter(Boolean).join("\n");

    const claudeRes = await claude.messages.create({
      model:      SONNET,
      max_tokens: 1200,
      messages: [{
        role:    "user",
        content: `You are writing a shot list for a music video.

Track: "${video.trackTitle}"${video.bpm ? ` (${video.bpm} BPM` : ""}${video.musicalKey ? `, key of ${video.musicalKey})` : ")"}

Creative Brief:
${briefSummary}

Song sections:
${JSON.stringify(sectionsForClaude, null, 2)}

For each section, write a JSON object with:
- "index": number
- "title": short punchy scene name (3-5 words)
- "description": detailed visual description (2-3 sentences, cinematic language)
- "hasLipSync": boolean (true only if section has lyrics AND it's a performance/singing moment)

Return ONLY a JSON array, no other text. Example:
[{"index":0,"title":"Midnight Arrival","description":"...","hasLipSync":false}]`,
      }],
    });

    let sceneDescriptions: Array<{ index: number; title: string; description: string; hasLipSync: boolean }> = [];
    try {
      const text = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "[]";
      sceneDescriptions = JSON.parse(text.trim());
    } catch {
      // Fallback: generate basic descriptions
      sceneDescriptions = sections.slice(0, sceneLimit).map((s, i) => ({
        index:      i,
        title:      `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Scene ${i + 1}`,
        description: `${s.type} section of the music video. ${brief.logline ?? ""}`,
        hasLipSync: !!s.lyrics,
      }));
    }

    // Build shot list with model assignments
    const shotList: ShotListScene[] = sections.slice(0, sceneLimit).map((section, idx) => {
      const desc       = sceneDescriptions[idx];
      const hasLipSync = desc?.hasLipSync ?? false;
      const sceneType  = inferSceneType(section.type, section.energy, !!section.lyrics);
      const spec: SceneSpec = {
        type:                  sceneType,
        hasLipSync,
        hasFastMotion:         section.energy > 0.7,
        hasMultipleCharacters: false,
        characterRefs:         [],
        energyLevel:           section.energy,
        duration:              Math.min(section.duration, 8),
      };
      const modelConfig      = selectModel(spec);
      const description      = desc?.description ?? `${section.type} section of the music video`;
      const cameraDirection  = detectCameraDirection(description);
      const cameraPrompt     = CAMERA_DIRECTION_MAP[cameraDirection]?.prompt ?? "";
      const prompt           = `${stylePrompt}, ${description}, ${cameraPrompt}, ${sceneType} music video scene, energy ${Math.round(section.energy * 10)}/10`.slice(0, 600);

      return {
        index:           idx,
        title:           desc?.title ?? `Scene ${idx + 1}`,
        description,
        cameraDirection,
        model:           modelConfig.model,
        modelDisplay:    modelConfig.displayName,
        modelReason:     modelConfig.reason,
        startTime:       section.startTime,
        endTime:         section.endTime,
        duration:        spec.duration,
        type:            sceneType,
        energyLevel:     section.energy,
        prompt,
        hasLipSync,
      };
    });

    // Store shot list
    await db.musicVideo.update({
      where: { id },
      data:  { shotList: shotList as object[] },
    });

    return NextResponse.json({ shotList });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/shot-list]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
