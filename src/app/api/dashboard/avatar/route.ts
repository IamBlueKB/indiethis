/**
 * GET  /api/dashboard/avatar  — list the user's avatars (max 3)
 * POST /api/dashboard/avatar  — generate new avatar from source photo
 *
 * POST body:
 *   { sourcePhotoUrl, style, name, selectedVariationUrl, promptUsed }
 *
 * Rules:
 *   - Max 3 avatars per user (enforced here, not in schema)
 *   - First avatar is auto-set as default
 *   - If another avatar is already default and isDefault=true is passed,
 *     clears the old default first
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { extractAvatarColors }       from "@/lib/avatar/generator";

export const runtime = "nodejs";

const MAX_AVATARS = 3;

// ─── GET — list avatars ───────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const avatars = await db.artistAvatar.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ avatars });
}

// ─── POST — save selected variation as a new avatar ──────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const body = await req.json() as {
    sourcePhotoUrl:       string;
    style:                string;
    name:                 string;
    selectedVariationUrl: string;
    promptUsed?:          string;
  };

  if (!body.sourcePhotoUrl || !body.style || !body.name || !body.selectedVariationUrl) {
    return NextResponse.json({ error: "sourcePhotoUrl, style, name and selectedVariationUrl are required" }, { status: 400 });
  }

  // Enforce max 3 avatars
  const existing = await db.artistAvatar.count({ where: { userId } });
  if (existing >= MAX_AVATARS) {
    return NextResponse.json(
      { error: "You've reached the maximum of 3 avatars. Delete one to create a new one." },
      { status: 422 },
    );
  }

  const isFirst = existing === 0;

  // If this should be default, clear the old default first
  if (isFirst) {
    await db.artistAvatar.updateMany({
      where: { userId, isDefault: true },
      data:  { isDefault: false },
    });
  }

  // Extract dominant colors from the generated avatar
  const dominantColors = await extractAvatarColors(body.selectedVariationUrl).catch(() => null);

  const avatar = await db.artistAvatar.create({
    data: {
      userId,
      name:           body.name.trim(),
      sourcePhotoUrl: body.sourcePhotoUrl,
      avatarUrl:      body.selectedVariationUrl,
      style:          body.style,
      promptUsed:     body.promptUsed ?? null,
      dominantColors: dominantColors ? (dominantColors as object) : undefined,
      isDefault:      isFirst, // first avatar is auto-default
    },
  });

  return NextResponse.json({ avatar }, { status: 201 });
}
