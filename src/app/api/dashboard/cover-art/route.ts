import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { embedIndieThisMetadata } from "@/lib/image-metadata";
import { createNotification } from "@/lib/notifications";
import { fal } from "@fal-ai/client";

const utapi = new UTApi();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db.aIGeneration.findMany({
    where: { artistId: session.user.id, type: "COVER_ART" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    prompt?: string;
    style?: string;
    mood?: string;
  };

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const job = await db.aIGeneration.create({
    data: {
      artistId: session.user.id,
      type: "COVER_ART",
      status: "QUEUED",
      inputData: {
        prompt: body.prompt.trim(),
        style: body.style ?? "Photorealistic",
        mood: body.mood ?? "",
      },
    },
  });

  // Run generation asynchronously
  generateCoverArt(job.id, body.prompt.trim(), body.style ?? "Photorealistic", body.mood ?? "").catch(console.error);

  return NextResponse.json({ jobId: job.id, status: "QUEUED" });
}

async function generateCoverArt(
  jobId: string,
  prompt: string,
  style: string,
  mood: string
) {
  try {
    await db.aIGeneration.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY not configured");

    fal.config({ credentials: falKey });

    const enhancedPrompt = [
      `Album cover art in ${style} style`,
      mood ? `with a ${mood} mood` : "",
      prompt,
      "High quality, professional music artwork, square format",
    ].filter(Boolean).join(". ");

    const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
      input: {
        prompt:     enhancedPrompt,
        image_size: "square_hd",
        seed:       Math.floor(Math.random() * 100_000),
      },
    });

    const images = (result.data as { images?: { url: string }[] }).images;
    const imageUrl = images?.[0]?.url;

    if (!imageUrl) throw new Error("No image returned from fal.ai");

    // Embed IndieThis EXIF metadata and upload to permanent storage.
    // Falls back to the original fal.ai URL if processing fails.
    let storedUrl = imageUrl;
    try {
      const buffer = await embedIndieThisMetadata(imageUrl);
      const file   = new File([new Uint8Array(buffer)], `cover-art-${jobId}.png`, { type: "image/png" });
      const res    = await utapi.uploadFiles(file);
      storedUrl    = res.data?.ufsUrl ?? res.data?.url ?? imageUrl;
    } catch (err) {
      console.warn(`[cover-art] metadata embed/upload failed, using original URL: ${err}`);
    }

    const completedJob = await db.aIGeneration.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        outputUrl: storedUrl,
        outputData: { model: "fal-ai/bytedance/seedream/v4/text-to-image" },
      },
    });

    // Notify the artist that their cover art is ready
    void createNotification({
      userId: completedJob.artistId,
      type: "AI_JOB_COMPLETE",
      title: "Your AI cover art is ready!",
      message: "Click to view and download your generated album artwork.",
      link: "/dashboard/ai/cover-art",
    }).catch(() => {});
  } catch (err) {
    await db.aIGeneration.update({
      where: { id: jobId },
      data: { status: "FAILED", outputData: { error: String(err) } },
    });
  }
}
