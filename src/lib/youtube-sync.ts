/**
 * YouTube Data API v3 — channel connection + video sync
 *
 * Environment: YOUTUBE_API_KEY  (get from Google Cloud Console → APIs & Services → Credentials)
 * Scopes needed: youtube.readonly (public data only — no OAuth required)
 */

import { db } from "@/lib/db";

const API_KEY  = process.env.YOUTUBE_API_KEY ?? "";
const API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChannelInfo = {
  channelId:    string;
  title:        string;
  handle:       string | null;
  thumbnailUrl: string | null;
};

export type SyncResult = {
  added:   number;
  updated: number;
  total:   number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function apiUrl(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ ...params, key: API_KEY });
  return `${API_BASE}/${path}?${qs.toString()}`;
}

/** Extract the YouTube video ID from a youtu.be or youtube.com URL, or return the string as-is if it looks like a raw ID. */
function extractVideoId(url: string): string | null {
  const ytRegex = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const m = url.match(ytRegex);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  return null;
}

/** Parse a YouTube channel URL/handle/ID into the canonical channel identifier for the API. */
function parseChannelInput(input: string): { type: "id" | "handle" | "username"; value: string } | null {
  const s = input.trim();

  // UCxxxxxx channel ID
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return { type: "id", value: s };

  // Full URL
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const path = url.pathname;

    // /channel/UCxxxxxx
    const chanMatch = path.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
    if (chanMatch) return { type: "id", value: chanMatch[1] };

    // /@handle or /c/handle or /user/handle
    const handleMatch = path.match(/\/@([^/]+)/) ?? path.match(/\/(?:c|user)\/([^/]+)/);
    if (handleMatch) return { type: "handle", value: handleMatch[1] };
  } catch {
    // not a URL
  }

  // @handle without URL
  if (s.startsWith("@")) return { type: "handle", value: s.slice(1) };

  // bare word — treat as handle
  if (/^[A-Za-z0-9._-]+$/.test(s)) return { type: "handle", value: s };

  return null;
}

// ─── resolveChannelId ─────────────────────────────────────────────────────────
/**
 * Given a YouTube URL, handle, or channel ID string, returns the channel's
 * UCxxxxxx ID along with display info.
 *
 * Returns null if the channel can't be found.
 * Throws if YOUTUBE_API_KEY is not configured.
 */
export async function resolveChannelId(input: string): Promise<ChannelInfo | null> {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");

  const parsed = parseChannelInput(input);
  if (!parsed) return null;

  let url: string;

  if (parsed.type === "id") {
    url = apiUrl("channels", {
      id:   parsed.value,
      part: "id,snippet",
    });
  } else {
    // Use forHandle (v3 newer format) — falls back to forUsername
    url = apiUrl("channels", {
      forHandle: parsed.value,
      part:      "id,snippet",
    });
  }

  const res  = await fetch(url, { next: { revalidate: 0 } });
  const json = await res.json() as {
    items?: Array<{
      id: string;
      snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
    }>;
    error?: { message: string };
  };

  if (json.error) throw new Error(`YouTube API error: ${json.error.message}`);

  const item = json.items?.[0];
  if (!item) {
    // forHandle can fail for legacy channels — fall back to forUsername
    if (parsed.type === "handle") {
      const fallback = await fetch(apiUrl("channels", { forUsername: parsed.value, part: "id,snippet" }), { next: { revalidate: 0 } });
      const fb       = await fallback.json() as typeof json;
      const fbItem   = fb.items?.[0];
      if (!fbItem) return null;
      return {
        channelId:    fbItem.id,
        title:        fbItem.snippet.title,
        handle:       fbItem.snippet.customUrl ?? null,
        thumbnailUrl: fbItem.snippet.thumbnails?.default?.url ?? null,
      };
    }
    return null;
  }

  return {
    channelId:    item.id,
    title:        item.snippet.title,
    handle:       item.snippet.customUrl ?? null,
    thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
  };
}

// ─── syncYouTubeChannel ───────────────────────────────────────────────────────
/**
 * Fetches the latest videos from the artist's connected YouTube channel and
 * upserts them as ArtistVideo records (type=YOUTUBE, syncedFromYouTube=true).
 *
 * For re-syncs: stops paginating once it encounters a video older than
 * lastSyncedAt (publishedAfter optimization).
 *
 * Deduplication: uses youtubeVideoId @unique — existing records have title
 * and thumbnail updated while product links and sort order are preserved.
 *
 * Returns { added, updated, total }.
 */
