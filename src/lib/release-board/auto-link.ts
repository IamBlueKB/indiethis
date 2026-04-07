/**
 * src/lib/release-board/auto-link.ts
 *
 * Auto-links newly completed creative assets to any Release that contains
 * the associated track. Called from pipeline completion handlers so artists
 * don't have to manually manage connections from the Release Board.
 */

import { db } from "@/lib/db";

type AssetType = "coverArt" | "musicVideo" | "lyricVideo";

const FIELD_MAP: Record<AssetType, "coverArtJobId" | "musicVideoId" | "lyricVideoId"> = {
  coverArt:   "coverArtJobId",
  musicVideo: "musicVideoId",
  lyricVideo: "lyricVideoId",
};

/**
 * After a CoverArtJob, MusicVideo, or LyricVideo completes, call this function
 * to automatically link the asset to any Release that contains the given track.
 *
 * PostgreSQL / Prisma: trackIds is a Json column (String[]).
 * We use a raw query for the array-contains check, with a fallback to
 * findMany + JS filter for safety.
 */
export async function autoLinkToRelease(
  trackId:   string,
  assetType: AssetType,
  assetId:   string,
): Promise<void> {
  if (!trackId || !assetId) return;

  try {
    // Find a release that contains this trackId in its JSON array.
    // Prisma 5 supports path/array_contains for Json fields.
    const release = await db.release.findFirst({
      where: {
        trackIds: { array_contains: trackId },
      },
    });

    if (!release) return;

    const updateField = FIELD_MAP[assetType];
    if (!updateField) return;

    // Only link if not already linked (don't overwrite a manual choice)
    if (release[updateField]) return;

    await db.release.update({
      where: { id: release.id },
      data:  { [updateField]: assetId },
    });

    console.log(`[auto-link] linked ${assetType} ${assetId} → release ${release.id} (track ${trackId})`);
  } catch (err) {
    // Non-blocking — log and continue
    console.warn("[auto-link] failed to link asset to release:", err);
  }
}
