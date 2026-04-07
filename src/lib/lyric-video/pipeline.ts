/**
 * src/lib/lyric-video/pipeline.ts
 *
 * Lyric Video Studio — Generation Pipeline
 *
 * Orchestrates the full production pipeline for a LyricVideo record:
 *   1. ANALYZING   — detect BPM/key/energy/lyrics/sections via song-analyzer
 *   2. GENERATING  — extract color palette from cover art; generate AI backgrounds
 *   3. STITCHING   — stitch via Remotion Lambda (CinematicLyricVideo composition)
 *   4. COMPLETE    — update record + send notification email
 *
 * Caller responsibilities:
 *   - Set stripePaymentId on the record before calling startLyricVideoGeneration
 *   - Call from the Stripe webhook or subscription-credit flow
 */

import sharp                    from "sharp";
import { fal }                  from "@fal-ai/client";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { db }                   from "@/lib/db";
import { analyzeSong }          from "@/lib/video-studio/song-analyzer";
import { generateBackgrounds }  from "@/lib/lyric-video/background-generator";
import { sendBrandedEmail }     from "@/lib/brevo/email";
import type { LyricVideo }      from "@prisma/client";
import type { CinematicLyricVideoProps, LyricWordTimestamp, BackgroundSceneClip } from "../../../remotion/src/CinematicLyricVideo";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_RENDER_MS    = 15 * 60 * 1000; // 15 minutes max for Remotion
const RENDER_POLL_MS   = 8000;
const APP_URL          = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Progress helper ──────────────────────────────────────────────────────────

async function setProgress(id: string, progress: number, currentStep: string, extra?: Record<string, unknown>) {
  await db.lyricVideo.update({
    where: { id },
    data:  { progress, currentStep, ...extra },
  });
}

// ─── Color extraction from cover art ─────────────────────────────────────────

interface ColorPalette {
  primary:   string;  // dominant color hex
  secondary: string;  // secondary color hex
  accent:    string;  // accent (often golden or complementary)
}

