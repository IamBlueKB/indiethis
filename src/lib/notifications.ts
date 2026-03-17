import { db } from "@/lib/db";
import { NotificationType } from "@prisma/client";

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return db.notification.create({
    data: { userId, type, title, message, link },
  });
}
