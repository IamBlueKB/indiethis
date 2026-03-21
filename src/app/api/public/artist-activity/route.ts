/**
 * GET /api/public/artist-activity?slug=[artistSlug]
 *
 * Returns recent activity items and live listener count for the activity ticker.
 * No auth required — public endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) return NextResponse.json({ items: [], totalListening: 0 });

    const artist = await db.user.findUnique({
      where:  { artistSlug: slug },
      select: { id: true },
    });
    if (!artist) return NextResponse.json({ items: [], totalListening: 0 });

    const artistId = artist.id;
    const now      = new Date();
    const since10m = new Date(now.getTime() - 10 * 60 * 1000);
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Parallel fetch all activity sources
    const [totalListening, recentOrders, recentPreSaves, recentSupports] =
      await Promise.all([
        // Active listeners: unique page views in last 10 minutes
        db.pageView.count({
          where: { artistId, viewedAt: { gte: since10m } },
        }),
        // Recent merch purchases
        db.merchOrder.findMany({
          where:   { artistId, createdAt: { gte: since24h } },
          orderBy: { createdAt: "desc" },
          take:    5,
          include: { merchProduct: { select: { title: true } } },
        }),
        // Recent pre-saves (via campaign → artist)
        db.preSaveClick.findMany({
          where: {
            campaign: { artistId },
            clickedAt: { gte: since24h },
          },
          orderBy: { clickedAt: "desc" },
          take:    5,
          include: { campaign: { select: { title: true } } },
        }),
        // Recent tips
        db.artistSupport.findMany({
          where:   { artistId, createdAt: { gte: since24h } },
          orderBy: { createdAt: "desc" },
          take:    5,
        }),
      ]);

    // Build activity strings
    const items: string[] = [];

    for (const order of recentOrders) {
      items.push(`Someone just bought ${order.merchProduct.title}`);
    }
    for (const click of recentPreSaves) {
      const platform = click.platform === "APPLE_MUSIC" ? "Apple Music" : "Spotify";
      items.push(`Someone pre-saved on ${platform}`);
    }
    for (const tip of recentSupports) {
      items.push(`Someone sent $${tip.amount.toFixed(0)} support`);
    }

    // Shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return NextResponse.json({
      items:          items.slice(0, 8),
      totalListening: Math.max(totalListening, 0),
    });
  } catch (err) {
    console.error("[artist-activity]", err);
    return NextResponse.json({ items: [], totalListening: 0 });
  }
}