async function extractColorPalette(imageUrl: string): Promise<ColorPalette | null> {
  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());

    // Resize to 64×64 and get raw RGB pixels
    const { data } = await sharp(buffer)
      .resize(64, 64)
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r1 = 0, g1 = 0, b1 = 0;
    let r2 = 0, g2 = 0, b2 = 0;
    const pixels = data.length / 3;

    // Average of top-half pixels → primary
    const half = Math.floor(pixels / 2);
    for (let i = 0; i < half * 3; i += 3) {
      r1 += data[i]; g1 += data[i + 1]; b1 += data[i + 2];
    }
    r1 = Math.round(r1 / half);
    g1 = Math.round(g1 / half);
    b1 = Math.round(b1 / half);

    // Average of bottom-half → secondary
    for (let i = half * 3; i < pixels * 3; i += 3) {
      r2 += data[i]; g2 += data[i + 1]; b2 += data[i + 2];
    }
    r2 = Math.round(r2 / (pixels - half));
    g2 = Math.round(g2 / (pixels - half));
    b2 = Math.round(b2 / (pixels - half));

    const toHex = (r: number, g: number, b: number) =>
      `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    return {
      primary:   toHex(r1, g1, b1),
      secondary: toHex(r2, g2, b2),
      accent:    "#D4A843",   // always gold as accent for brand consistency
    };
  } catch {
    return null;
  }
}

// ─── Remotion Lambda stitching ────────────────────────────────────────────────

async function stitchLyricVideo(
  jobId:       string,
  props:       CinematicLyricVideoProps,
  aspectRatio: "16:9" | "9:16" | "1:1",
): Promise<string> {
  const serveUrl     = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion    = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as Parameters<typeof renderMediaOnLambda>[0]["region"];

  if (!serveUrl || !functionName) {
    // Not configured — return first background scene as fallback
    console.warn("[lyric-video] Remotion not configured — returning fallback URL");
    return props.backgroundScenes.find(s => s.videoUrl)?.videoUrl ?? "";
  }

  const { renderId, bucketName } = await renderMediaOnLambda({
    region:       awsRegion,
    functionName,
    serveUrl,
    composition:  "CinematicLyricVideo",
    inputProps:   props as unknown as Record<string, unknown>,
    codec:        "h264",
    imageFormat:  "jpeg",
    maxRetries:   2,
    privacy:      "public",
    outName:      `lyric-video-${jobId}-${aspectRatio.replace(":", "x")}.mp4`,
  });

  const renderStart = Date.now();
  while (Date.now() - renderStart < MAX_RENDER_MS) {
    await new Promise<void>(r => setTimeout(r, RENDER_POLL_MS));
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: awsRegion,
    });
    if (progress.fatalErrorEncountered) {
      const msg = progress.errors?.[0]?.message ?? "Unknown Remotion error";
      console.error(`[lyric-video] Remotion render failed for ${jobId}:`, msg);
      return props.backgroundScenes.find(s => s.videoUrl)?.videoUrl ?? "";
    }
    if (progress.done) return progress.outputFile ?? "";
  }

  console.error(`[lyric-video] Remotion timed out for ${jobId}`);
  return props.backgroundScenes.find(s => s.videoUrl)?.videoUrl ?? "";
}

// ─── Notification email ───────────────────────────────────────────────────────

async function sendLyricVideoCompleteEmail({
  toEmail,
  toName,
  trackTitle,
  downloadUrl,
  jobId,
  isGuest,
}: {
  toEmail:    string;
  toName?:    string;
  trackTitle: string;
  downloadUrl: string;
  jobId:      string;
  isGuest:    boolean;
}) {
  const appUrl  = APP_URL();
  const previewUrl = `${appUrl}/lyric-video/preview/${jobId}`;

  await sendBrandedEmail({
    to:      { email: toEmail, name: toName },
    subject: `Your lyric video is ready — "${trackTitle}"`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Lyric Video is Ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Your cinematic lyric video for
        <strong style="color:#fff;">&ldquo;${trackTitle}&rdquo;</strong> has been generated.
      </p>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 20px;">
        Watch it, download the MP4, or share directly from your preview page.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${previewUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
          Watch &amp; Download
        </a>
      </p>
      ${isGuest ? `
      <p style="color:#888;font-size:13px;margin:0 0 8px;">
        Want unlimited lyric videos every month?
        <a href="${appUrl}/pricing" style="color:#D4A843;">View IndieThis plans →</a>
      </p>` : ""}
    `,
    context: "LYRIC_VIDEO_COMPLETE",
    tags:    ["lyric-video", "complete"],
  });
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function startLyricVideoGeneration(lyricVideoId: string): Promise<void> {
  let job: LyricVideo | null = null;

  try {
    job = await db.lyricVideo.findUnique({ where: { id: lyricVideoId } });
    if (!job) throw new Error(`LyricVideo ${lyricVideoId} not found`);
    const j = job; // non-null reference

    // Idempotency guard
    if (j.status === "GENERATING" || j.status === "STITCHING" || j.status === "COMPLETE") return;

    // Payment guard — never generate without confirmed payment (0 = included credit is OK)
    if (j.amount > 0 && !j.stripePaymentId) {
      throw new Error(`Cannot start: payment not confirmed for LyricVideo ${lyricVideoId}`);
    }

    // ── Phase 1: Analyze track ─────────────────────────────────────────────
    await setProgress(lyricVideoId, 5, "Analyzing your track…", { status: "ANALYZING" });

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY not configured");
    fal.config({ credentials: falKey });

    const analysis = await analyzeSong({
      audioUrl: j.audioUrl,
      trackId:  j.trackId ?? undefined,
      duration: j.trackDuration,
    });

    await db.lyricVideo.update({
      where: { id: lyricVideoId },
      data:  {
        songStructure:   analysis as object,
        bpm:             analysis.bpm,
        musicalKey:      analysis.key,
        energy:          analysis.energy,
        lyrics:          analysis.lyrics ?? undefined,
        lyricTimestamps: (analysis.lyricTimestamps ?? []) as object[],
      },
    });

    await setProgress(lyricVideoId, 18, "Track analyzed — building backgrounds…");

    // ── Phase 2a: Color extraction ─────────────────────────────────────────
    let colorPalette = (j.colorPalette as ColorPalette | null);
    if (!colorPalette && j.coverArtUrl) {
      colorPalette = await extractColorPalette(j.coverArtUrl);
      if (colorPalette) {
        await db.lyricVideo.update({ where: { id: lyricVideoId }, data: { colorPalette: colorPalette as object } });
      }
    }

    // ── Phase 2b: Section plan ─────────────────────────────────────────────
    // For Quick Mode: use sections from song analysis
    // For Director Mode: sectionPlan is already stored on the record (set during chat)
    let sections = analysis.sections;
    if (sections.length === 0) {
      // Fallback: one section for the whole track
      sections = [{
        type:      "verse",
        startTime: 0,
        endTime:   j.trackDuration,
        duration:  j.trackDuration,
        energy:    analysis.energy,
        lyrics:    analysis.lyrics ?? null,
        mood:      "atmospheric",
      }];
    }

    // Director Mode may have per-section prompt overrides stored in sectionPlan
    const directorPlan = j.mode === "DIRECTOR" && j.sectionPlan
      ? (j.sectionPlan as { sectionIndex: number; backgroundPrompt: string; typographyStyleId?: string }[])
      : null;

    // ── Phase 2c: Generate backgrounds ────────────────────────────────────
    await setProgress(lyricVideoId, 22, `Generating ${sections.length} background scenes…`, { status: "GENERATING" });

    const aspectRatio: "16:9" | "9:16" | "1:1" = "16:9"; // TODO: make configurable

    // If Director Mode has per-section prompt overrides, apply them
    const sectionsForGen = directorPlan
      ? sections.map((s, i) => {
          const override = directorPlan.find(p => p.sectionIndex === i);
          return override ? { ...s, mood: "atmospheric", _promptOverride: override.backgroundPrompt } : s;
        })
      : sections;

    // Build a simplified prompt override if Director Mode
    const visionPrompt = (j.visionPrompt as string | null) ?? null;

    const backgroundScenes = await generateBackgrounds({
      sections:     sectionsForGen,
      coverArtUrl:  j.coverArtUrl ?? null,
      colorPalette: colorPalette ?? null,
      visionPrompt,
      aspectRatio,
      onProgress: async (completed, total) => {
        const p = 22 + Math.round((completed / total) * 45);
        await setProgress(lyricVideoId, p, `Generated ${completed}/${total} scenes…`);
      },
    });

    await db.lyricVideo.update({
      where: { id: lyricVideoId },
      data:  { backgroundScenes: backgroundScenes as object[] },
    });

    // ── Phase 3: Stitch via Remotion Lambda ───────────────────────────────
    await setProgress(lyricVideoId, 70, "Assembling your lyric video…", { status: "STITCHING" });

    // Build typed LyricWord timestamps (seconds-based, from song-analyzer)
    const lyricTimestamps: LyricWordTimestamp[] = analysis.lyricTimestamps
      ? analysis.lyricTimestamps.map(w => ({ word: w.word, start: w.start, end: w.end }))
      : [];

    // Resolve typography style ID → style name
    let typographyStyleName = "KARAOKE";
    if (j.typographyStyleId) {
      const styleRecord = await db.typographyStyle.findUnique({
        where:  { id: j.typographyStyleId },
        select: { name: true },
      });
      if (styleRecord) typographyStyleName = styleRecord.name;
    }

    const sceneClips: BackgroundSceneClip[] = backgroundScenes
      .filter(s => s.videoUrl)
      .map(s => ({
        sectionIndex: s.sectionIndex,
        videoUrl:     s.videoUrl,
        startTime:    s.startTime,
        endTime:      s.endTime,
      }));

    const remotionProps: CinematicLyricVideoProps = {
      audioUrl:         j.audioUrl,
      trackTitle:       j.trackTitle,
      artistName:       j.guestName ?? "Artist",
      coverArtUrl:      j.coverArtUrl ?? undefined,
      backgroundScenes: sceneClips,
      lyrics:           lyricTimestamps,
      typographyStyle:  typographyStyleName,
      colorPalette:     colorPalette ?? undefined,
      aspectRatio,
      durationMs:       j.trackDuration * 1000,
      bpm:              analysis.bpm,
      beats:            analysis.beats,
    };

    const finalVideoUrl = await stitchLyricVideo(lyricVideoId, remotionProps, aspectRatio);

    // Thumbnail: first background scene with a video URL
    const thumbnailUrl = backgroundScenes.find(s => s.videoUrl)?.videoUrl ?? null;

    await db.lyricVideo.update({
      where: { id: lyricVideoId },
      data:  {
        status:        "COMPLETE",
        progress:      100,
        currentStep:   "Complete!",
        finalVideoUrl: finalVideoUrl || undefined,
        thumbnailUrl:  thumbnailUrl || undefined,
      },
    });

    // ── Phase 4: Notification email ────────────────────────────────────────
    try {
      const appUrl = APP_URL();
      const isGuest = !j.userId;
      const toEmail = j.userId
        ? (await db.user.findUnique({ where: { id: j.userId }, select: { email: true, name: true } }))?.email ?? null
        : j.guestEmail;
      const toName = j.userId
        ? (await db.user.findUnique({ where: { id: j.userId }, select: { name: true } }))?.name
        : j.guestName ?? undefined;

      if (toEmail) {
        await sendLyricVideoCompleteEmail({
          toEmail,
          toName:     toName ?? undefined,
          trackTitle: j.trackTitle,
          downloadUrl: finalVideoUrl,
          jobId:      lyricVideoId,
          isGuest,
        });
      }
    } catch (emailErr) {
      console.error("[lyric-video] notification email failed:", emailErr);
      // Non-fatal — don't fail the whole pipeline
    }

  } catch (err) {
    console.error(`[lyric-video] pipeline failed for ${lyricVideoId}:`, err);
    await db.lyricVideo.update({
      where: { id: lyricVideoId },
      data:  {
        status:       "FAILED",
        errorMessage: String(err),
        progress:     0,
      },
    }).catch(() => {});
    throw err;
  }
}
