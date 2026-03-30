import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

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
          tracks: {
            select: { id: true, title: true, fileUrl: true },
          },
        },
      },
    },
  });

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
    const track = purchase.digitalProduct.tracks.find((t) => t.id === trackId);
    if (!track) {
      return NextResponse.json({ error: "Track not found in this purchase" }, { status: 404 });
    }

    // Increment download count
    await db.digitalPurchase.update({
      where: { downloadToken: token },
      data: { downloadCount: { increment: 1 } },
    });

    // Redirect to the file URL
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
