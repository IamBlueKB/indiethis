/**
 * GET  /api/dashboard/presave  — list artist's campaigns (with click counts)
 * POST /api/dashboard/presave  — create new campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await db.preSaveCampaign.findMany({
      where:   { artistId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        clicks: {
          select: { platform: true },
        },
      },
    });

    const result = campaigns.map((c) => {
      const spotifyClicks    = c.clicks.filter((cl) => cl.platform === "SPOTIFY").length;
      const appleMusicClicks = c.clicks.filter((cl) => cl.platform === "APPLE_MUSIC").length;
      return {
        id:            c.id,
        title:         c.title,
        artUrl:        c.artUrl,
        releaseDate:   c.releaseDate.toISOString(),
        spotifyUrl:    c.spotifyUrl,
        appleMusicUrl: c.appleMusicUrl,
        isActive:      c.isActive,
        createdAt:     c.createdAt.toISOString(),
        stats: { spotify: spotifyClicks, appleMusic: appleMusicClicks, total: spotifyClicks + appleMusicClicks },
      };
    });

    return NextResponse.json({ campaigns: result });
  } catch (err) {
    console.error("[presave GET]", err);
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      title:        string;
      artUrl?:      string | null;
      releaseDate:  string;
      spotifyUrl?:  string | null;
      appleMusicUrl?: string | null;
    };

    if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!body.releaseDate)   return NextResponse.json({ error: "Release date required" }, { status: 400 });

    const campaign = await db.preSaveCampaign.create({
      data: {
        artistId:     session.user.id,
        title:        body.title.trim(),
        artUrl:       body.artUrl ?? null,
        releaseDate:  new Date(body.releaseDate),
        spotifyUrl:   body.spotifyUrl ?? null,
        appleMusicUrl: body.appleMusicUrl ?? null,
        isActive:     true,
      },
    });

    return NextResponse.json({
      campaign: {
        id:            campaign.id,
        title:         campaign.title,
        artUrl:        campaign.artUrl,
        releaseDate:   campaign.releaseDate.toISOString(),
        spotifyUrl:    campaign.spotifyUrl,
        appleMusicUrl: campaign.appleMusicUrl,
        isActive:      campaign.isActive,
        createdAt:     campaign.createdAt.toISOString(),
        stats:         { spotify: 0, appleMusic: 0, total: 0 },
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[presave POST]", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
