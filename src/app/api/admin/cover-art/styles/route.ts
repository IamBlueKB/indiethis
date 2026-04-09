/**
 * POST /api/admin/cover-art/styles?action=seed
 *   Upserts all 15 default CoverArtStyle records.
 *
 * POST /api/admin/cover-art/styles?action=generate-previews
 *   Generates one AI preview image per style that has no previewUrl, uploads
 *   to UploadThing, and saves the URL back to the DB. PLATFORM_ADMIN only.
 *   Returns streaming JSON-lines progress so the caller can show progress.
 *
 * GET /api/admin/cover-art/styles
 *   Returns all styles (admin view).
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { COVER_ART_STYLES }          from "@/lib/cover-art/styles-seed";
import { fal }                       from "@fal-ai/client";
import { UTApi }                     from "uploadthing/server";

const utapi = new UTApi();

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const styles = await db.coverArtStyle.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ styles });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "seed") {
    let seeded = 0;
    for (const s of COVER_ART_STYLES) {
      await db.coverArtStyle.upsert({
        where:  { name: s.name },
        create: s,
        update: { category: s.category, promptBase: s.promptBase, sortOrder: s.sortOrder },
      });
      seeded++;
    }
    return NextResponse.json({ ok: true, seeded });
  }

  if (action === "generate-previews") {
    // Fetch styles that need previews (empty or missing previewUrl)
    const styles = await db.coverArtStyle.findMany({
      where:   { OR: [{ previewUrl: "" }, { previewUrl: null }] },
      orderBy: { sortOrder: "asc" },
    });

    if (styles.length === 0) {
      return NextResponse.json({ ok: true, generated: 0, message: "All styles already have previews." });
    }

    const results: { name: string; ok: boolean; url?: string; error?: string }[] = [];

    for (const style of styles) {
      try {
        // Build a representative prompt for the style preview
        const prompt = `${style.promptBase}, square album cover art, professional music artwork, 1:1 ratio, high quality`;

        const result = await fal.subscribe("fal-ai/seedream-v4", {
          input: {
            prompt,
            image_size:             { width: 1024, height: 1024 },
            num_images:             1,
            seed:                   style.sortOrder * 1337,
            enable_safety_checker:  true,
          },
        });

        const falUrl = (result.data as { images?: { url: string }[] }).images?.[0]?.url;
        if (!falUrl) throw new Error("No image returned from fal.ai");

        // Upload to UploadThing for permanent storage
        const res = await fetch(falUrl);
        const buf = await res.arrayBuffer();
        const file = new File(
          [new Uint8Array(buf)],
          `cover-art-style-${style.id}.png`,
          { type: "image/png" },
        );
        const upload = await utapi.uploadFiles(file);
        const url = upload.data?.ufsUrl ?? upload.data?.url ?? falUrl;

        // Save back to DB
        await db.coverArtStyle.update({
          where: { id: style.id },
          data:  { previewUrl: url },
        });

        results.push({ name: style.name, ok: true, url });
      } catch (err) {
        results.push({ name: style.name, ok: false, error: String(err) });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, generated: succeeded, total: styles.length, results });
  }

  // Create a single style
  const body = await req.json() as {
    name: string; category: string; previewUrl: string; promptBase: string; sortOrder?: number;
  };
  if (!body.name || !body.category || !body.promptBase) {
    return NextResponse.json({ error: "name, category, promptBase required" }, { status: 400 });
  }
  const style = await db.coverArtStyle.create({ data: body });
  return NextResponse.json({ style }, { status: 201 });
}
