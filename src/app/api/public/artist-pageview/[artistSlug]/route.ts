/**
 * POST /api/public/artist-pageview/[artistSlug]
 *
 * Records a page view for an artist's public page.
 * - Skips if the viewer is the artist (session owner check)
 * - Deduplicates: same hashed IP within 30 minutes = skip
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.NEXTAUTH_SECRET ?? "")).digest("hex");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;

    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: { id: true, artistSite: { select: { isPublished: true } } },
    });

    if (!artist || !artist.artistSite?.isPublished) {
      return NextResponse.json({ ok: true, skipped: "not_found" });
    }

    // Don't count the artist viewing their own page
    const session = await auth();
    if (session?.user?.id === artist.id) {
      return NextResponse.json({ ok: true, skipped: "owner" });
    }

    // Hash IP
    const headersList = await headers();
    const forwarded   = headersList.get("x-forwarded-for");
    const ip          = forwarded
      ? forwarded.split(",")[0].trim()
      : (headersList.get("x-real-ip") ?? "unknown");
    const ipHash = hashIp(ip);

    // 30-minute dedup
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await db.pageView.findFirst({
      where:  { artistId: artist.id, ipHash, viewedAt: { gte: cutoff } },
      select: { id: true },
    });
    if (recent) {
      return NextResponse.json({ ok: true, skipped: "duplicate" });
    }

    await db.pageView.create({
      data: { artistId: artist.id, ipHash },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artist-pageview]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
