import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import NodeID3 from "node-id3";

// GET /api/dashboard/stream-lease-beat-download/[beatId]
// Downloads the beat file with ID3 metadata tags (MP3) or clean (WAV/other).
// Lazily computes and stores the beat's SHA-256 audioHash on first download.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ beatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { beatId } = await params;

  const beat = await db.track.findUnique({
    where:  { id: beatId },
    select: {
      id:         true,
      title:      true,
      fileUrl:    true,
      audioHash:  true,
      artistId:   true,
      artist:     { select: { id: true, name: true, artistName: true } },
      beatLeaseSettings: { select: { streamLeaseEnabled: true } },
    },
  });

  if (!beat) return NextResponse.json({ error: "Beat not found" }, { status: 404 });
  if (!beat.beatLeaseSettings?.streamLeaseEnabled) {
    return NextResponse.json({ error: "Stream leasing not enabled for this beat" }, { status: 403 });
  }

  // Fetch the audio file from the CDN
  let fileRes: Response;
  try {
    fileRes = await fetch(beat.fileUrl);
    if (!fileRes.ok) throw new Error(`CDN returned ${fileRes.status}`);
  } catch (err) {
    console.error("[beat-download] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch beat file" }, { status: 502 });
  }

  const rawBuffer = Buffer.from(await fileRes.arrayBuffer() as ArrayBuffer);
  const contentType = fileRes.headers.get("content-type") ?? "audio/mpeg";

  // ── Lazy hash storage ────────────────────────────────────────────────────────
  if (!beat.audioHash) {
    const hash = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    // Fire-and-forget — don't block the download on a DB write
    db.track.update({ where: { id: beat.id }, data: { audioHash: hash } })
      .catch((e) => console.error("[beat-download] hash store failed:", e));
  }

  // ── ID3 tagging (MP3 only) ────────────────────────────────────────────────────
  const producerName = beat.artist.artistName ?? beat.artist.name;
  const isMp3 = contentType.includes("mpeg") || beat.fileUrl.toLowerCase().endsWith(".mp3");

  // eslint-disable-next-line prefer-const
  let outputBuffer: Buffer = rawBuffer;
  if (isMp3) {
    try {
      const tags: NodeID3.Tags = {
        comment: {
          language: "eng",
          text: "IndieThis Stream Lease Only — not for external distribution",
        },
        artist: producerName,
        title:  beat.title,
        userDefinedText: [
          { description: "INDIETHIS_BEAT_ID",      value: beat.id },
          { description: "INDIETHIS_PRODUCER_ID",  value: beat.artistId },
          { description: "INDIETHIS_LICENSE",      value: "Stream Lease Only — not for external distribution" },
          { description: "INDIETHIS_PLATFORM",     value: "https://indiethis.com" },
        ],
      };
      const tagged = NodeID3.write(tags, rawBuffer);
      if (tagged) outputBuffer = Buffer.from(tagged);
    } catch (err) {
      console.error("[beat-download] ID3 tagging failed, serving raw:", err);
      // Serve without tags rather than failing the download
    }
  }

  // Build a clean filename
  const ext      = isMp3 ? "mp3" : (beat.fileUrl.split(".").pop()?.split("?")[0] ?? "wav");
  const safeName = beat.title.replace(/[^a-zA-Z0-9 \-_]/g, "").trim().replace(/\s+/g, "-");
  const filename = `${safeName}-indiethis-stream-lease.${ext}`;

  return new NextResponse(new Uint8Array(outputBuffer), {
    status: 200,
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(outputBuffer.length),
      "Cache-Control":       "no-store",
    },
  });
}
