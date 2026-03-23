import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── GET — fetch current setup state ─────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name:             true,
      bio:              true,
      photo:            true,
      city:             true,
      genres:           true,
      soundcloudUrl:    true,
      instagramHandle:  true,
      tiktokHandle:     true,
      youtubeChannel:   true,
      spotifyUrl:       true,
      appleMusicUrl:    true,
      signupPath:       true,
      onboardingStep:   true,
      setupCompletedAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ user });
}

// ─── PATCH — save setup step data ─────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    step: 1 | 2 | 3;
    // Step 1
    photo?:  string;
    bio?:    string;
    city?:   string;
    genres?: string[];
    // Step 2
    instagramHandle?: string;
    tiktokHandle?:    string;
    youtubeChannel?:  string;
    spotifyUrl?:      string;
    appleMusicUrl?:   string;
    soundcloudUrl?:   string;
  };

  const { step } = body;

  const data: Record<string, unknown> = { onboardingStep: step };

  if (step === 1) {
    if (body.photo  !== undefined) data.photo  = body.photo  || null;
    if (body.bio    !== undefined) data.bio    = body.bio?.trim()  || null;
    if (body.city   !== undefined) data.city   = body.city?.trim() || null;
    if (body.genres !== undefined) data.genres = body.genres.slice(0, 3);
  }

  if (step === 2) {
    data.instagramHandle = body.instagramHandle?.replace(/^@/, "").trim() || null;
    data.tiktokHandle    = body.tiktokHandle?.replace(/^@/, "").trim()    || null;
    data.youtubeChannel  = body.youtubeChannel?.trim()  || null;
    data.spotifyUrl      = body.spotifyUrl?.trim()      || null;
    data.appleMusicUrl   = body.appleMusicUrl?.trim()   || null;
    data.soundcloudUrl   = body.soundcloudUrl?.trim()   || null;
  }

  if (step === 3) {
    data.setupCompletedAt = new Date();
    data.onboardingStep   = 3;
  }

  const user = await db.user.update({
    where:  { id: session.user.id },
    data,
    select: { onboardingStep: true, setupCompletedAt: true, signupPath: true },
  });

  return NextResponse.json({ ok: true, user });
}
