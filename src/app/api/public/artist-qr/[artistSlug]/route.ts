import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateQrPng, generateQrSvg } from "@/lib/qr-generator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") === "svg" ? "svg" : "png";
    const sizeParam = parseInt(searchParams.get("size") ?? "1024", 10);
    const size = Math.min(Math.max(sizeParam, 64), 2048);

    // Verify artist exists and is published
    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: { artistSite: { select: { isPublished: true } } },
    });

    if (!artist || !artist.artistSite?.isPublished) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const url = `${APP_URL}/${artistSlug}`;

    if (format === "svg") {
      const svg = await generateQrSvg(url);
      return new NextResponse(svg, {
        headers: {
          "Content-Type":  "image/svg+xml",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
          "Content-Disposition": `inline; filename="${artistSlug}-qr.svg"`,
        },
      });
    }

    const pngBuffer = await generateQrPng(url, size);
    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type":  "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        "Content-Disposition": `inline; filename="${artistSlug}-qr.png"`,
      },
    });
  } catch (err) {
    console.error("[artist-qr]", err);
    return NextResponse.json({ error: "Failed to generate QR." }, { status: 500 });
  }
}
