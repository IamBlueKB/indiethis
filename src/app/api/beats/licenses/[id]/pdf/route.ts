import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import BeatLicensePDF from "@/components/pdf/BeatLicensePDF";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const license = await db.beatLicense.findUnique({
    where: { id },
    include: {
      track: { select: { title: true } },
      producer: { select: { name: true, artistName: true, email: true } },
      artist: { select: { name: true, artistName: true, email: true } },
    },
  });

  if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 });

  // Only producer or artist can download
  if (license.producerId !== session.user.id && license.artistId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(BeatLicensePDF, { license }) as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="beat-license-${id}.pdf"`,
    },
  });
}
