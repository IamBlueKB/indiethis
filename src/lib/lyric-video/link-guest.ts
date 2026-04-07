/**
 * src/lib/lyric-video/link-guest.ts
 *
 * Session linking utility — when a non-subscriber creates an account with
 * the same email they used to purchase a lyric video, this function links all
 * their LyricVideo records to the new userId.
 *
 * Called from:
 *   - Dashboard page.tsx server component (on first visit after signup)
 */

import { db } from "@/lib/db";

export interface LinkResult {
  linked: number;  // number of LyricVideo records now linked to this user
}

/**
 * Finds all LyricVideo records with guestEmail = email AND userId IS NULL,
 * links them to the provided userId, marks their conversion sequence as done.
 * Returns the count of records that were linked.
 */
export async function linkGuestLyricVideosByEmail(
  userId: string,
  email:  string,
): Promise<LinkResult> {
  const result = await db.lyricVideo.updateMany({
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
