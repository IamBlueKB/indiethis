import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import JSZip from "jszip";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

// POST /api/dashboard/sample-packs/[id]/previews
// Body: { fileNames: string[] } — 1–5 filenames inside the zip to use as previews
// Extracts them from the zip, uploads individually to UploadThing, stores URLs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const body = (await req.json()) as { fileNames?: string[] };
  const fileNames = body.fileNames ?? [];

  if (!Array.isArray(fileNames) || fileNames.length === 0) {
    return NextResponse.json({ error: "fileNames is required (array of filenames)" }, { status: 400 });
  }
  if (fileNames.length > 5) {
    return NextResponse.json({ error: "Maximum 5 preview samples allowed" }, { status: 400 });
  }

  // Fetch the product (ownership check + get zip URL)
  const product = await prisma.digitalProduct.findFirst({
    where: { id, userId, type: "SAMPLE_PACK" },
    select: { id: true, samplePackFileUrl: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Sample pack not found" }, { status: 404 });
  }
  if (!product.samplePackFileUrl) {
    return NextResponse.json({ error: "No zip file uploaded for this sample pack" }, { status: 400 });
  }

  // ── 1. Download the zip ───────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    const res = await fetch(product.samplePackFileUrl);
    if (!res.ok) throw new Error(`CDN returned ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[sample-pack/previews] zip fetch failed:", err);
    return NextResponse.json({ error: "Failed to access the zip file. Try again." }, { status: 502 });
  }

  // ── 2. Load zip and extract requested files ───────────────────────────────
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return NextResponse.json({ error: "Failed to read ZIP archive." }, { status: 422 });
  }

  const previewUrls: string[] = [];

  for (const fileName of fileNames) {
    const zipFile = zip.file(fileName);
    if (!zipFile) {
      return NextResponse.json(
        { error: `File "${fileName}" not found in the zip archive.` },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await zipFile.async("arraybuffer"));
    const ext        = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".mp3":  "audio/mpeg",
      ".wav":  "audio/wav",
      ".flac": "audio/flac",
      ".aiff": "audio/aiff",
      ".aif":  "audio/aiff",
      ".ogg":  "audio/ogg",
    };
    const mimeType  = mimeMap[ext] ?? "audio/mpeg";
    const baseName  = fileName.split("/").pop() ?? fileName;
    const cleanName = baseName.replace(/[^a-zA-Z0-9._\-]/g, "_");

    // Upload extracted preview to UploadThing via blob upload
    const blob = new Blob([fileBuffer], { type: mimeType });
    const file = new File([blob], cleanName, { type: mimeType });

    try {
      const result = await utapi.uploadFiles([file]);
      const uploaded = result[0];
      if (uploaded.error || !uploaded.data?.url) {
        throw new Error(uploaded.error?.message ?? "No URL returned");
      }
      previewUrls.push(uploaded.data.url);
    } catch (err) {
      console.error("[sample-pack/previews] uploadthing failed:", err);
      return NextResponse.json(
        { error: `Failed to upload preview "${baseName}". Try again.` },
        { status: 502 }
      );
    }
  }

  // ── 3. Store preview URLs on the product ─────────────────────────────────
  await prisma.digitalProduct.update({
    where: { id },
    data: { previewSampleUrls: previewUrls },
  });

  return NextResponse.json({ success: true, previewUrls });
}
