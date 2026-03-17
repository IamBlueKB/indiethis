import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { FrameClient } from "./FrameClient";

export default async function PreviewFramePage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") redirect("/login");

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: {
      id: true, slug: true, name: true, tagline: true, bio: true,
      phone: true, email: true, logoUrl: true, logo: true, heroImage: true,
      galleryImages: true, servicesJson: true, services: true, testimonials: true,
      studioHours: true, hoursNote: true, accentColor: true, template: true,
      pageConfig: true, isPublished: true,
      instagram: true, tiktok: true, facebook: true, twitter: true, youtube: true,
      streetAddress: true, city: true, state: true, zipCode: true,
      studioTier: true, generationsUsedThisMonth: true,
    },
  });

  if (!studio) redirect("/studio");

  const services = studio.servicesJson
    ? (() => { try { return JSON.parse(studio.servicesJson); } catch { return []; } })()
    : (studio.services ?? []).map((s: string) => ({ name: s, price: "", description: "" }));

  const testimonials = studio.testimonials
    ? (() => { try { return JSON.parse(studio.testimonials); } catch { return []; } })()
    : [];

  return (
    <FrameClient
      initialStudio={studio as Record<string, unknown>}
      initialTemplate={studio.template ?? "CLASSIC"}
      initialPageConfig={studio.pageConfig ?? null}
      initialServices={services}
      initialTestimonials={testimonials}
    />
  );
}
