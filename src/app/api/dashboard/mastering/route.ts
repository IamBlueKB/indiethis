import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  getDolbyUploadUrl,
  startMastering,
  getDolbyDownloadUrl,
  pollMasteringJob,
} from "@/lib/dolby/mastering";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db.aIGeneration.findMany({
    where: { artistId: session.user.id, type: "MASTERING" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    trackUrl?: string;
    tier?: "quick" | "studio";
    preset?: string;
    trackTitle?: string;
  };

  if (!body.trackUrl?.trim()) {
    return NextResponse.json({ error: "Track URL is required." }, { status: 400 });
  }

  const tier = body.tier === "studio" ? "studio" : "quick";

  // Create a pending job record
  const job = await db.aIGeneration.create({
    data: {
      artistId: session.user.id,
      type: "MASTERING",
      status: "QUEUED",
      inputData: {
        trackUrl: body.trackUrl,
        tier,
        preset: body.preset ?? "A",
        trackTitle: body.trackTitle ?? "Untitled",
      },
    },
  });

  // Run mastering asynchronously (fire and forget — update job on completion)
  runMastering(job.id, body.trackUrl, tier, (body.preset ?? "A") as "A"|"B"|"C"|"D"|"E"|"F").catch(console.error);

  return NextResponse.json({ jobId: job.id, status: "QUEUED" });
}

async function runMastering(
  jobId: string,
  inputUrl: string,
  tier: "quick" | "studio",
  preset: "A"|"B"|"C"|"D"|"E"|"F"
) {
  try {
    await db.aIGeneration.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

    // Get output dlb:// URL
    const { dlbUrl: outputDlbUrl } = await getDolbyUploadUrl(`mastered-${jobId}.wav`);

    const dolbyJobId = await startMastering({
      inputUrl,
      outputUrl: outputDlbUrl,
      tier,
      preset,
    });

    const result = await pollMasteringJob(dolbyJobId);

    if (result.status === "Success") {
      const downloadUrl = await getDolbyDownloadUrl(outputDlbUrl);
      await db.aIGeneration.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          outputUrl: downloadUrl,
          outputData: { loudness: result.outputLoudness, dolbyJobId },
        },
      });
    } else {
      await db.aIGeneration.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          outputData: { error: result.error ?? "Mastering failed", dolbyJobId },
        },
      });
    }
  } catch (err) {
    await db.aIGeneration.update({
      where: { id: jobId },
      data: { status: "FAILED", outputData: { error: String(err) } },
    });
  }
}
