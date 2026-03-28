import { db } from "@/lib/db";

/**
 * Returns the number of completed stem separations for a user in the current
 * calendar month. Used to enforce the studio soft ceiling (200/month).
 */
export async function getMonthlyStudioSeparations(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return db.stemSeparation.count({
    where: {
      userId,
      status: "completed",
      createdAt: { gte: startOfMonth },
    },
  });
}
