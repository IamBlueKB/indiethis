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
  CAMERA_DIRECTION_DATA as CAMERA_DIRECTION_MAP,
  type CameraDirectionKey,
  FILM_LOOK_DATA as FILM_LOOKS,
  type FilmLookKey,
} from "@/lib/video-studio/camera-constants";

interface ShotListScene {
  index:           number;
  title:           string;       // short scene title e.g. "Rooftop Opening"
  description:     string;       // visual description for the prompt
  cameraDirection: CameraDirectionKey; // detected from description or default
  filmLook:        FilmLookKey;  // visual film aesthetic
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEssentiaContext(analysis: any): string {
  const parts: string[] = [];
  if (analysis?.genres?.length) {
    const genreStr = analysis.genres.slice(0, 3).map((g: { label: string; score: number }) => `${g.label} (${Math.round(g.score * 100)}%)`).join(", ");
    parts.push(`Genre: ${genreStr}`);
  }
  if (analysis?.moods?.length) {
    const moodStr = analysis.moods.slice(0, 3).map((m: { label: string; score: number }) => `${m.label} (${Math.round(m.score * 100)}%)`).join(", ");
    parts.push(`Mood: ${moodStr}`);
  }
  if (analysis?.instruments?.length) {
    const instrStr = analysis.instruments.slice(0, 5).map((i: { label: string; score: number }) => `${i.label} (${Math.round(i.score * 100)}%)`).join(", ");
    parts.push(`Instruments: ${instrStr}`);
  }
  if (analysis?.danceability != null) parts.push(`Danceability: ${analysis.danceability.toFixed(2)}`);
  if (analysis?.vocalType) parts.push(`Vocals: ${analysis.vocalType}${analysis.voiceGender ? ` (${analysis.voiceGender})` : ""}`);
  if (analysis?.timbre) parts.push(`Timbre: ${analysis.timbre}`);
  return parts.join("\n");
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
        videoLength: true, style: true, aspectRatio: true, trackDuration: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!video.creativeBrief) return NextResponse.json({ error: "Creative brief required first" }, { status: 400 });

    const brief       = video.creativeBrief as { narrative?: string; visualThemes?: string[]; cinematography?: string; tone?: string; logline?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysis    = video.songStructure as any;
    let sections: SongSection[] = analysis?.sections ?? [];

    // Fallback: if audio analysis produced no sections (e.g. native packages unavailable on Vercel),
    // synthesize evenly-spaced sections from the track duration so shot-list generation still works.
    if (sections.length === 0 && video.trackDuration > 0) {
      const sceneCount  = video.videoLength === "SHORT" ? 4 : video.videoLength === "EXTENDED" ? 10 : 7;
      const sectionTypes = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"];
      const dur          = video.trackDuration;
      const sceneDur     = dur / sceneCount;
      sections = Array.from({ length: sceneCount }, (_, i) => ({
        type:      sectionTypes[i % sectionTypes.length] as SongSection["type"],
        startTime: i * sceneDur,
        endTime:   (i + 1) * sceneDur,
        duration:  sceneDur,
        energy:    video.energy ?? 0.6,
        lyrics:    null,
        mood:      "atmospheric",
      }));
    }

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

    // Build Essentia audio intelligence context if available in songStructure
    const essentiaContext = buildEssentiaContext(analysis);

    const claudeRes = await claude.messages.create({
      model:      SONNET,
      max_tokens: 1800,
      messages: [{
        role:    "user",
        content: `You are writing a precise shot list for a music video. Your descriptions will be fed directly into an AI video generation model (Kling 3.0 text-to-video).

Track: "${video.trackTitle}"${video.bpm ? ` (${video.bpm} BPM` : ""}${video.musicalKey ? `, key of ${video.musicalKey})` : ")"}${essentiaContext ? `\n\nAudio Intelligence:\n${essentiaContext}` : ""}

Creative Brief:
${briefSummary}

Song sections:
${JSON.stringify(sectionsForClaude, null, 2)}

## Camera Direction Options
static, handheld, steadicam, dolly_push, dolly_pull, truck, crane, whip_pan, orbit, low_angle, high_angle, dutch_angle, overhead, ecu, close_up, medium, wide, extreme_wide

## Film Look Options
clean_digital, 35mm_film, 16mm_grain, anamorphic, vhs_retro, noir

## @Element1 Rule
When the artist appears in a scene (performance, singing, narrative), prefix the description with "@Element1" so the AI model binds the artist's reference photo to that character. Example: "@Element1 stands on a rain-soaked rooftop, close-up on face, neon reflections in the water below."
Skip @Element1 for pure abstract/establishing shots with no characters.

For each section, write a JSON object with:
- "index": number
- "title": short punchy scene name (3-5 words)
- "description": 2-3 sentences of detailed cinematic visual description (include @Element1 if artist is present)
- "hasLipSync": boolean — true ONLY if section has lyrics AND it is a singing/performance moment
- "filmLook": one of the film look options — choose based on mood and energy
- "cameraDirection": one camera direction from the options above — choose what best fits the moment

Return ONLY a JSON array, no other text. Example:
[{"index":0,"title":"Midnight Arrival","description":"@Element1 steps out of a black car onto rain-slicked streets, steadicam following at shoulder height. Neon signs bleed color into puddles below. Low angle looking up as they face the city.","hasLipSync":false,"filmLook":"35mm_film","cameraDirection":"steadicam"}]`,
      }],
    });

    let sceneDescriptions: Array<{ index: number; title: string; description: string; hasLipSync: boolean; filmLook?: string; cameraDirection?: string }> = [];
    try {
      const text = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "[]";
      // Strip any markdown code fences Claude might add
      const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      sceneDescriptions = JSON.parse(cleaned);
    } catch {
      // Fallback: generate basic descriptions
      sceneDescriptions = sections.slice(0, sceneLimit).map((s, i) => ({
        index:          i,
        title:          `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Scene ${i + 1}`,
        description:    `@Element1 ${s.type} section of the music video. ${brief.logline ?? ""}`,
        hasLipSync:     !!s.lyrics,
        filmLook:       "clean_digital",
        cameraDirection: "medium",
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
      const modelConfig = selectModel(spec);
      const description = desc?.description ?? `@Element1 ${section.type} section of the music video`;

      // Use Claude's explicit cameraDirection if valid, otherwise detect from description text
      const validCameraKeys   = Object.keys(CAMERA_DIRECTION_MAP) as CameraDirectionKey[];
      const claudeCameraKey   = desc?.cameraDirection as CameraDirectionKey | undefined;
      const cameraDirection   = (claudeCameraKey && validCameraKeys.includes(claudeCameraKey))
        ? claudeCameraKey
        : detectCameraDirection(description);
      const cameraPrompt     = CAMERA_DIRECTION_MAP[cameraDirection]?.prompt ?? "";

      const validFilmLooks   = Object.keys(FILM_LOOKS) as FilmLookKey[];
      const filmLook         = validFilmLooks.includes(desc?.filmLook as FilmLookKey)
        ? (desc!.filmLook as FilmLookKey)
        : "clean_digital";
      const filmLookPrompt   = FILM_LOOKS[filmLook]?.prompt ?? "";
      const prompt           = `${stylePrompt}, ${description}, ${cameraPrompt}, ${filmLookPrompt}, ${sceneType} music video scene, energy ${Math.round(section.energy * 10)}/10`.slice(0, 600);

      return {
        index:           idx,
        title:           desc?.title ?? `Scene ${idx + 1}`,
        description,
        cameraDirection,
        filmLook,
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
