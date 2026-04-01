/**
 * inactive-content.ts — Inactive Content Agent (Step 3)
 *
 * Runs weekly on Tuesdays. Finds stale tracks, merch, and digital products
 * with zero activity in the last 60 days, then sends one digest notification
 * per artist with up to 3 specific monetisation suggestions.
 */

import { db } from "@/lib/db";
import { logAgentAction } from "@/lib/agents";
import { createNotification } from "@/lib/notifications";
import { claude } from "@/lib/claude";

const HAIKU = "claude-3-5-haiku-20241022";
const INACTIVE_DAYS = 60;

export interface InactiveContentAgentResult {
  checked: number;
  acted:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runInactiveContentAgent(): Promise<InactiveContentAgentResult> {
  await logAgentAction("INACTIVE_CONTENT", "AGENT_RUN_START");

  const cutoff = daysAgo(INACTIVE_DAYS);

  // All artists with an active subscription
  const artistIds = await db.user.findMany({
    where: { role: "ARTIST", subscription: { status: "ACTIVE" } },
    select: { id: true, name: true },
    take: 100,
  });

  let checked = 0;
  let acted   = 0;

  for (const artist of artistIds) {
    checked++;

    // Stale tracks: published, created before cutoff, zero plays
    const staleTracks = await db.track.findMany({
      where: {
        artistId:  artist.id,
        status:    "PUBLISHED",
        plays:     0,
        createdAt: { lte: cutoff },
      },
      select: { id: true, title: true, coverArtUrl: true, canvasVideoUrl: true },
      take: 5,
    });

    // Stale merch: active products older than cutoff with no orders in last 60 days
    const staleMerch = await db.merchProduct.findMany({
      where: {
        artistId:  artist.id,
        isActive:  true,
        createdAt: { lte: cutoff },
        orderItems: { none: { order: { createdAt: { gte: cutoff } } } },
      },
      select: { id: true, title: true },
      take: 3,
    });

    // Stale digital products: published, older than cutoff, no purchases in last 60 days
    const staleDigital = await db.digitalProduct.findMany({
      where: {
        userId:    artist.id,
        published: true,
        createdAt: { lte: cutoff },
        purchases: { none: { createdAt: { gte: cutoff } } },
      },
      select: { id: true, title: true },
      take: 3,
    });

    if (!staleTracks.length && !staleMerch.length && !staleDigital.length) continue;

    // Guard: already acted this week?
    const recentLog = await db.agentLog.findFirst({
      where: {
        agentType: "INACTIVE_CONTENT",
        action:    "DIGEST_SENT",
        targetId:  artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });
    if (recentLog) continue;

    // Build suggestions (max 3)
    const suggestions: Array<{ label: string; link: string }> = [];

    for (const track of staleTracks.slice(0, 2)) {
      const missingCoverArt  = !track.coverArtUrl;
      const missingCanvas    = !track.canvasVideoUrl;

      if (missingCoverArt && missingCanvas) {
        suggestions.push({
          label: `Complete "${track.title}" release — cover art + canvas + lyric video bundle ($18.99, saves $2.99)`,
          link:  "/dashboard/music",
        });
      } else if (missingCoverArt) {
        suggestions.push({
          label: `Generate cover art for "${track.title}" to make it stand out ($4.99)`,
          link:  `/dashboard/ai/cover-art?trackId=${track.id}`,
        });
      } else if (missingCanvas) {
        suggestions.push({
          label: `Add a canvas video to "${track.title}" to bring it to life ($1.99)`,
          link:  "/dashboard/music",
        });
      } else {
        suggestions.push({
          label: `Create a lyric video for "${track.title}" to boost shares ($14.99)`,
          link:  `/dashboard/ai/lyric-video?trackId=${track.id}`,
        });
      }
      if (suggestions.length >= 3) break;
    }

    for (const merch of staleMerch.slice(0, 1)) {
      if (suggestions.length >= 3) break;
      suggestions.push({
        label: `Share "${merch.title}" on your socials — try a SMS broadcast to your fans`,
        link:  "/dashboard/merch",
      });
    }

    for (const digital of staleDigital.slice(0, 1)) {
      if (suggestions.length >= 3) break;
      suggestions.push({
        label: `Promote "${digital.title}" — send an email blast to your fan list`,
        link:  "/dashboard/music",
      });
    }

    if (!suggestions.length) continue;

    // Use Haiku to write a concise, human-sounding digest message
    let digestMessage = "Here are some things worth your attention this week.";
    try {
      const bulletList = suggestions.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
      const resp = await claude.messages.create({
        model:      HAIKU,
        max_tokens: 80,
        system:     "You write concise, friendly one-sentence intro messages for a music platform digest. Sound like a helpful team member, not a bot. No emojis. First person plural (we/our).",
        messages: [{ role: "user", content: `Write a one-sentence intro for this weekly content digest:\n${bulletList}` }],
      });
      const text = resp.content.find(b => b.type === "text")?.text?.trim();
      if (text) digestMessage = text;
    } catch { /* use default */ }

    // Primary deep-link = first suggestion's link
    const primaryLink = suggestions[0]?.link ?? "/dashboard/music";

    await createNotification({
      userId:  artist.id,
      type:    "AI_JOB_COMPLETE",
      title:   "Content that needs your attention",
      message: digestMessage,
      link:    primaryLink,
    });

    await logAgentAction(
      "INACTIVE_CONTENT",
      "DIGEST_SENT",
      "USER",
      artist.id,
      { suggestions, staleTracks: staleTracks.length, staleMerch: staleMerch.length },
    );

    acted++;
  }

  await logAgentAction(
    "INACTIVE_CONTENT",
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    { checked, acted },
  );

  return { checked, acted };
}
