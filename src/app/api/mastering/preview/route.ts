/**
 * POST /api/mastering/preview
 *
 * Generates a FREE 30-second preview of a mastering or mix+master job.
 * No payment required. No MasteringJob record created.
 * Always targets the highest-energy section (chorus) of the track.
 *
 * Body:
 *   mode:          "MIX_AND_MASTER" | "MASTER_ONLY"
 *   inputType:     "STEREO" | "STEMS"
 *   inputFileUrl?: string           // required for MASTER_ONLY
 *   stems?:        { url: string; filename: string }[]  // required for MIX_AND_MASTER
 *   mood?:         "CLEAN" | "WARM" | "PUNCH" | "LOUD"
 *   guestEmail?:   string           // stored for conversion emails
 *
 * Returns:
 *   { previewUrl: string; startSec: number; endSec: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeAudio, generatePreview, classifyStems, type StemProcessingChain } from "@/lib/mastering/engine";
import { decideMasterParameters } from "@/lib/mastering/decisions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode:         "MIX_AND_MASTER" | "MASTER_ONLY";
      inputType:    "STEREO" | "STEMS";
      inputFileUrl?: string;
      stems?:       { url: string; filename: string }[];
      mood?:        "CLEAN" | "WARM" | "PUNCH" | "LOUD";
      guestEmail?:  string;
    };

    const { mode, inputFileUrl, stems, mood = "CLEAN" } = body;

    // ── Validate inputs ─────────────────────────────────────────────────────────
    if (mode === "MASTER_ONLY" && !inputFileUrl) {
      return NextResponse.json({ error: "inputFileUrl required for MASTER_ONLY." }, { status: 400 });
    }
    if (mode === "MIX_AND_MASTER" && (!stems || stems.length < 2)) {
      return NextResponse.json({ error: "At least 2 stems required for MIX_AND_MASTER." }, { status: 400 });
    }

    // ── Analyze the audio ───────────────────────────────────────────────────────
    // For MIX_AND_MASTER, analyze the first stem to get section/BPM data
    const audioUrl = mode === "MASTER_ONLY" ? inputFileUrl! : stems![0].url;
    const analysis = await analyzeAudio(audioUrl);

    // ── Build preview params and generate ──────────────────────────────────────
    let previewResult;

    if (mode === "MASTER_ONLY") {
      // Decide mastering chain for the mood, then generate 30s preview
      const masterParams = await decideMasterParameters({
        analysis,
        mood,
        genre:                 "pop",
        naturalLanguagePrompt: null,
      });

      previewResult = await generatePreview(
        {
          audioUrl:  inputFileUrl!,
          ...masterParams.params,
          versions:  [{ name: "Clean" as const, targetLufs: -14 }],
          platforms: ["spotify"],
        },
        "master"
      );
    } else {
      // MIX_AND_MASTER — classify stems, build neutral mix chain, preview
      const stemUrls   = stems!.map((s) => s.url);
      const classified = await classifyStems(stemUrls);

      // Neutral StemProcessingChains for preview (no heavy processing)
      const stemChains: StemProcessingChain[] = classified.map((s) => ({
        stemUrl:  s.url,
        stemType: s.detectedType,
        gain:     0,
        pan:      0,
        eq:       [],
      }));

      previewResult = await generatePreview(
        {
          stems:    stemChains,
          sections: analysis.sections,
          bpm:      analysis.bpm,
        },
        "mix"
      );
    }

    return NextResponse.json({
      previewUrl: previewResult.previewUrl,
      startSec:   previewResult.startSec,
      endSec:     previewResult.endSec,
    });
  } catch (err) {
    console.error("POST /api/mastering/preview:", err);
    return NextResponse.json(
      { error: "Preview generation failed. Please try again." },
      { status: 500 }
    );
  }
}
