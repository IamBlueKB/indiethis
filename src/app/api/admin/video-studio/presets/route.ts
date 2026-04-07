/**
 * GET  /api/admin/video-studio/presets — list all VideoPreset records (admin)
 * POST /api/admin/video-studio/presets — create a new VideoPreset
 * POST /api/admin/video-studio/presets?action=seed — seed the 10 default presets
 *
 * PLATFORM_ADMIN only.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}

// ─── Default 10 presets ───────────────────────────────────────────────────────

const DEFAULT_PRESETS = [
  {
    name:      "Hip-Hop Performance",
    genre:     "HIP_HOP",
    sortOrder: 1,
    description: "Dark visuals, low angles, tracking shots, urban settings",
    styleName:   "Dark & Gritty",
    moodArc:     "intense_throughout",
    cameraSequence: { intro: "aerial", verse: "tracking", chorus: "low_angle_static", bridge: "close_up", outro: "pull_back" },
    briefTemplate: {
      logline:        "Artist performing in urban setting, confident energy, street-level cinematography",
      tone:           "Dark, powerful, confident",
      colorPalette:   ["#1a1a1a", "#c0392b", "#f39c12"],
      visualThemes:   ["Urban", "Gritty", "Night", "Performance"],
      cinematography: "Low angles, tracking shots following the artist, close-ups on face and hands, wide urban establishing shots",
    },
  },
  {
    name:      "R&B Cinematic",
    genre:     "RNB",
    sortOrder: 2,
    description: "Intimate setting, soft lighting, emotional performance",
    styleName:   "Smoke & Shadow",
    moodArc:     "emotional_journey",
    cameraSequence: { intro: "slow_pan", verse: "close_up", chorus: "orbit", bridge: "push_in", outro: "pull_back" },
    briefTemplate: {
      logline:        "Intimate setting, soft lighting, emotional performance, sensual atmosphere",
      tone:           "Emotional, sensual, intimate",
      colorPalette:   ["#2c1810", "#8B4513", "#DEB887"],
      visualThemes:   ["Intimacy", "Shadow", "Smoke", "Desire"],
      cinematography: "Slow pans, close-up facial expressions, orbit around artist, soft backlit silhouettes",
    },
  },
  {
    name:      "Pop Energy",
    genre:     "POP",
    sortOrder: 3,
    description: "Colorful, dynamic, fast-paced, celebratory energy",
    styleName:   "Vibrant Illustrated",
    moodArc:     "building_energy",
    cameraSequence: { intro: "aerial", verse: "tracking", chorus: "orbit", bridge: "push_in", outro: "aerial" },
    briefTemplate: {
      logline:        "Colorful, dynamic, fast-paced, celebratory energy, multiple locations",
      tone:           "Upbeat, joyful, electric",
      colorPalette:   ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF"],
      visualThemes:   ["Color", "Joy", "Dancing", "Celebration"],
      cinematography: "Fast tracking shots, aerial reveals, wide orbit shots capturing the energy of movement",
    },
  },
  {
    name:      "EDM / Electronic",
    genre:     "EDM",
    sortOrder: 4,
    description: "Futuristic cityscape, neon lights, pulsing energy",
    styleName:   "Neon Futuristic",
    moodArc:     "building_energy",
    cameraSequence: { intro: "aerial", verse: "tracking", chorus: "orbit", bridge: "aerial", outro: "pull_back" },
    briefTemplate: {
      logline:        "Futuristic cityscape, neon lights, pulsing energy, crowd scenes, laser effects",
      tone:           "Futuristic, euphoric, massive",
      colorPalette:   ["#00FFFF", "#FF00FF", "#0A0A0A", "#1A1A2E"],
      visualThemes:   ["Neon", "Future", "Crowd", "Lasers"],
      cinematography: "Sweeping aerials over crowds, orbit shots of the stage, tracking through neon-lit corridors",
    },
  },
  {
    name:      "Indie / Alternative",
    genre:     "INDIE",
    sortOrder: 5,
    description: "Authentic lo-fi aesthetic, natural settings, golden hour",
    styleName:   "Vintage Vinyl",
    moodArc:     "dark_to_bright",
    cameraSequence: { intro: "static_wide", verse: "slow_pan", chorus: "push_in", bridge: "close_up", outro: "pull_back" },
    briefTemplate: {
      logline:        "Authentic, lo-fi aesthetic, natural settings, golden hour lighting, nostalgic feel",
      tone:           "Nostalgic, raw, authentic",
      colorPalette:   ["#C8A97E", "#8B7355", "#4A3728", "#F5DEB3"],
      visualThemes:   ["Golden Hour", "Natural", "Vintage", "Authentic"],
      cinematography: "Static wide shots of landscapes, slow pans across intimate settings, natural golden light",
    },
  },
  {
    name:      "Trap / Drill",
    genre:     "TRAP",
    sortOrder: 6,
    description: "Dark, aggressive, urban nightscape, dramatic shadows",
    styleName:   "Gothic Portrait",
    moodArc:     "intense_throughout",
    cameraSequence: { intro: "close_up", verse: "tracking", chorus: "static_wide", bridge: "slow_pan", outro: "pull_back" },
    briefTemplate: {
      logline:        "Dark, aggressive, urban nightscape, street-level, dramatic shadows",
      tone:           "Dark, aggressive, uncompromising",
      colorPalette:   ["#0D0D0D", "#8B0000", "#C0C0C0", "#1A1A1A"],
      visualThemes:   ["Dark", "Urban", "Night", "Shadow"],
      cinematography: "Close-up facial expressions, low-angle tracking shots, static wide with dramatic shadow play",
    },
  },
  {
    name:      "Latin / Reggaeton",
    genre:     "LATIN",
    sortOrder: 7,
    description: "Vibrant colors, dance-focused, nightclub setting, high energy",
    styleName:   "Neon Futuristic",
    moodArc:     "intense_throughout",
    cameraSequence: { intro: "aerial", verse: "tracking", chorus: "orbit", bridge: "close_up", outro: "aerial" },
    briefTemplate: {
      logline:        "Vibrant colors, dance-focused, nightclub setting, high energy, tropical elements",
      tone:           "Hot, vibrant, irresistible",
      colorPalette:   ["#FF6B00", "#FFD700", "#FF1493", "#00CED1"],
      visualThemes:   ["Dance", "Tropical", "Club", "Vibrant"],
      cinematography: "Orbit shots capturing dance movement, tracking following dancers, aerial establishing shots",
    },
  },
  {
    name:      "Acoustic / Singer-Songwriter",
    genre:     "ACOUSTIC",
    sortOrder: 8,
    description: "Intimate, natural light, minimal setting, pure emotion",
    styleName:   "Watercolor Dreamy",
    moodArc:     "emotional_journey",
    cameraSequence: { intro: "static_wide", verse: "slow_pan", chorus: "push_in", bridge: "close_up", outro: "pull_back" },
    briefTemplate: {
      logline:        "Intimate, natural light, minimal setting, focus on emotion and storytelling",
      tone:           "Tender, honest, vulnerable",
      colorPalette:   ["#F5F5DC", "#DEB887", "#8FBC8F", "#87CEEB"],
      visualThemes:   ["Intimacy", "Nature", "Emotion", "Simplicity"],
      cinematography: "Wide static shots in natural settings, slow push-in to reveal emotion, gentle pans",
    },
  },
  {
    name:      "Abstract Visualizer",
    genre:     "ABSTRACT",
    sortOrder: 9,
    description: "No characters, pure visual abstraction, shapes responding to music",
    styleName:   "Particle Flow",
    moodArc:     "building_energy",
    cameraSequence: { intro: "push_in", verse: "orbit", chorus: "aerial", bridge: "pull_back", outro: "orbit" },
    briefTemplate: {
      logline:        "No characters, pure visual abstraction, shapes and colors responding to music energy",
      tone:           "Hypnotic, abstract, immersive",
      colorPalette:   ["#6A0DAD", "#00BFFF", "#FF4500", "#0A0A0A"],
      visualThemes:   ["Abstract", "Particles", "Energy", "Geometry"],
      cinematography: "Macro push-ins into abstract forms, orbital motion around geometric shapes, aerial of particle fields",
    },
  },
  {
    name:      "Storyteller Narrative",
    genre:     "NARRATIVE",
    sortOrder: 10,
    description: "Character-driven story, beginning middle end, cinematic pacing",
    styleName:   "Cinematic Noir",
    moodArc:     "dark_to_bright",
    cameraSequence: { intro: "static_wide", verse: "tracking", chorus: "close_up", bridge: "slow_pan", outro: "pull_back" },
    briefTemplate: {
      logline:        "Character-driven story, beginning middle end, cinematic pacing, narrative arc",
      tone:           "Dramatic, story-driven, cinematic",
      colorPalette:   ["#1C1C1C", "#4A4A4A", "#C4A35A", "#8B8B8B"],
      visualThemes:   ["Story", "Characters", "Journey", "Noir"],
      cinematography: "Wide establishing shots, tracking characters through the story, close-ups at emotional peaks",
    },
  },
];

// ─── GET — list all presets (admin) ──────────────────────────────────────────

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const presets = await db.videoPreset.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ presets });
}

// ─── POST — create or seed ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  // Seed action — upsert all 10 defaults
  if (action === "seed") {
    let seeded = 0;
    for (const preset of DEFAULT_PRESETS) {
      await db.videoPreset.upsert({
        where:  { name: preset.name },
        create: preset,
        update: preset,
      });
      seeded++;
    }
    return NextResponse.json({ ok: true, seeded });
  }

  // Regular create
  const body = await req.json() as {
    name: string; genre: string; description: string; previewUrl?: string;
    styleName?: string; moodArc: string; cameraSequence: object; briefTemplate: object;
    sortOrder?: number;
  };

  if (!body.name || !body.genre || !body.description || !body.moodArc) {
    return NextResponse.json({ error: "name, genre, description, moodArc required" }, { status: 400 });
  }

  const preset = await db.videoPreset.create({
    data: {
      name:           body.name,
      genre:          body.genre,
      description:    body.description,
      previewUrl:     body.previewUrl ?? null,
      styleName:      body.styleName ?? null,
      moodArc:        body.moodArc,
      cameraSequence: body.cameraSequence,
      briefTemplate:  body.briefTemplate,
      sortOrder:      body.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
