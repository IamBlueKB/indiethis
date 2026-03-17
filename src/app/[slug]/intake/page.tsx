import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { randomBytes } from "crypto";

export default async function PublicIntakePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const studio = await db.studio.findUnique({
    where: { slug },
    select: { id: true, isPublished: true },
  });

  if (!studio || !studio.isPublished) notFound();

  // Generate a walk-in intake token valid for 72 hours
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await db.intakeLink.create({
    data: {
      studioId: studio.id,
      token,
      expiresAt,
    },
  });

  redirect(`/${slug}/intake/${token}`);
}
