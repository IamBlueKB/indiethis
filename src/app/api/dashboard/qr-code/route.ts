import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateQrPng, generateQrSvg } from "@/lib/qr-generator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { artistSlug: true, artistName: true, name: true },
    });

    if (!user?.artistSlug) {
      return NextResponse.json({ error: "No artist URL set." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const format   = searchParams.get("format") === "svg" ? "svg" : "png";
    const download = searchParams.get("download") === "1";
    const pageUrl  = `${APP_URL}/${user.artistSlug}`;
    const filename = `${user.artistSlug}-qr`;

    if (format === "svg") {
      const svg = await generateQrSvg(pageUrl);
      return new NextResponse(svg, {
        headers: {
          "Content-Type":        "image/svg+xml",
          "Cache-Control":       "private, no-cache",
          "Content-Disposition": download
            ? `attachment; filename="${filename}.svg"`
            : `inline; filename="${filename}.svg"`,
        },
      });
    }

    const pngBuffer = await generateQrPng(pageUrl, 1024);
    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":        "image/png",
        "Cache-Control":       "private, no-cache",
        "Content-Disposition": download
          ? `attachment; filename="${filename}.png"`
          : `inline; filename="${filename}.png"`,
      },
    });
  } catch (err) {
    console.error("[qr-code]", err);
    return NextResponse.json({ error: "Failed to generate QR." }, { status: 500 });
  }
}
