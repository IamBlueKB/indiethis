/**
 * src/lib/video-studio/link-guest.ts
 *
 * Session linking utility — when a non-subscriber creates an account with
 * the same email they used to purchase a video, this function links all
 * their MusicVideo records to the new userId.
 *
 * Called from:
 *   - Dashboard page.tsx server component (on first visit after signup)
 *   - POST /api/dashboard/video-studio/link (client-triggered fallback)
 */

import { db } from "@/lib/db";

export interface LinkResult {
  linked: number;  // number of MusicVideo records now linked to this user
}

/**
 * Finds all MusicVideo records with guestEmail = email AND userId IS NULL,
 * links them to the provided userId, marks their conversion sequence as done.
 * Returns the count of records that were linked.
 */
export async function linkGuestVideosByEmail(
  userId: string,
  email:  string,
): Promise<LinkResult> {
  const result = await db.musicVideo.updateMany({
    where: {
      guestEmail:     email,
      userId:         null,
    },
    data: {
      userId:         userId,
      conversionDone: true,  // Stop the email sequence — they signed up!
    },
  });

  return { linked: result.count };
}
