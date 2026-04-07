/**
 * POST /api/dashboard/avatar/generate
 *
 * Runs fal.ai generation and returns 4 variation URLs.
 * Does NOT save to the database — the client previews the variations,
 * picks one, and then calls POST /api/dashboard/avatar to save.
 *
 * Body: { sourcePhotoUrl, style }
 * Response: { variations: AvatarVariation[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { generateAvatarVariations, AVATAR_STYLES } from "@/lib/avatar/generator";

export const runtime = "nodejs";
export const maxDuration = 120; // fal.ai can take up to 60–90s for 4 parallel calls

const MAX_AVATARS = 3;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const body = await req.json() as { sourcePhotoUrl?: string; style?: string };

  if (!body.sourcePhotoUrl) return NextResponse.json({ error: "sourcePhotoUrl required" }, { status: 400 });
  if (!body.style || !AVATAR_STYLES[body.style]) return NextResponse.json({ error: "Invalid style" }, { status: 400 });

  // Check avatar limit before running generation
  const count = await db.artistAvatar.count({ where: { userId } });
  if (count >= MAX_AVATARS) {
    return NextResponse.json(
      { error: "You've reached the maximum of 3 avatars. Delete one first." },
      { status: 422 },
    );
  }

  // Fetch user name for generation context
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });

  try {
    const variations = await generateAvatarVariations({
      sourcePhotoUrl: body.sourcePhotoUrl,
      style:          body.style,
      artistName:     user?.name ?? null,
    });

    return NextResponse.json({ variations });
  } catch (err) {
    console.error("[avatar/generate] error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
