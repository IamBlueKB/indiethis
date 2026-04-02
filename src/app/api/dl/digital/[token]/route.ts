import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import NodeID3 from "node-id3";

// GET /api/dl/digital/[token]?trackId=X
// Returns a signed download redirect for a specific track in a digital purchase
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const trackId = req.nextUrl.searchParams.get("trackId");

  const purchase = await db.digitalPurchase.findUnique({
    where: { downloadToken: token },
    include: {
      digitalProduct: {
        include: {
          user: { select: { name: true, artistName: true } },
          tracks: {
            select: { id: true, title: true, fileUrl: true, isrc: true, bpm: true, musicalKey: true },
          },
        },
      },
    },
  });

  // ── SAMPLE_PACK: serve the zip directly ─────────────────────────────────
  if (purchase && purchase.digitalProduct.type === "SAMPLE_PACK") {
    if (purchase.downloadCount >= purchase.maxDownloads) {
      return NextResponse.json(
        { error: "Download limit reached. Contact support@indiethis.com for help." },
        { status: 410 }
      );
    }

    // trackId=zip triggers the actual file download
    if (trackId === "zip") {
      await db.digitalPurchase.update({
        where: { downloadToken: token },
        data: { downloadCount: { increment: 1 } },
      });
      const zipUrl = (purchase.digitalProduct as { samplePackFileUrl?: string | null }).samplePackFileUrl;
      if (!zipUrl) return NextResponse.json({ error: "Zip file not available" }, { status: 404 });

      const res = await fetch(zipUrl);
      if (!res.ok) return NextResponse.redirect(zipUrl);
      const buf = await res.arrayBuffer();
      const safeName = purchase.digitalProduct.title
        .replace(/[^a-zA-Z0-9 \-_]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${safeName}.zip"`,
          "Content-Length": String(buf.byteLength),
          "Cache-Control": "no-store",
        },
      });
    }

    // No action param — return pack info for the download page
    const dp = purchase.digitalProduct as {
      title: string; type: string; sampleCount?: number | null; samplePackFileSize?: number | null;
    };
    return NextResponse.json({
      purchase: {
        downloadToken: token,
        downloadCount: purchase.downloadCount,
        maxDownloads:  purchase.maxDownloads,
        remaining:     purchase.maxDownloads - purchase.downloadCount,
      },
      product: {
        title:       dp.title,
        type:        dp.type,
        sampleCount: dp.sampleCount ?? 0,
        fileSize:    dp.samplePackFileSize ?? 0,
      },
      isSamplePack:   true,
      downloadAction: `/api/dl/digital/${token}?trackId=zip`,
    });
  }

  if (!purchase) {
    return NextResponse.json({ error: "Download link not found" }, { status: 404 });
  }

  if (purchase.downloadCount >= purchase.maxDownloads) {
    return NextResponse.json(
      { error: "Download limit reached. Contact support@indiethis.com for help." },
      { status: 410 }
    );
  }

  // If a specific trackId is requested, validate it belongs to the product
  if (trackId) {
    const product = purchase.digitalProduct;
    const track = product.tracks.find((t) => t.id === trackId);
    if (!track) {
      return NextResponse.json({ error: "Track not found in this purchase" }, { status: 404 });
    }

    // Increment download count
    await db.digitalPurchase.update({
      where: { downloadToken: token },
      data: { downloadCount: { increment: 1 } },
    });

    // Determine if this is an MP3
    const isMp3 =
      track.fileUrl.toLowerCase().includes(".mp3") ||
      track.fileUrl.toLowerCase().includes("audio/mpeg");

    // Only attempt ID3 tagging for MP3 files
    if (isMp3) {
      try {
        const fileRes = await fetch(track.fileUrl);
        if (!fileRes.ok) throw new Error(`CDN returned ${fileRes.status}`);

        const contentType = fileRes.headers.get("content-type") ?? "audio/mpeg";
        const rawBuffer = Buffer.from(await fileRes.arrayBuffer() as ArrayBuffer);

        // Determine track position (1-indexed)
        const trackPosition = product.tracks.findIndex((t) => t.id === trackId) + 1;
        const totalTracks = product.tracks.length;
        const trackNumberStr =
          totalTracks > 1
            ? `${trackPosition}/${totalTracks}`
            : trackPosition.toString();

        const artistName =
          product.user.artistName ?? product.user.name ?? undefined;

        const isrcValue = track.isrc ?? product.isrc ?? undefined;

        const tags: NodeID3.Tags = {
          title: track.title,
          artist: artistName,
          album: product.title,
          genre: product.genre ?? undefined,
          year: product.releaseYear?.toString() ?? undefined,
          trackNumber: trackNumberStr,
          composer: product.songwriter ?? undefined,
          encodedBy: product.producer ?? undefined,
          copyright: product.copyright ?? undefined,
          comment: {
            language: "eng",
            text: "Downloaded from IndieThis \u2022 indiethis.com",
          },
          bpm: track.bpm ? track.bpm.toString() : undefined,
          initialKey: track.musicalKey ?? undefined,
          ...(isrcValue ? { ISRC: isrcValue } : {}),
        };

        const tagged = NodeID3.write(tags, rawBuffer);
        const outputBuffer = tagged ? Buffer.from(tagged) : rawBuffer;

        const safeName = track.title
          .replace(/[^a-zA-Z0-9 \-_]/g, "")
          .trim()
          .replace(/\s+/g, "-");
        const filename = `${safeName}.mp3`;

        return new NextResponse(new Uint8Array(outputBuffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(outputBuffer.length),
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        console.error("[digital-download] ID3 tagging failed, falling back to redirect:", err);
        // Fall through to redirect below
      }
    }

    // Fallback: redirect to the file URL (non-MP3 or tagging failure)
    return NextResponse.redirect(track.fileUrl);
  }

  // No trackId — return purchase info with track list
  return NextResponse.json({
    purchase: {
      downloadToken: token,
      downloadCount: purchase.downloadCount,
      maxDownloads: purchase.maxDownloads,
      remaining: purchase.maxDownloads - purchase.downloadCount,
    },
    product: {
      title: purchase.digitalProduct.title,
      type: purchase.digitalProduct.type,
    },
    tracks: purchase.digitalProduct.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      downloadUrl: `/api/dl/digital/${token}?trackId=${t.id}`,
    })),
  });
}
