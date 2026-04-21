/**
 * POST /api/mix-console/job
 *
 * Creates a MixJob and kicks off the mix pipeline after payment.
 * PAYWALL_ENABLED = false for testing — re-enable before launch.
 *
 * Body:
 *   mode:               "VOCAL_BEAT" | "TRACKED_STEMS"
 *   tier:               "STANDARD" | "PREMIUM" | "PRO"
 *   inputFiles:         [{ url, label }]  — 2 files for VOCAL_BEAT, 2–16 for TRACKED_STEMS
 *   genre?              string
 *   breathEditing?      string
 *   pitchCorrection?    string
 *   delayStyle?         string
 *   mixVibe?            string
 *   reverbStyle?        string
 *   fadeOut?            string
 *   customDirection?    string
 *   referenceTrackUrl?  string (PREMIUM / PRO only)
 *   referenceFileName?  string
 *   stripePaymentId?    string
 *   guestEmail?         string
 *   guestName?          string
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const maxDuration = 30;

const MAX_REVISIONS: Record<string, number> = {
  STANDARD: 0,
  PREMIUM:  2,
  PRO:      3,
};

const TIER_PRICES: Record<string, number> = {
  STANDARD: 5999,
  PREMIUM:  7999,
  PRO:      9999,
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json() as {
      mode:               string;
      tier:               string;
      inputFiles:         { url: string; label: string }[];
      genre?:             string;
      breathEditing?:     string;
      pitchCorrection?:   string;
      delayStyle?:        string;
      mixVibe?:           string;
      vocalStylePreset?:  string;
      beatPolish?:        boolean;
      reverbStyle?:       string;
      fadeOut?:           string;
      customDirection?:   string;
      referenceTrackUrl?: string;
      referenceFileName?: string;
      stripePaymentId?:   string;
      guestEmail?:        string;
      guestName?:         string;
    };

    // ── TESTING: paywall bypassed — re-enable before launch ──────────────────
    const PAYWALL_ENABLED = false;

    let chargedAmount = 0;
    if (PAYWALL_ENABLED) {
      if (!body.stripePaymentId) {
        return NextResponse.json({ error: "Payment required before processing." }, { status: 402 });
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const paymentIntent = await stripe.paymentIntents.retrieve(body.stripePaymentId);
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json({ error: "Payment not confirmed." }, { status: 402 });
      }
      chargedAmount = paymentIntent.amount;
    } else {
      chargedAmount = TIER_PRICES[body.tier] ?? 5999;
    }

    // Reference track is Premium/Pro only
    if (body.referenceTrackUrl && body.tier === "STANDARD") {
      return NextResponse.json(
        { error: "Reference track matching requires Premium or Pro tier." },
        { status: 400 },
      );
    }

    // Validate files per mode
    const inputFiles = body.inputFiles ?? [];
    if (body.mode === "VOCAL_BEAT") {
      const hasBeat  = inputFiles.some((f) => f.label === "beat");
      const hasMain  = inputFiles.some((f) => f.label === "vocal_main");
      if (!hasMain || !hasBeat) {
        return NextResponse.json(
          { error: "VOCAL_BEAT mode requires at least a main vocal and a beat." },
          { status: 400 },
        );
      }
    } else if (body.mode === "TRACKED_STEMS") {
      if (inputFiles.length < 2) {
        return NextResponse.json(
          { error: "TRACKED_STEMS mode requires at least 2 files." },
          { status: 400 },
        );
      }
      if (inputFiles.length > 16) {
        return NextResponse.json(
          { error: "Maximum 16 files allowed." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid mode. Must be VOCAL_BEAT or TRACKED_STEMS." }, { status: 400 });
    }

    // Create the job
    const job = await prisma.mixJob.create({
      data: {
        userId:            session?.user?.id ?? null,
        guestEmail:        body.guestEmail   ?? null,
        guestName:         body.guestName    ?? null,
        mode:              body.mode,
        tier:              body.tier,
        status:            "PENDING",
        inputFiles:        inputFiles as any,
        genre:             body.genre            ?? null,
        breathEditing:     body.breathEditing    ?? null,
        pitchCorrection:   body.pitchCorrection  ?? null,
        delayStyle:        body.delayStyle       ?? null,
        mixVibe:           body.mixVibe          ?? null,
        vocalStylePreset:  body.vocalStylePreset ?? null,
        beatPolish:        body.beatPolish       ?? false,
        reverbStyle:       body.reverbStyle      ?? null,
        fadeOut:           body.fadeOut          ?? null,
        customDirection:   body.customDirection  ?? null,
        referenceTrackUrl: body.referenceTrackUrl ?? null,
        referenceFileName: body.referenceFileName ?? null,
        stripePaymentId:   body.stripePaymentId  ?? null,
        amount:            chargedAmount,
        maxRevisions:      MAX_REVISIONS[body.tier] ?? 0,
      },
    });

    // Fire pipeline — fire-and-forget, return jobId immediately.
    // VOCAL_BEAT without Beat Polish → straight to analyze-mix (beat stays as 2-track).
    // VOCAL_BEAT with Beat Polish → SEPARATING first (Demucs on beat), then analyze.
    // TRACKED_STEMS → straight to analyze-mix.
    const beatPolish = body.beatPolish ?? false;

    if (body.mode === "VOCAL_BEAT" && beatPolish) {
      // Beat Polish: separate beat stems first
      const beatFileUrl = inputFiles.find((f) => f.label === "beat")!.url;
      await prisma.mixJob.update({ where: { id: job.id }, data: { status: "SEPARATING" } });
      startMixAction(
        "separate-stems",
        { audio_url: beatFileUrl, job_id: job.id },
        "/api/mix-console/webhook/replicate/separate",
      ).catch(async (startErr) => {
        const msg = startErr instanceof Error ? startErr.message : String(startErr);
        console.error(`[mix-console] separate-stems failed for job ${job.id}:`, msg);
        await prisma.mixJob.update({
          where: { id: job.id },
          data:  { status: "FAILED", analysisData: { error: msg } as any },
        });
      });
    } else {
      // Default: straight to analysis
      await prisma.mixJob.update({ where: { id: job.id }, data: { status: "ANALYZING" } });
      startMixAction(
        "analyze-mix",
        {
          stems_urls: JSON.stringify(inputFiles.map((f) => f.url)),
          job_id:     job.id,
        },
        "/api/mix-console/webhook/replicate/analyze",
      ).catch(async (startErr) => {
        const msg = startErr instanceof Error ? startErr.message : String(startErr);
        console.error(`[mix-console] analyze-mix failed for job ${job.id}:`, msg);
        await prisma.mixJob.update({
          where: { id: job.id },
          data:  { status: "FAILED", analysisData: { error: msg } as any },
        });
      });
    }

    return NextResponse.json({ jobId: job.id, status: "PENDING" });
  } catch (err) {
    console.error("POST /api/mix-console/job:", err);
    return NextResponse.json({ error: "Failed to create mix job." }, { status: 500 });
  }
}