export async function syncYouTubeChannel(artistId: string): Promise<SyncResult> {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY is not configured.");

  // Load artist's YouTubeSync record
  const ytSync = await db.youTubeSync.findUnique({ where: { userId: artistId } });
  if (!ytSync) throw new Error("No YouTube channel connected.");

  // Mark as SYNCING
  await db.youTubeSync.update({
    where: { userId: artistId },
    data:  { syncStatus: "SYNCING" },
  });

  try {
    // Step 1: get uploads playlist ID
    const channelRes  = await fetch(
      apiUrl("channels", { id: ytSync.channelId, part: "contentDetails" }),
      { next: { revalidate: 0 } }
    );
    const channelJson = await channelRes.json() as {
      items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
      error?: { message: string };
    };
    if (channelJson.error) throw new Error(`YouTube API: ${channelJson.error.message}`);

    const uploadsPlaylistId = channelJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error("Could not retrieve uploads playlist.");

    // Step 2: paginate playlistItems
    // For re-syncs: stop when publishedAt < lastSyncedAt (publishedAfter optimization)
    const cutoff = ytSync.lastSyncedAt ?? null;

    interface PlaylistItem {
      snippet: {
        title:       string;
        description: string;
        thumbnails:  { medium?: { url: string }; default?: { url: string } };
        resourceId:  { videoId: string };
        publishedAt: string;
      };
    }

    const videoItems: PlaylistItem[] = [];
    let pageToken: string | undefined;
    let reachedCutoff = false;

    // Max 4 pages (200 videos) per run; cron processes PENDING first anyway
    for (let page = 0; page < 4 && !reachedCutoff; page++) {
      const params: Record<string, string> = {
        playlistId:  uploadsPlaylistId,
        part:        "snippet",
        maxResults:  "50",
      };
      if (pageToken) params.pageToken = pageToken;

      const res  = await fetch(apiUrl("playlistItems", params), { next: { revalidate: 0 } });
      const json = await res.json() as {
        items?:          PlaylistItem[];
        nextPageToken?:  string;
        error?:          { message: string };
      };
      if (json.error) throw new Error(`YouTube API: ${json.error.message}`);

      for (const item of json.items ?? []) {
        if (cutoff && new Date(item.snippet.publishedAt) < cutoff) {
          reachedCutoff = true;
          break;
        }
        videoItems.push(item);
      }

      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }

    // Step 3: upsert each video
    let added   = 0;
    let updated = 0;

    const existingCount = await db.artistVideo.count({ where: { artistId } });
    let sortBase = existingCount;

    for (const item of videoItems) {
      const { title, description, thumbnails, resourceId, publishedAt } = item.snippet;
      const videoId  = resourceId.videoId;
      const thumbUrl = thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Try upsert via the @unique youtubeVideoId constraint
      try {
        const existing = await db.artistVideo.findUnique({ where: { youtubeVideoId: videoId }, select: { id: true } });

        if (existing) {
          await db.artistVideo.update({
            where: { id: existing.id },
            data:  { title, thumbnailUrl: thumbUrl, description: description || null },
          });
          updated++;
        } else {
          await db.artistVideo.create({
            data: {
              artistId,
              title,
              description:      description || null,
              videoUrl,
              thumbnailUrl:     thumbUrl,
              embedUrl,
              type:             "YOUTUBE",
              syncedFromYouTube: true,
              youtubeVideoId:   videoId,
              sortOrder:        sortBase++,
              createdAt:        new Date(publishedAt),
            },
          });
          added++;
        }
      } catch (err) {
        console.error(`[youtube-sync] failed to upsert video ${videoId}:`, err);
      }
    }

    const now = new Date();

    // Update YouTubeSync record — SYNCED
    await db.youTubeSync.update({
      where: { userId: artistId },
      data:  {
        syncStatus:   "SYNCED",
        lastSyncedAt: now,
        nextSyncAt:   new Date(now.getTime() + 24 * 60 * 60 * 1000), // next day
        totalVideos:  await db.artistVideo.count({ where: { artistId, syncedFromYouTube: true } }),
      },
    });

    return { added, updated, total: videoItems.length };
  } catch (err) {
    // Mark as FAILED, schedule retry in 1 day
    await db.youTubeSync.update({
      where: { userId: artistId },
      data:  {
        syncStatus: "FAILED",
        nextSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }).catch(() => {}); // don't throw if update fails
    throw err;
  }
}

// ─── Utility exports ──────────────────────────────────────────────────────────

export { extractVideoId };
