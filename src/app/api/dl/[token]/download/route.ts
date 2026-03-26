import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/dl/[token]/download?index=0
 *
 * Proxies the file through our server so the browser receives
 * Content-Disposition: attachment — forces a real download instead
 * of opening the browser's native media player (which happens when
 * the <a download> attribute is ignored for cross-origin UploadThing URLs).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const index = parseInt(new URL(req.url).searchParams.get("index") ?? "0", 10);

  const quickSend = await db.quickSend.findUnique({ where: { token } });
  if (!quickSend) return new Response("Link not found", { status: 404 });
  if (new Date() > quickSend.expiresAt)
    return new Response("This download link has expired.", { status: 410 });

  const url = quickSend.fileUrls[index];
  if (!url) return new Response("File not found", { status: 404 });

  const fileRes = await fetch(url);
  if (!fileRes.ok)
    return new Response("Could not fetch file from storage", { status: 502 });

  const contentType =
    fileRes.headers.get("content-type") ?? "application/octet-stream";

  // Try to extract a meaningful filename from the URL path
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split("/").pop() ?? `file-${index + 1}`;

  return new Response(fileRes.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
