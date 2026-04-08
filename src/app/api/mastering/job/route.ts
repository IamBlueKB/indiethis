/**
 * POST /api/mastering/job
 *
 * Creates a MasteringJob and kicks off the pipeline after payment.
 * Payment must be complete before processing begins — no exceptions.
 *
 * Body:
 *   mode:          "MIX_AND_MASTER" | "MASTER_ONLY"
 *   tier:          "STANDARD" | "PREMIUM" | "PRO"
 *   inputType:     "STEMS" | "STEREO"
 *   inputFileUrl?  stereo URL (MASTER_ONLY)
 *   stems?         [{ url, filename }] (MIX_AND_MASTER)
 *   genre?         detected or user-selected
 *   mood?          "CLEAN" | "WARM" | "PUNCH" | "LOUD"
 *   platforms?     string[]
 *   referenceTrackUrl?
 *   naturalLanguagePrompt?
 *   stripePaymentId
 *   guestEmail?    (non-subscribers)
 *   guestName?
 *   albumGroupId?
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { runMixAndMasterPipeline, runMasterOnlyPipeline } from "@/lib/mastering/pipeline";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body    = await req.json() as {
      mode:                  string;
      tier:                  string;
      inputType:             string;
      inputFileUrl?:         string;
      stems?:                { url: string; filename: string }[];
      genre?:                string;
      mood?:                 string;
      platforms?:            string[];
      referenceTrackUrl?:    string;
      naturalLanguagePrompt?: string;
      stripePaymentId:       string;
      guestEmail?:           string;
      guestName?:            string;
      albumGroupId?:         string;
    };

    // Payment verification — must have a stripePaymentId before we process
    if (!body.stripePaymentId) {
      return NextResponse.json({ error: "Payment required before processing." }, { status: 402 });
    }

    // Verify payment intent is succeeded
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
    const paymentIntent = await stripe.paymentIntents.retrieve(body.stripePaymentId);
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not confirmed." }, { status: 402 });
    }

    // Validate required fields per mode
    if (body.mode === "MASTER_ONLY" && !body.inputFileUrl) {
      return NextResponse.json({ error: "inputFileUrl required for MASTER_ONLY." }, { status: 400 });
    }
    if (body.mode === "MIX_AND_MASTER" && (!body.stems || body.stems.length < 2)) {
      return NextResponse.json({ error: "At least 2 stems required for MIX_AND_MASTER." }, { status: 400 });
    }
    if (body.mode === "MIX_AND_MASTER" && body.stems && body.stems.length > 16) {
      return NextResponse.json({ error: "Maximum 16 stems allowed." }, { status: 400 });
    }

    // Create the job
    const job = await prisma.masteringJob.create({
      data: {
        userId:              session?.user?.id ?? null,
        guestEmail:          body.guestEmail ?? null,
        guestName:           body.guestName  ?? null,
        mode:                body.mode,
        tier:                body.tier,
        inputType:           body.inputType,
        inputFileUrl:        body.inputFileUrl ?? null,
        stems:               body.stems        ?? null,
        genre:               body.genre        ?? null,
        mood:                body.mood         ?? "CLEAN",
        platforms:           body.platforms    ?? ["spotify", "apple_music", "youtube", "wav_master"],
        referenceTrackUrl:   body.referenceTrackUrl ?? null,
        mixParameters:       body.naturalLanguagePrompt
                               ? { naturalLanguagePrompt: body.naturalLanguagePrompt }
                               : null,
        stripePaymentId:     body.stripePaymentId,
        amount:              paymentIntent.amount,
        albumGroupId:        body.albumGroupId ?? null,
        status:              "PENDING",
      },
    });

    // Kick off pipeline in the background (fire and forget)
    // Status is polled via GET /api/mastering/job/[id]/status
    if (body.mode === "MIX_AND_MASTER") {
      runMixAndMasterPipeline(job.id).catch((err) => {
        console.error(`Pipeline failed for job ${job.id}:`, err);
      });
    } else {
      runMasterOnlyPipeline(job.id).catch((err) => {
        console.error(`Pipeline failed for job ${job.id}:`, err);
      });
    }

    return NextResponse.json({ jobId: job.id, status: "PENDING" });
  } catch (err) {
    console.error("POST /api/mastering/job:", err);
    return NextResponse.json({ error: "Failed to create mastering job." }, { status: 500 });
  }
}
