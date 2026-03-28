/**
 * GET /api/ai-tools/vocal-remover/status/[id]
 * Poll status of a stem separation job.
 * If still processing, fetches Replicate prediction status and updates DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { replicate } from "@/lib/replicate";
import { createNotification } from "@/lib/notifications";
import { storeStemsFromReplicate } from "@/lib/stem-storage";

export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const separation = await db.stemSeparation.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!separation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Already settled — return immediately
  if (separation.status === "completed" || separation.status === "failed") {
    return NextResponse.json(separation);
  }

  // Still processing — poll Replicate
  if (separation.status === "processing" && separation.replicateId && replicate) {
    try {
      const prediction = await replicate.predictions.get(separation.replicateId);

      if (prediction.status === "succeeded") {
        // Store stems permanently and update DB
        const stored = await storeStemsFromReplicate(id, prediction.output);
        const updated = await db.stemSeparation.update({
          where: { id },
          data: {
            status:    "completed",
            vocalsUrl: stored.vocals ?? null,
            drumsUrl:  stored.drums  ?? null,
            bassUrl:   stored.bass   ?? null,
            otherUrl:  stored.other  ?? null,
          },
        });

        // Fire notification
        await createNotification({
          userId:  session.user.id,
          type:    "STEM_SEPARATION_COMPLETE",
          title:   "Your stems are ready",
          message: "Download your separated vocals, drums, bass, and instruments",
          link:    "/dashboard/ai/vocal-remover",
        }).catch(() => {}); // non-fatal

        return NextResponse.json(updated);
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        const updated = await db.stemSeparation.update({
          where: { id },
          data: {
            status:       "failed",
            errorMessage: prediction.error as string ?? "Separation failed",
          },
        });

        await createNotification({
          userId:  session.user.id,
          type:    "STEM_SEPARATION_FAILED",
          title:   "Stem separation failed",
          message: "Something went wrong separating your track. Please try again.",
          link:    "/dashboard/ai/vocal-remover",
        }).catch(() => {});

        return NextResponse.json(updated);
      }

      // Still running (starting | processing) — return current DB state
      return NextResponse.json(separation);
    } catch (err) {
      console.error("[vocal-remover/status] Replicate poll error:", err);
      return NextResponse.json(separation);
    }
  }

  return NextResponse.json(separation);
}
