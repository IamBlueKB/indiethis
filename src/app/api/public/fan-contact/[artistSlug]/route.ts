import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;
    const body = await req.json() as {
      email:   string;
      phone?:  string;
      zip?:    string;
      source:  "RELEASE_NOTIFY" | "SHOW_NOTIFY";
    };

    const { email, phone, zip, source } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    if (!source || !["RELEASE_NOTIFY", "SHOW_NOTIFY"].includes(source)) {
      return NextResponse.json({ error: "Invalid source." }, { status: 400 });
    }

    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: {
        id:         true,
        artistSite: { select: { isPublished: true } },
      },
    });

    if (!artist || !artist.artistSite?.isPublished) {
      return NextResponse.json({ error: "Artist not found." }, { status: 404 });
    }

    // Upsert — update phone/zip if re-subscribing with new info
    await db.fanContact.upsert({
      where: {
        artistId_email_source: {
          artistId: artist.id,
          email:    email.toLowerCase().trim(),
          source,
        },
      },
      update: {
        phone: phone?.trim() || undefined,
        zip:   zip?.trim()   || undefined,
      },
      create: {
        artistId: artist.id,
        email:    email.toLowerCase().trim(),
        phone:    phone?.trim() || null,
        zip:      zip?.trim()   || null,
        source,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[fan-contact]", err);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}
